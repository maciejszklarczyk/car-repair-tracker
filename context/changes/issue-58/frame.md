# Frame Brief: Mileage/date validation gaps on repairs and service thresholds

> Framing step before /10x-plan. Captures what is *actually* at issue,
> separated from what was initially assumed.

## Reported Observation

A new repair can be saved (via POST create or PUT update) with a mileage
lower than a mileage already recorded on an earlier repair for the same
vehicle — reproduced in the running app. Both endpoints only check
`mileage >= car.baseline_mileage`, never against sibling repairs
(`src/pages/api/repairs.ts:46`, `src/pages/api/repairs/[id].ts:57`).
Three related validation gaps were flagged in the same audit: no
`repair_date` format/range check, no `last_performed_mileage` vs
`baseline_mileage` check on service thresholds, and no cross-field check
between a threshold's `last_performed_*` fields and the vehicle's actual
repair history.

## Initial Framing (preserved)

- **User's stated cause or approach**: validation logic in the create/update
  repair endpoints is incomplete — checks the baseline bound but not the
  "prior repairs' max mileage" bound.
- **User's proposed direction**: add a check that submitted mileage
  `>= max(vehicle's existing repairs' mileage)`, alongside the existing
  baseline check.
- **Pre-dispatch narrowing**:
  - Scope: user chose to address all 4 gaps in one change (not just the
    headline mileage-ordering gap).
  - Evidence: reproduced in the running app, not just inferred from code.
  - Edge case: user confirmed a legitimate case exists where a lower
    mileage is valid — editing/correcting an existing repair, or
    backfilling a historical repair between two existing records.

## Dimension Map

1. **Mileage ordering vs. `MAX(sibling repairs)`** — the issue's proposed
   check. Would reject any repair whose mileage is below the current
   maximum, regardless of that repair's own date.
2. **Mileage ordering vs. chronological neighbors (by `repair_date`)** ←
   candidate reframe. The invariant that actually matters is monotonic
   mileage *along the timeline*, not against the global max — a repair
   dated between two existing repairs must fall between their mileages,
   not above all of them.
3. **`repair_date` format/range validation** — schema-level gap, independent
   of the mileage-ordering question. `type="date"` gives browser-level
   format help but the server (`createRepairSchema`/`updateRepairSchema` in
   `src/lib/schemas.ts:7,19`) accepts any non-empty trimmed string, and
   there is no future-date guard anywhere.
4. **Service-threshold `last_performed_mileage`/`last_performed_date`
   consistency** — schema-level gap in `src/lib/schemas.ts:32,44`, same
   "missing cross-reference" shape as dimension 1/2 but on a different
   entity (thresholds vs. repairs), and against a different reference set
   (vehicle baseline + repair history, not sibling repairs).

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1: mileage >= MAX(sibling repairs) is the correct fix | `computeCurrentMileage` (`src/lib/costPerKm.ts:3-5`) already treats "current mileage" as `MAX(baseline, repairs.mileage)`, order-independent by design (confirmed intentional in `context/changes/fix-mileage-tracking/change.md`). A MAX-based create/update guard would additionally block legitimate edits/backfills the user just confirmed as valid (e.g. correcting an earlier repair's odometer, or inserting a historical repair between two later ones) — self-exclusion on edit would fix the edit case but NOT the backfill-between-two-existing-repairs case, since a backfilled repair's mileage is expected to be *below* the current max. | WEAK — matches user's initial framing but contradicts the confirmed edit/backfill requirement |
| 2: mileage >= previous / <= next repair by `repair_date` | `computeCostTrendData` and `computeMileageTrendData` (`src/lib/costPerKm.ts:26-54`) both sort repairs by `repair_date` and plot/accumulate values in that order. A repair with a lower mileage than its chronological predecessor produces a visible dip in the mileage trend chart and a wrong (or negative, silently `continue`-skipped) per-point cost/km in the trend — the concrete downstream harm the issue describes. This bound also naturally accommodates backfill (a historical repair only needs to fit between its actual date-neighbors) and edits (recompute neighbors excluding the repair being edited). | STRONG — matches both the reported harm (chart/trend inconsistency) and the confirmed edit/backfill requirement |
| 3: repair_date format/range gap | `createRepairSchema`/`updateRepairSchema` (`src/lib/schemas.ts:7-8,19-20`) validate `repair_date` as `z.string().trim().min(1, ...)` only — no date-format parse, no future-date bound. Independent of hypothesis 1/2; fixing mileage ordering does nothing for this. | STRONG (as a distinct, real gap) |
| 4: threshold last_performed_mileage/date cross-check gap | `createServiceThresholdSchema`/`updateServiceThresholdSchema` (`src/lib/schemas.ts:25-48`) validate `last_performed_mileage` as `int().min(0)` only — no check against `baseline_mileage` or against the vehicle's actual repair history. Same "missing cross-reference" shape as hypothesis 2, but a separate code path (`src/pages/api/service-thresholds/*`, not yet read in this frame) and a separate entity. | STRONG (as a distinct, real gap) |

## Narrowing Signals

- User confirmed reproduction in the running app (not just a code-reading
  inference) — the observation is solid ground, not speculation.
- User confirmed a legitimate lower-mileage case exists (edit/backfill) —
  this single answer is what breaks hypothesis 1 and promotes hypothesis 2.
- `context/changes/validate-repair-mileage/plan.md:30` explicitly recorded
  "No check that repair mileage is ≥ previous repair mileage (ordering
  across repairs is out of scope)" as a deliberate scope cut on 2026-06-02
  — issue #58 is that deferred piece surfacing now, not a regression.

## Cross-System Convention

The codebase already has one convention for "what does mileage ordering
mean here": `computeCurrentMileage` uses a date-independent MAX for the
single "current odometer" figure (appropriate — you only need the ceiling
for cost/km), while the trend-chart functions use `repair_date` sort order
for anything presented as a timeline. The create/update guard's job is to
protect the timeline view, so it should follow the timeline convention
(chronological-neighbor bounds), not the single-figure convention (global
MAX) that the issue's proposed direction borrows from.

## Reframed Problem Statement

> **The actual problem to plan around is**: repair mileage must be
> validated for monotonicity relative to its chronological neighbors
> (by `repair_date`), not against the global maximum of all repairs —
> and this same "value must be consistent with the vehicle's repair
> timeline" gap also applies, independently, to `repair_date` itself
> (format/future-date) and to service-threshold `last_performed_*` fields.

A MAX-based check (the issue's literal suggestion) would pass code review
and close the ticket, but would immediately break the edit-a-past-repair
and backfill-a-historical-repair flows the user confirmed as legitimate —
trading one data-integrity bug for a usability regression. The
date-relative neighbor check protects the same downstream consumers
(trend charts) without introducing that regression. The three other gaps
are real and share the same conceptual shape (unvalidated cross-reference
against the vehicle's timeline) but touch different fields/entities, so
they can be planned as separate phases of one change rather than one
undifferentiated fix.

## Confidence

**HIGH** — evidence is direct (source reads of the exact consumer
functions), corroborated by an explicit prior scope decision in
`validate-repair-mileage/plan.md`, and the reframe was confirmed rather
than contradicted by the user's own edge-case answer.

## What Changes for /10x-plan

Plan around 4 phases: (1) chronological-neighbor mileage bound on
create/update repair endpoints (excluding self on edit), (2) `repair_date`
format + no-future-date validation, (3) `last_performed_mileage` vs
`baseline_mileage` bound on service-threshold create/update, (4) cross-check
that a threshold's `last_performed_date`/`last_performed_mileage` are
consistent with the vehicle's actual repair history. Do not implement the
issue's literal "mileage >= MAX(sibling repairs)" suggestion for phase 1 —
use the date-neighbor bound instead.

## References

- Source files: `src/pages/api/repairs.ts:46`, `src/pages/api/repairs/[id].ts:57`,
  `src/lib/schemas.ts:7-8,19-20,25-48`, `src/lib/costPerKm.ts:3-5,26-54`
- Related change (explicit prior scope cut): `context/changes/validate-repair-mileage/plan.md`
- Related change (MAX-mileage design intent): `context/changes/fix-mileage-tracking/change.md`
- GitHub issue: https://github.com/maciejszklarczyk/car-repair-tracker/issues/58

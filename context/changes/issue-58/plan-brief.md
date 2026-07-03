# Repair/Threshold Mileage & Date Validation — Plan Brief

> Full plan: `context/changes/issue-58/plan.md`
> Frame brief: `context/changes/issue-58/frame.md`

## What & Why

Repair mileage must be validated for monotonicity relative to its chronological neighbors (by `repair_date`), not against the global maximum of all repairs — and this same "value must be consistent with the vehicle's repair timeline" gap also applies, independently, to `repair_date` itself (format/future-date) and to service-threshold `last_performed_*` fields.

## Starting Point

Both repair create/update endpoints only check `mileage >= car.baseline_mileage`; there's no cross-repair check at all. The issue's literal suggestion (reject anything below the global MAX) was ruled out during framing — it would break legitimate edits (correcting an earlier repair's mileage) and backfills (adding a historical repair between two existing ones), both confirmed as real use cases. Service-threshold endpoints don't even fetch `baseline_mileage` today, and `repair_date` has no format or future-date validation anywhere.

## Desired End State

Submitting a repair or service threshold whose mileage/date conflicts with the vehicle's actual repair timeline is rejected with a clear message — while editing a past repair or backfilling a historical one continues to work exactly as before, because the check is relative to date-neighbors, not a single ceiling.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Mileage-ordering rule | Chronological-neighbor bound (by `repair_date`), not global MAX | Global MAX breaks confirmed-legitimate edit/backfill flows; neighbor bound protects the same trend-chart consumers without the regression | Frame |
| Edit + date change | Recompute neighbors from the *submitted* `repair_date`, excluding self | Only correct option — bounding against the old position would validate against a timeline the save is about to change | Plan |
| Same-date repairs | Excluded from the bound in either direction; ordered by mileage for display purposes | Same-day entries have no inherent time order; forcing one causes false rejections | Plan |
| `repair_date` range | No lower bound beyond "valid date, not in the future" | Matches the confirmed backfill use case — old dates must stay enterable | Plan |
| Threshold cross-check strictness | Same hard-reject bound as repairs (full neighbor check when a date is known, baseline-only otherwise) | Symmetric with the repair fix; one mental model for the whole app | Plan |
| Client-side validation | Server-side only for the new checks; existing baseline-only client check stays as-is | Avoids duplicating a genuinely tricky algorithm across 4 form components and risking client/server drift | Plan |

## Scope

**In scope:**
- Shared `computeMileageBounds` helper (new pure function + unit tests)
- Repair create/update endpoint validation using the helper
- `repair_date` format/future-date validation (schema-level)
- Service-threshold create/update validation using the helper + baseline check

**Out of scope:**
- Client-side (React form) duplication of the new checks
- Changes to `computeCurrentMileage`'s MAX-based semantics (still correct for "current odometer")
- DB constraints or data migration for existing invalid records
- A "vehicle owned since" date lower-bound on `repair_date`

## Architecture / Approach

One new pure function (`src/lib/mileageValidation.ts`) computes a `[min, max]` mileage bound for a given date against a car's sibling repairs. Both repair endpoints (`repairs.ts`, `repairs/[id].ts`) and both service-threshold endpoints (`service-thresholds.ts`, `service-thresholds/[id].ts`) fetch the relevant repairs/baseline and call this same helper, so there's one algorithm implementation and four call sites, each with its own field-mapping and fallback logic (thresholds need effective-value fallback for partial updates).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared mileage-bound helper | Pure function + unit tests covering all boundary cases | Getting the same-date exclusion and edit-exclusion logic exactly right — covered by dedicated test cases |
| 2. Repair create/update validation | Neighbor-bound check replaces baseline-only check on both endpoints | Regressing existing valid submissions (backfill/edit) — covered by manual test steps |
| 3. repair_date format/future-date validation | Schema-level rejection of malformed/future dates | None significant — independent, well-isolated schema change |
| 4. Service-threshold mileage/date cross-check | Same validation standard as repairs, with partial-update fallback logic | Partial-update fallback (mileage-only or date-only edits) is the trickiest new logic in the whole change |

**Prerequisites:** None — builds directly on existing schemas, routes, and test infrastructure.
**Estimated effort:** ~4 sessions, one per phase.

## Open Risks & Assumptions

- Assumes repair counts per vehicle stay small (confirmed via `demo-seed.ts` — single-digit counts), so an extra per-request Supabase fetch has negligible cost.
- Assumes "not in the future" is evaluated at day granularity against server time, matching the `type="date"` input format.

## Success Criteria (Summary)

- A repair or threshold whose mileage/date conflicts with the vehicle's actual timeline is rejected with a clear message.
- Editing or backfilling a repair in a way that's consistent with its date-neighbors continues to succeed exactly as before.
- All new logic is covered by unit and route-level tests following existing conventions.

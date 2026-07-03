<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Repair/Threshold Mileage & Date Validation

- **Plan**: context/changes/issue-58/plan.md
- **Scope**: All 4 phases (full plan)
- **Date**: 2026-07-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS (tests: 77 passed, build: OK, lint: 0 errors, 6 pre-existing unrelated warnings) |

## Findings

### F1 — Sibling-repairs fetch fails open on Supabase error

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/repairs.ts:33-36, src/pages/api/repairs/[id].ts:45-48, src/pages/api/service-thresholds.ts:47-51, src/pages/api/service-thresholds/[id].ts:76-80
- **Detail**: All four endpoints destructure only `data` from the sibling-repairs query, discarding `error` (e.g. `const { data: siblingRepairs } = await supabase...`). The car-ownership fetch two lines above in the same file DOES check its error. On a transient DB error, `siblingRepairs` is `undefined`, `computeMileageBounds(siblingRepairs ?? [], ...)` collapses to `{min: baseline, max: Infinity}`, and an invalid mileage that should be rejected is silently accepted — defeating the feature exactly when the DB has trouble.
- **Fix A ⭐ Recommended**: Check the error and fail closed (return 400/redirect with an error), matching the car-fetch pattern already in the same file.
  - Strength: Consistent with existing code right above it; small diff (4 files, ~2 lines each); keeps the validation invariant honest under all conditions.
  - Tradeoff: A transient/flaky Supabase blip now blocks a legitimate save instead of silently allowing it.
  - Confidence: HIGH — identical error-check pattern used one query earlier in the same file.
  - Blind spot: None significant.
- **Fix B**: Leave as-is, document as accepted risk (rare transient-error window, low business impact).
  - Strength: No code change.
  - Tradeoff: Feature can be silently bypassed under DB error conditions, no logging/visibility.
  - Confidence: MED — depends how often this DB has intermittent errors in practice.
  - Blind spot: No telemetry exists to know how often this actually fires.
- **Decision**: FIXED via Fix A — added error checks (fail closed, `500`) to the sibling-repairs/repairs fetch in all 4 endpoint files; reverted test mocks from unrealistic `data: null, error: null` to `data: [], error: null` for list queries; removed now-provably-dead `?? []` fallback in repairs.ts since Supabase types guarantee non-null data when error is null.

### F2 — "Future date" check uses UTC day boundary vs. user's local date

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/schemas.ts:11-14
- **Detail**: `isNotFutureRepairDate` computes "today" as `new Date().toISOString().slice(0,10)` (server UTC). Users in timezones ahead of UTC near local midnight can have a genuinely-current local date rejected as future, or vice versa. Narrow window, low business impact; app has no timezone handling elsewhere either.
- **Fix**: Accept as known limitation (no per-user timezone concept anywhere in this app), or add a one-line comment in schemas.ts documenting that "future" is evaluated in server/UTC time.
- **Decision**: FIXED — added a comment above `isNotFutureRepairDate` documenting the UTC-vs-local-time tradeoff.

### F3 — Same-date repairs aren't cross-validated against each other

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: src/lib/mileageValidation.ts:11-15
- **Detail**: Deliberate plan behavior (frame.md decision), not a bug. Two same-day repairs with inconsistent mileage pass silently — matches plan intent exactly.
- **Decision**: SKIPPED

### F4 — Sibling-repairs variable naming differs between repairs.ts and service-thresholds files

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/repairs.ts (`siblingRepairs`) vs. service-thresholds*.ts (`repairs`)
- **Detail**: Trivial naming difference for the same concept, not blocking.
- **Decision**: SKIPPED

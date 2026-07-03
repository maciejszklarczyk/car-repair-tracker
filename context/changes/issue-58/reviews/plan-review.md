<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Repair/Threshold Mileage & Date Validation

- **Plan**: `context/changes/issue-58/plan.md`
- **Mode**: Deep
- **Date**: 2026-07-03
- **Verdict**: SOUND
- **Findings**: [0 critical] [1 warning] [1 observation]

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding
5/5 paths ✓, symbols ✓ (`computeMileageBounds` new, not yet existing — expected), brief↔plan ✓

## Findings

### F1 — Existing route tests use ordered mock queues; new queries shift them

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 & Phase 4
- **Detail**: `repairs.test.ts` / `repairs-id.test.ts` / `service-thresholds*.test.ts` use `mockResults([...])`, a queue consumed in call order. Phase 2's new sibling-repairs query and Phase 4's extended selects/conditional fetches shift that order — existing tests silently desync unless queues are updated.
- **Fix**: Add a test-note to each affected phase's contract calling out which test file's mock queue needs updating.
- **Decision**: FIXED — added a "Test note" line to each of the four endpoint contracts (Phase 2 POST/PUT, Phase 4 POST/PUT) naming the affected test file.

### F2 — Phase 2 ships before Phase 3; malformed repair_date briefly unvalidated

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 2 / Phase 3 sequencing
- **Detail**: `computeMileageBounds` compares `repair_date` as raw strings. Until Phase 3 lands, a malformed date (via direct API call, not the UI) sorts unpredictably in the bound comparison. Pre-existing exposure, not a regression — UI always sends ISO via `type="date"`.
- **Fix**: None needed.
- **Decision**: SKIPPED — accepted as pre-existing, low-exposure risk.

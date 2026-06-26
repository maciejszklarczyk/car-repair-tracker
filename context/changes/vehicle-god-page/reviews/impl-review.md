<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Vehicle Module Structural Refactor

- **Plan**: context/changes/vehicle-god-page/plan.md
- **Scope**: All Phases (1–4)
- **Date**: 2026-06-26
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — select() column assertions missing in service test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/services/__tests__/vehiclePageData.test.ts:67
- **Detail**: Plan required test case "passes correct explicit column lists to each select() call". Implementation only asserted from() table names, not column strings passed to select().
- **Fix**: Added assertions verifying each select() call received the correct column string constant.
- **Decision**: FIXED

### F2 — Sequential queries could be parallel

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/vehiclePageData.ts:37-61
- **Detail**: Three Supabase queries ran sequentially. Repairs and thresholds are independent — parallelizable via Promise.all after vehicle query.
- **Fix A ⭐ Recommended**: Parallelize repairs + thresholds queries
  - Strength: ~30% latency reduction. Vehicle query stays first for ownership check.
  - Tradeoff: Slightly more complex error handling with destructured Promise.all.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Fix B**: Keep sequential, accept latency
  - Strength: Simpler code.
  - Tradeoff: Missed easy performance win.
  - Confidence: HIGH.
  - Blind spot: None.
- **Decision**: FIXED via Fix A

### F3 — Stale cost/km after local-state delete

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/repairs/RepairList.tsx:30
- **Detail**: After delete, repair disappears from list but cost/km stays stale (server-rendered in Astro template, outside React island). Fix requires pulling metric into React or cross-island state — not a quick fix.
- **Decision**: FOLLOW-UP — flagged as separate change

### F4 — Repairs/thresholds queries lack explicit user_id filter

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/vehiclePageData.ts:47-59
- **Detail**: Vehicle query filters by user_id, but repairs/thresholds only by car_id. RLS covers it at DB level — pre-existing pattern, not a regression.
- **Fix**: Added .eq("user_id", userId) to both queries for defense-in-depth.
- **Decision**: FIXED

### F5 — Plan's "NOT Doing" list contradicts Phase 4 scope

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: plan.md:34
- **Detail**: "What We're NOT Doing" said "React component testing infrastructure setup" out of scope, but Phase 4 required testing-library + jsdom. Internal plan contradiction.
- **Fix**: Updated plan text to reflect Phase 4's actual infra needs.
- **Decision**: FIXED

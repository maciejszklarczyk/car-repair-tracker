<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Add Repair (S-02)

- **Plan**: context/changes/add-repair/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-05-31
- **Verdict**: APPROVED
- **Findings**: 0 critical · 1 warning · 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Null dereference in API ownership check

- **Severity**: ❌ CRITICAL (false positive — dismissed after analysis)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/repairs.ts:23
- **Detail**: Reviewer flagged `carError || car.user_id !== user.id` as null-dereference when `carError` is set. Analysis showed this is a false positive — `||` short-circuits in JavaScript so `car.user_id` is never evaluated when `carError` is truthy. TypeScript + ESLint confirmed the original form is correct.
- **Decision**: DISMISSED — false positive

### F2 — No UPDATE/DELETE RLS policies on repairs table

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260531120000_create_repairs_table.sql
- **Detail**: Intentional for MVP append-only design. S-03 (repair history) explicitly includes edit + delete — policies should be added in S-03's migration co-located with that feature.
- **Decision**: SKIPPED — policies belong in S-03 migration

### F3 — Char counter hidden when description has an error

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/ui/TextareaField.tsx:56
- **Detail**: Plan said "char counter below" without specifying mutual exclusion with error. Counter disappeared when error shown — user couldn't see how far over the limit they were.
- **Fix**: Show error and counter simultaneously; counter turns red when over limit.
- **Decision**: FIXED — ba4c69a

### F4 — new.astro uses single optional-chain guard for two distinct cases

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/dashboard/repairs/new.astro:28
- **Detail**: `car?.user_id !== user.id` handles both "car not found" and "wrong owner" via optional chaining. Attempted explicit `!car || car.user_id` but ESLint `prefer-optional-chain` enforces optional chain form. Both are semantically identical; optional chain is lint-approved.
- **Decision**: SKIPPED — linter enforces the existing pattern

### F5 — seed.sql and eslint.config.js unplanned but justified

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: supabase/seed.sql, eslint.config.js
- **Detail**: seed.sql adds dev test fixtures; eslint.config.js disables `no-misused-promises` for .astro files (known astro-eslint-parser crash on `return Astro.redirect()`). Both justified.
- **Decision**: SKIPPED — accepted as documented scope additions

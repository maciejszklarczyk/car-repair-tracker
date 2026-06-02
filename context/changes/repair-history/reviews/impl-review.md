<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Repair History — Browse, Edit & Delete

- **Plan**: context/changes/repair-history/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-06-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  3 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — carId prop declared but never used in RepairList

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/repairs/RepairList.tsx:19-22
- **Detail**: Props interface declared `carId: string` (line 19) but function destructured only `repairs` (line 22). Prop accepted and passed from parent but never consumed inside component.
- **Fix Applied**: Fix A — removed `carId` from Props interface and parent call site (vehicles/[id].astro:80).
- **Decision**: FIXED via Fix A

### F2 — Null access type error in ownership check

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/repairs/[id].ts:29 and :85
- **Detail**: `if (repairError || repair.user_id !== user.id)` — when repairError is truthy, Supabase returns repair=null. Short-circuit is safe at runtime but TypeScript cannot narrow `repair` to non-null from the repairError check alone.
- **Fix**: Added `!repair` guard: `if (repairError || !repair || repair.user_id !== user.id)` in both PUT and DELETE handlers.
- **Decision**: FIXED

### F3 — Write queries rely solely on RLS for ownership

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/repairs/[id].ts:46-54 and :89
- **Detail**: App-layer ownership check runs before the write, but `.update()` and `.delete()` queries omit `.eq("user_id", user.id)`. RLS policies from Phase 1 enforce ownership at DB level. Single layer of defense on write path.
- **Fix Applied**: Fix A — accepted risk; added inline comments noting RLS enforces write ownership.
- **Decision**: FIXED (accepted risk)

### F4 — Raw Supabase error.message returned to client

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/repairs/[id].ts:57 and :92
- **Detail**: Both PUT and DELETE returned `error.message` verbatim from Supabase on DB failure, leaking internal DB error strings. Cross-cutting pattern also present in sibling repairs.ts.
- **Fix**: Replaced with generic "Something went wrong" in both handlers.
- **Decision**: FIXED

### F5 — EditRepairForm uses manual Button instead of SubmitButton

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/repairs/EditRepairForm.tsx:154
- **Detail**: AddRepairForm uses `<SubmitButton>` which relies on `useFormStatus` (native form POST). EditRepairForm uses `fetch()` with manual `isSubmitting` state — `useFormStatus` would not reflect fetch pending state. The custom Button is correct here; SubmitButton cannot be shared without refactoring it to support both modes.
- **Decision**: SKIPPED — false positive; implementations correctly differ due to different submission strategies.

### F6 — updateRepairSchema omit-nulls semantics undocumented

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/schemas.ts:15-20
- **Detail**: `createRepairSchema.cost` uses a string transform (FormData input); `updateRepairSchema.cost` uses `.nullable().optional()` (JSON body input). Asymmetry is correct but undocumented.
- **Fix**: Added one-line comments above each schema noting intended input format.
- **Decision**: FIXED

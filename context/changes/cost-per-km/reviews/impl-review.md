<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Cost per km (S-04)

- **Plan**: context/changes/cost-per-km/plan.md
- **Scope**: All phases (Phase 1 + Phase 2)
- **Date**: 2026-06-02
- **Verdict**: APPROVED (after fixes)
- **Findings**: 0 critical · 3 warnings · 3 observations (all resolved)

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (after fixes) |
| Architecture | PASS |
| Pattern Consistency | PASS (after fixes) |
| Success Criteria | PASS |

## Findings

### F1 — Repairs fetched before ownership is verified

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard/vehicles/[id].astro:15–28
- **Detail**: The ownership check fired after both DB queries completed. An authenticated user with a foreign vehicle UUID could trigger a successful repairs fetch before the redirect.
- **Fix Applied**: Added `.eq("user_id", user.id)` to the vehicle query (DB-level enforcement). Combined with the explicit error guard and supabase null guard, the repairs query is only reached for valid owned vehicles.
- **Decision**: FIXED via Fix A

### F2 — Vehicle query error silently swallowed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard/vehicles/[id].astro:16–18
- **Detail**: `result.error` was not checked. A DB error left vehicle as null and silently redirected.
- **Fix Applied**: Check `result.error || !result.data` and redirect if set.
- **Decision**: FIXED

### F3 — Null vehicle guard relied on auth side-effect

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard/vehicles/[id].astro:24–32
- **Detail**: Missing-id case relied on auth check redirecting as a side-effect instead of an explicit guard.
- **Fix Applied**: Refactored frontmatter to use early returns for `!id || !supabase`, then flat query structure with explicit error guards. `vehicle` is now typed as non-null for the template.
- **Decision**: FIXED

### F4 — No explicit supabase null guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard/vehicles/[id].astro:13–15
- **Detail**: `createClient()` can return null; the implicit guard silently skipped queries.
- **Fix Applied**: Explicit `if (!id || !supabase) return Astro.redirect(...)` before queries. Redundant `if (id && supabase)` wrapper removed.
- **Decision**: FIXED

### F5 — Repairs query error silently swallowed

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard/vehicles/[id].astro:20
- **Detail**: Failed repairs fetch silently rendered empty list.
- **Fix Applied**: Destructure `repairsError` and redirect if set.
- **Decision**: FIXED

### F6 — No archived_at filter on vehicle query

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/dashboard/vehicles/[id].astro:17
- **Detail**: Sibling list page filters `.is("archived_at", null)`; detail page did not.
- **Fix Applied**: Added `.is("archived_at", null)` to the vehicle query.
- **Decision**: FIXED

### F7 — Negative mileage delta handled correctly

- **Severity**: ℹ️ OBSERVATION
- **Dimension**: Safety & Quality
- **Location**: src/lib/costPerKm.ts:4–5
- **Detail**: `km <= 0` guard correctly handles negative baseline delta. No action needed.
- **Decision**: ACKNOWLEDGED

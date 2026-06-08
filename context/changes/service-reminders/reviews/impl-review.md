<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Service Reminders

- **Plan**: context/changes/service-reminders/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-06-08
- **Verdict**: NEEDS ATTENTION (all fixed during triage)
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Thresholds fetch error silently swallowed on vehicle page

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard/vehicles/[id].astro:44
- **Detail**: The repairs fetch destructures and checks repairsError, redirecting on failure. The thresholds fetch only destructured data — a DB error would silently fall back to [] and configured reminders would disappear with no user feedback.
- **Fix**: Destructure error: thresholdsError and redirect on failure, identical to the repairsError pattern.
- **Decision**: FIXED

### F2 — DELETE returns 204 without confirming row ownership existed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: src/pages/api/service-thresholds/[id].ts:75
- **Detail**: Supabase DELETE with .eq("user_id", user.id) succeeded silently with 0 rows affected if id belongs to another user or doesn't exist. Caller got 204 either way. Absent the "belt-and-suspenders" pre-fetch pattern used in repairs/[id].ts.
- **Fix**: Added pre-fetch SELECT before delete. Returns 404/403 on missing/wrong-owner. Mirrors repairs/[id].ts:97–104.
- **Decision**: FIXED

### F3 — PUT skips pre-fetch ownership check present in reference pattern

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/service-thresholds/[id].ts:44
- **Detail**: PUT handler went straight from Zod validation to .update().eq("user_id", user.id). Wrong-owner update returned 404 instead of 403, inconsistent with repairs/[id].ts.
- **Fix**: Added pre-fetch + explicit 403 check before update, matching repairs/[id].ts pattern.
- **Decision**: FIXED

### F4 — EditServiceThresholdForm has undocumented onCancel prop

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (minor)
- **Location**: src/components/service-reminders/EditServiceThresholdForm.tsx:5
- **Detail**: Plan specified Props: threshold: ServiceThreshold. Implementation adds onCancel: () => void. Architecturally sound — enables parent-controlled inline editing.
- **Fix**: N/A — accepted drift.
- **Decision**: SKIPPED

### F5 — updateServiceThresholdSchema allows completely empty update body

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/schemas.ts:37
- **Detail**: All fields optional — PUT {} passed validation, triggering a no-op UPDATE with 200 response.
- **Fix**: Added .refine() requiring at least one field present.
- **Decision**: FIXED

### F6 — Days "approaching" margin is absolute (30d) while km is relative (10%)

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (business logic)
- **Location**: src/lib/serviceReminders.ts:46
- **Detail**: km approaching = last 10% of interval (relative); days approaching = ≤30 days (absolute). Plan specified "stałe 30 dni" intentionally.
- **Fix**: Added inline comment documenting the intentional asymmetry.
- **Decision**: FIXED via Fix A (comment added, no logic change)

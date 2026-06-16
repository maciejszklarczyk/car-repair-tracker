---
date: 2026-06-15T18:30:00+02:00
researcher: Claude
git_commit: a4fe165
branch: main
repository: car-repair-tracker
topic: "E2E testing grounding for data isolation (Risk #1) and repair lifecycle (Risk #5)"
tags: [research, e2e, playwright, rls, auth, repairs]
status: complete
last_updated: 2026-06-15
last_updated_by: Claude
---

# Research: E2E Testing Grounding for Critical Flows

**Date**: 2026-06-15T18:30:00+02:00
**Researcher**: Claude
**Git Commit**: a4fe165
**Branch**: main
**Repository**: car-repair-tracker

## Research Question

What does the codebase need for Playwright e2e tests covering Risk #1 (IDOR/RLS bypass — one user accessing another's data) and Risk #5 (repair delete/edit silently corrupts data or skips cost/km recalculation)?

## Summary

- **RLS is enforced** on all 3 tables (`cars`, `repairs`, `service_thresholds`) via `auth.uid() = user_id` policies. Two gaps found: `cars` missing UPDATE/DELETE policies, and UPDATE policies on `repairs`/`service_thresholds` don't re-validate `car_id` ownership.
- **Auth is cookie-based** via `@supabase/ssr`. Playwright `storageState` is viable — POST to `/api/auth/signin` with form data sets session cookies. Two separate browser contexts = two isolated users.
- **Cost/km is fully SSR**. After delete (`window.location.reload()`) or edit (navigation to vehicle detail), the page re-renders with fresh data from Supabase. No client-side recalculation — assertions on DOM text after page load are sufficient.
- **No Playwright infrastructure exists.** Need to install `@playwright/test`, create config, global setup, auth setup, and e2e directory structure. Vitest unit/integration infra is solid (8 files, 88 tests) but e2e is greenfield.

## Detailed Findings

### 1. RLS Policies and Data Isolation

**Table: `cars`**
- RLS enabled: yes
- Ownership: `user_id` column, `auth.uid() = user_id`
- Policies: SELECT (`cars_select_own`), INSERT (`cars_insert_own`)
- **Gap: no UPDATE or DELETE policies.** If app allows editing/deleting vehicles, RLS blocks it silently unless a service-role client is used.

**Table: `repairs`**
- RLS enabled: yes
- Ownership: `user_id` column
- Policies: SELECT, INSERT, UPDATE, DELETE — all 4 CRUD operations covered
- INSERT policy has extra guard: verifies `car_id` belongs to same user (`EXISTS (SELECT 1 FROM public.cars WHERE id = car_id AND user_id = auth.uid())`)
- **Gap: UPDATE policy does not re-validate `car_id` ownership.** User could theoretically reassign repair to another user's car via PUT.

**Table: `service_thresholds`**
- RLS enabled: yes
- Ownership: `user_id` column
- Policies: SELECT, INSERT, UPDATE, DELETE — full coverage
- Same INSERT car-ownership guard as repairs
- **Same UPDATE gap** as repairs — no `car_id` re-validation on update

**E2E test implication for Risk #1:** Create User A with a car + repairs, create User B. As User B, attempt to GET/PUT/DELETE User A's resources via API. RLS should return empty results or errors. The `cars` UPDATE/DELETE gap should be verified — does the app even expose those operations?

### 2. Auth Flow and Playwright storageState

**Session mechanism:**
- `@supabase/ssr` creates per-request client with cookie-based sessions (`src/lib/supabase.ts`)
- Cookies named `sb-<project-ref>-auth-token` (chunked if large)
- No localStorage/sessionStorage involvement — pure cookies

**Middleware (`src/middleware.ts`):**
- Runs on every request
- Calls `supabase.auth.getUser()` — server-side token validation, not just JWT parsing
- Attaches user to `context.locals.user`
- Protected routes: anything starting with `/dashboard` redirects to `/auth/signin`

**Sign-in flow:**
- POST `/api/auth/signin` with FormData (`email`, `password`)
- Server calls `supabase.auth.signInWithPassword()`, SSR client sets cookies via `Set-Cookie` headers
- Redirects to `/` on success

**Playwright auth strategy:**
```
1. Global setup: create 2 test users via Supabase admin API (service_role key)
2. Auth setup project: POST /api/auth/signin for each user, save storageState
3. Tests load from storageState files — no UI login per test
```

Two browser contexts with separate `storageState` files enable cross-user isolation testing.

### 3. Repair Lifecycle and Cost/km Recalculation

**Cost/km computation:** `src/lib/costPerKm.ts`
- `computeCostPerKm(vehicle, repairs)` = `totalCost / (maxMileage - baselineMileage)`
- Returns `null` if km <= 0 or totalCost === 0
- Called in Astro frontmatter of `/dashboard/vehicles/[id].astro` (lines 61-62) — pure SSR

**Delete flow:**
1. User on `/dashboard/vehicles/[id]` sees cost/km (SSR-rendered)
2. RepairList React island → click Delete → AlertDialog confirmation
3. `fetch(/api/repairs/${id}, { method: "DELETE" })` → JSON response
4. On success: `window.location.reload()` → fresh SSR with recalculated cost/km

**Edit flow:**
1. Navigate to `/dashboard/repairs/[id]/edit`
2. EditRepairForm React island → change cost → Save
3. `fetch(/api/repairs/${id}, { method: "PUT", body: JSON })` → JSON response
4. On success: `window.location.href = /dashboard/vehicles/${carId}?success=updated`
5. Full navigation → fresh SSR with recalculated cost/km

**E2E test implication for Risk #5:**
- Assert cost/km text on vehicle detail page before and after mutation
- After delete: `waitForLoadState("networkidle")` or `waitForURL` after reload
- After edit: `waitForURL(/vehicles\/.*\?success=updated/)`
- Cost/km display: `{value.toFixed(2)} PLN/km` or `"-- PLN/km -- no cost data yet"`
- No stale-state risk — every mutation triggers full page reload from server

### 4. Playwright Infrastructure Readiness

**What exists:**
- Vitest unit/integration suite: 8 test files, 88 tests, solid helpers
- Test helpers: `src/test/helpers.ts` with entity factories (`makeVehicle`, `makeRepair`, etc.)
- Supabase migrations + seed script (`supabase/seed.sql`)
- Empty `seed.spec.ts` at root (placeholder)
- `.gitignore` has `# playwright` comment and ignores `auth.json`
- Dev server: `npm run dev` on port 3000 (default Astro)

**What's missing:**
- `@playwright/test` not installed
- No `playwright.config.ts`
- No `e2e/` or `tests/` directory
- No global setup for test user creation
- No auth setup project for `storageState`
- No `webServer` config for auto-starting dev server
- `.gitignore` missing `test-results/`, `playwright-report/`

**Setup needed (Phase 1 of e2e plan):**
1. `npm install -D @playwright/test` + `npx playwright install`
2. Create `playwright.config.ts` with `webServer: { command: "npm run dev", port: 3000 }`
3. Create `e2e/` directory
4. Create auth global setup (Supabase admin API for user creation + storageState)
5. Update `.gitignore`
6. Create seed test from `references/seed-test-pattern.md`

## Code References

- `supabase/migrations/20260526120000_create_cars_table.sql` — cars RLS (SELECT + INSERT only)
- `supabase/migrations/20260531120000_create_repairs_table.sql` — repairs RLS (SELECT + INSERT)
- `supabase/migrations/20260602120000_add_repair_update_delete_policies.sql` — repairs UPDATE + DELETE
- `supabase/migrations/20260608120000_create_service_thresholds_table.sql` — thresholds full RLS
- `src/lib/supabase.ts` — SSR client with cookie sessions
- `src/middleware.ts` — auth middleware, PROTECTED_ROUTES
- `src/pages/api/auth/signin.ts` — sign-in endpoint (FormData → signInWithPassword)
- `src/pages/api/repairs/[id].ts` — PUT/DELETE/PATCH handlers
- `src/pages/api/repairs.ts` — POST handler (FormData, server redirect)
- `src/lib/costPerKm.ts` — computeCostPerKm, computeCurrentMileage
- `src/pages/dashboard/vehicles/[id].astro` — SSR cost/km computation (lines 61-62)
- `src/components/repairs/RepairList.tsx` — delete flow with window.location.reload()
- `src/components/repairs/EditRepairForm.tsx` — edit flow with navigation

## Architecture Insights

1. **Full SSR for data display** — cost/km and all vehicle data are computed in Astro frontmatter, not React. This means e2e tests can assert on static DOM text after page load without waiting for client-side hydration of those values.

2. **Belt-and-suspenders auth** — both RLS (DB-level) and app-level ownership checks in API handlers. E2e tests should verify the RLS layer specifically since integration tests mock Supabase and never hit real policies.

3. **Form-based mutations** — create uses HTML form submission with server redirect; edit/delete use fetch + client-side navigation. Test strategy must account for both patterns.

4. **No optimistic UI** — every mutation triggers full page reload/navigation. Simplifies e2e assertions but means tests must wait for navigation to complete.

## Open Questions

1. **Does the app allow editing/deleting vehicles?** If yes, the missing `cars` UPDATE/DELETE RLS policies are a real bug, not just a test gap. Research didn't find vehicle edit/delete UI — needs verification.

2. **Test database isolation** — should e2e tests use the local Supabase instance (`supabase start`) or a dedicated test project? Local is simpler but shares state with manual dev work.

3. **`car_id` reassignment via UPDATE** — the RLS gap where repairs/thresholds UPDATE doesn't re-validate car ownership: is this exploitable through the app's API, or does zod schema validation prevent changing `car_id` on update?

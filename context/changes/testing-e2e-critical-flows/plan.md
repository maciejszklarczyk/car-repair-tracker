# E2E Tests for Data Isolation and Repair Lifecycle — Implementation Plan

## Overview

Add Playwright E2E tests covering test-plan.md Phase 4: Risk #1 (IDOR / RLS bypass — one user accessing another's data) and Risk #5 (repair delete/edit silently corrupts data or skips cost/km recalculation). Tests run against real Supabase with RLS, proving what integration tests (which mock Supabase) cannot.

## Current State Analysis

Playwright infrastructure partially exists:
- `@playwright/test` v1.61 installed, `playwright.config.ts` configured with `webServer` and auth setup project
- Single test user `test@test.com` in `supabase/seed.sql` and `e2e/auth.setup.ts`
- Seed spec `e2e/seed.spec.ts` tests vehicle creation
- No second user, no cross-user tests, no repair lifecycle tests, no `npm run e2e` script, no CI e2e job

### Key Discoveries:

- Vehicle edit/delete not exposed in UI or API — `cars` UPDATE/DELETE RLS gap is unexploitable, out of scope for E2E
- `car_id` not in repair update zod schema — reassignment attack impossible via API
- Cost/km is fully SSR (computed in Astro frontmatter) — DOM text assertions after page load/navigation are sufficient
- Delete triggers `window.location.reload()`, edit navigates to vehicle detail — both produce fresh SSR

## Desired End State

Two E2E test files exist and pass against local Supabase:
1. **Data isolation** — User B cannot see User A's vehicles or access User A's repairs via API (3-4 assertions proving RLS enforcement)
2. **Repair lifecycle** — add repair → cost/km appears → edit cost → cost/km updates → delete repair → cost/km resets (one flow, three cost/km assertions)

Both tests clean up their own data in teardown. An `npm run e2e` script exists. CI runs e2e tests with a local Supabase instance on every push/PR to main.

## What We're NOT Doing

- Testing vehicle edit/delete (not exposed in the app)
- Testing `service_thresholds` cross-user isolation (identical RLS pattern to repairs — diminishing returns)
- Testing AI classification in E2E (explicitly excluded in test-plan.md §7)
- Visual/screenshot regression testing
- Testing with more than 2 users

## Implementation Approach

Extend the existing Playwright setup with a second test user for cross-user isolation. Each E2E test creates unique data (timestamp-suffixed), asserts the risk scenario, and cleans up in teardown. CI uses `supabase start` in Docker to provide a real database.

## Critical Implementation Details

**Auth context switching:** Playwright's `browser.newContext({ storageState })` lets a single test file use two authenticated users without re-logging in. The data isolation test creates context for User A (creates data) and User B (attempts cross-user access) within one test.

**Cost/km DOM selector:** The vehicle detail page renders cost/km as `{value.toFixed(2)} PLN/km` or `"(— PLN/km — no cost data yet)"` (em dashes, wrapped in a `<span class="text-xs text-blue-100/40">`). Tests assert on text content containing `PLN/km` after page load — use a contains-text matcher to handle both states.

---

## Phase 1: Two-User Auth Infrastructure

### Overview

Add a second test user to seed.sql and auth setup, add `npm run e2e` script, update gitignore.

### Changes Required:

#### 1. Second test user in seed.sql

**File**: `supabase/seed.sql`

**Intent**: Add a second test user (`test2@test.com` / `password123`) for cross-user isolation testing. Same structure as existing user, different UUID and email.

**Contract**: New INSERT into `auth.users` + `auth.identities` with UUID `a0000000-0000-0000-0000-000000000002` and email `test2@test.com`.

#### 2. Auth setup for two users

**File**: `e2e/auth.setup.ts`

**Intent**: Sign in both test users and save separate storageState files so tests can use either user's session.

**Contract**: Two setup steps — one saves `auth-user-a.json`, the other saves `auth-user-b.json`. Each POSTs to `/auth/signin` via the sign-in form.

#### 3. Playwright config update

**File**: `playwright.config.ts`

**Intent**: Update config to reference the two storageState files and make the default chromium project use User A.

**Contract**: Default `storageState: "auth-user-a.json"` for chromium project. Setup project runs `auth.setup.ts` producing both files.

#### 4. npm e2e script

**File**: `package.json`

**Intent**: Add ergonomic script for running E2E tests locally.

**Contract**: `"e2e": "playwright test"` in scripts.

#### 5. Gitignore updates

**File**: `.gitignore`

**Intent**: Ignore Playwright artifacts that shouldn't be committed.

**Contract**: Keep existing `auth.json` entry (may linger on disk from previous runs). Add `auth-user-a.json`, `auth-user-b.json`, `test-results/`, `playwright-report/`.

### Success Criteria:

#### Automated Verification:

- `supabase db reset` applies cleanly with both test users
- `npm run e2e` runs the existing `seed.spec.ts` test using User A auth — passes
- Both `auth-user-a.json` and `auth-user-b.json` are created by auth setup
- `npm run lint` passes
- `npx astro check` passes

#### Manual Verification:

- Confirm both test users can sign in via the app UI

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Data Isolation E2E Test (Risk #1)

### Overview

Prove that User B cannot see User A's vehicles or access User A's repairs through real browser + real RLS.

### Changes Required:

#### 1. Data isolation spec

**File**: `e2e/data-isolation.spec.ts`

**Intent**: Test cross-user data isolation by having User A create a vehicle + repair, then verifying User B sees empty vehicle list and cannot access User A's repair via API.

**Contract**: Single test file with these assertions:
- User A (default storageState) creates a vehicle and a repair via the UI
- User B (separate browser context with `auth-user-b.json`) navigates to `/dashboard/vehicles` → sees zero vehicles (not User A's)
- User B attempts `fetch(/api/repairs/${userARepairId}, { method: "DELETE" })` → gets empty/error response (RLS blocks)
- Teardown: User A deletes the repair and vehicle via API/UI

The test captures User A's repair ID from the URL after creating it (the app redirects to the vehicle detail page).

### Success Criteria:

#### Automated Verification:

- `npm run e2e -- e2e/data-isolation.spec.ts` passes
- Test fails if RLS is disabled (deliberate-break check during `/10x-e2e`)

#### Manual Verification:

- Review test output confirms cross-user assertions fire against real Supabase

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Repair Lifecycle E2E Test (Risk #5)

### Overview

Prove that add/edit/delete repair mutations correctly trigger cost/km recalculation, visible in the SSR-rendered vehicle detail page.

### Changes Required:

#### 1. Repair lifecycle spec

**File**: `e2e/repair-lifecycle.spec.ts`

**Intent**: Full lifecycle flow — add repair → verify cost/km appears → edit cost → verify cost/km updates → delete → verify cost/km resets. Proves that every mutation triggers correct server-side recalculation.

**Contract**: Single test using User A auth, with these steps:
1. Create a vehicle (via UI at `/dashboard/vehicles/new`) with known baseline mileage
2. Add a repair (via UI at `/dashboard/repairs/new`) with known cost and mileage
3. Assert cost/km text on vehicle detail page matches expected value (`cost / (mileage - baseline)`)
4. Edit the repair cost (navigate to edit page, change cost)
5. After redirect back to vehicle detail, assert cost/km reflects new cost
6. Delete the repair (click delete button, confirm dialog)
7. After page reload, assert cost/km shows `"— PLN/km —"` (no cost data — em dashes, inside parens)
8. Teardown: delete the test vehicle

All values use hand-calculated oracle expectations, not the production formula.

### Success Criteria:

#### Automated Verification:

- `npm run e2e -- e2e/repair-lifecycle.spec.ts` passes
- All three cost/km assertions verify distinct values (after add, after edit, after delete)

#### Manual Verification:

- Review test confirms cost/km values match hand-calculated expectations

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: CI Integration

### Overview

Add E2E test job to GitHub Actions workflow using local Supabase in Docker.

### Changes Required:

#### 1. CI workflow e2e job

**File**: `.github/workflows/ci.yml`

**Intent**: Add a separate `e2e` job that starts a local Supabase instance, seeds the database, installs Playwright browsers, and runs E2E tests.

**Contract**: New `e2e` job (parallel with existing `ci` job, not blocking `docker`/`deploy`) with steps:
1. Checkout + Node.js setup
2. `npm ci`
3. Install Supabase CLI (`npx supabase --version` to verify)
4. `supabase start` — starts local Supabase in Docker
5. `supabase db reset` — applies migrations + seed (creates both test users)
6. Set `SUPABASE_URL` and `SUPABASE_KEY` env vars from Supabase CLI output
7. `npx playwright install --with-deps chromium` — install browser
8. `npm run e2e` — run all E2E tests
9. Upload `playwright-report/` as artifact on failure

The job uses `services` or direct Docker commands for Supabase. Env vars for the app come from the local Supabase instance (not repository secrets).

#### 2. Update test-plan cookbook §6.4

**File**: `context/foundation/test-plan.md`

**Intent**: Fill in the "Adding an E2E test" cookbook section that's currently TBD.

**Contract**: Replace the TBD placeholder with location, naming, pattern, reference tests, and run command — matching the format of §6.1 and §6.2.

### Success Criteria:

#### Automated Verification:

- CI workflow syntax valid: `act` or manual push to a branch passes
- E2E tests pass in CI environment
- `npm run lint` passes (no yaml/config issues)

#### Manual Verification:

- Review CI run output confirms Supabase starts and E2E tests execute against it
- Verify `playwright-report` artifact uploads on failure

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### E2E Tests (this plan):

- Data isolation: cross-user vehicle visibility + repair API access
- Repair lifecycle: add/edit/delete with cost/km recalculation verification

### Key Edge Cases:

- Cost/km display when no repairs exist (`"-- PLN/km"`)
- Cost/km after delete of the only repair (resets to no-data state)
- Cross-user API calls returning empty/error (not crashing)

### Cleanup:

- Each test creates unique data (timestamp-suffixed vehicle names)
- Teardown deletes created records via app endpoints
- Orphan data from crashed tests is harmless (unique names prevent collision)

## Performance Considerations

- E2E tests run against dev server (Astro SSR) — expect ~15-20s per test
- CI adds ~2-3 min for Supabase startup + browser install
- `fullyParallel: true` in Playwright config allows spec-level parallelism

## References

- Research: `context/changes/testing-e2e-critical-flows/research.md`
- Test plan: `context/foundation/test-plan.md` (§3 Phase 4, §6.4)
- Existing seed test: `e2e/seed.spec.ts`
- Auth setup: `e2e/auth.setup.ts`
- Cost/km logic: `src/lib/costPerKm.ts`
- Vehicle detail page: `src/pages/dashboard/vehicles/[id].astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Two-User Auth Infrastructure

#### Automated

- [x] 1.1 supabase db reset applies cleanly with both test users — 05c9ffb
- [x] 1.2 npm run e2e runs seed.spec.ts with User A auth — passes — 05c9ffb
- [x] 1.3 Both auth-user-a.json and auth-user-b.json created by auth setup — 05c9ffb
- [x] 1.4 npm run lint passes — 05c9ffb
- [x] 1.5 npx astro check passes — 05c9ffb

#### Manual

- [x] 1.6 Both test users can sign in via app UI — 05c9ffb

### Phase 2: Data Isolation E2E Test (Risk #1)

#### Automated

- [x] 2.1 npm run e2e -- e2e/data-isolation.spec.ts passes — 0f7611b
- [x] 2.2 Test fails if RLS is disabled (deliberate-break check) — 0f7611b

#### Manual

- [x] 2.3 Review test output confirms cross-user assertions fire against real Supabase — 0f7611b

### Phase 3: Repair Lifecycle E2E Test (Risk #5)

#### Automated

- [x] 3.1 npm run e2e -- e2e/repair-lifecycle.spec.ts passes — c85407c
- [x] 3.2 All three cost/km assertions verify distinct values — c85407c

#### Manual

- [x] 3.3 Review test confirms cost/km values match hand-calculated expectations — c85407c

### Phase 4: CI Integration

#### Automated

- [ ] 4.1 CI workflow syntax valid
- [ ] 4.2 E2E tests pass in CI environment
- [ ] 4.3 npm run lint passes

#### Manual

- [ ] 4.4 Review CI run output confirms Supabase starts and E2E tests execute
- [ ] 4.5 Verify playwright-report artifact uploads on failure

# API Authorization & Input Validation Integration Tests — Implementation Plan

## Overview

Write integration tests for all 7 API mutation endpoints, defending against three risks: IDOR/ownership bypass (Risk #1), crafted input acceptance (Risk #3), and silent mutation corruption (Risk #5). Tests call exported handler functions directly with a mocked Supabase client and fabricated APIContext — no dev server needed.

## Current State Analysis

- **Test infrastructure**: Vitest configured with `@` path alias, test pattern `src/**/__tests__/**/*.test.ts`. Two unit test files exist in `src/lib/__tests__/`.
- **API endpoints**: 7 mutation endpoints across 4 files. All use belt-and-suspenders ownership: app-layer `user_id` check + Supabase RLS. All body-accepting endpoints validate with zod `.safeParse()` before DB writes.
- **Two response patterns**: JSON endpoints return `Response.json()`. FormData endpoints (POST repairs, POST vehicles) return `context.redirect()`.
- **Dependencies to mock**: `@/lib/supabase` (createClient), `@/lib/classifyRepair` (classifyRepair), `astro:env/server` (env vars).
- **Existing factories**: `makeVehicle` and `makeRepair` in unit tests — reusable.

### Key Discoveries:

- Supabase client uses anon key with cookie-based sessions (`src/lib/supabase.ts:5-24`) — RLS enforced but we mock the client, so we test app-layer checks
- Mileage-below-baseline guard is app-layer only, not a DB constraint (`src/pages/api/repairs.ts:46`, `src/pages/api/repairs/[id].ts:57`)
- `classifyRepair` returns `RepairCategory | null`, called in POST and PUT repairs — needs mocking
- Cost/km computed client-side only (`src/lib/costPerKm.ts`) — never in API endpoints, so Risk #5 narrows to mutation correctness
- FormData endpoints use `context.redirect()` for both success and error flows, passing error messages via query params
- `cars` table lacks UPDATE/DELETE RLS policies (no endpoints expose these operations currently)

## Desired End State

All 7 API mutation endpoints have integration tests covering: unauthenticated access (401), cross-user access (403), invalid input (400/redirect-with-error), and successful mutations. `npm run test` passes with all new tests. Test-plan §6.2 and §6.3 cookbook patterns filled in.

**Verification**: `npx vitest run` exits 0 with all tests passing.

## What We're NOT Doing

- Testing RLS policies against real Supabase (requires running DB instance)
- Testing auth endpoints (signin/signup — validation delegated to Supabase)
- E2E browser tests
- Testing client-side cost/km recalculation after mutations
- CI wiring (that's rollout Phase 3)
- Testing cars UPDATE/DELETE (no endpoints exist)

## Implementation Approach

Four phases: infrastructure first (mock utilities + APIContext factory), then JSON endpoints (5 endpoints with uniform assertions), then FormData endpoints (2 endpoints with redirect assertions), then cookbook update.

Each endpoint gets three test groups:
1. **Auth**: unauthenticated (null user → 401/redirect) + cross-user (different user_id → 403/redirect)
2. **Validation**: bad payloads → 400/redirect-with-error, mileage-below-baseline where applicable
3. **Happy path**: valid input with owned resource → success response + correct Supabase call

The Supabase mock uses a chainable builder pattern: `mockSupabase.from("repairs").select().eq().single()` resolves to controlled return values set per test.

---

## Phase 1: Test Infrastructure

### Overview

Create shared test utilities: Supabase client mock, APIContext factory, entity factories. Verify setup with one trivial test that imports a handler and calls it with a mocked context.

### Changes Required:

#### 1. Shared test helpers

**File**: `src/test/helpers.ts`

**Intent**: Centralize mock utilities so all integration test files share one Supabase stub shape and one APIContext factory. Re-export `makeVehicle` and `makeRepair` from unit tests for reuse.

**Contract**:

- `createMockSupabase()` — returns a mock Supabase client with chainable `.from(table).select(columns).eq(col, val).single()` / `.insert(data).select().single()` / `.update(data).eq().select().single()` / `.delete().eq()`. Each chain endpoint resolves to `{ data, error }` configurable per test via a `mockResolvedValue`-style API.
- `createMockContext(overrides)` — returns a partial `APIContext` with:
  - `locals.user`: defaults to `{ id: "user-1", ... }` (minimal `User` shape)
  - `request`: accepts `Request` object or builds from `{ method, body, headers }`
  - `cookies`: stub `AstroCookies` with `get/set/getAll`
  - `params`: configurable (e.g., `{ id: "repair-1" }`)
  - `redirect(url)`: captures redirect URL for assertion
  - `url`: stub URL
- Re-export `makeVehicle`, `makeRepair` from `@/lib/__tests__/costPerKm.test.ts` — or copy factories here if re-exporting from test files causes issues. Add `makeServiceThreshold` factory.

**FormData coercion note**: FormData endpoints coerce numeric fields via `Number(form.get(...))` before passing to zod (e.g. `mileage`, `year`, `baseline_mileage`), while `cost` stays a string (zod's `.string().transform()` handles it). Tests constructing FormData should set all fields as strings — the handler's `Number()` call handles coercion. This mirrors real browser FormData behavior.

#### 2. Supabase module mock setup

**File**: `src/pages/api/__tests__/setup.ts`

**Intent**: Provide a reusable `vi.mock("@/lib/supabase")` setup and `vi.mock("@/lib/classifyRepair")` that all integration test files can import or rely on.

**Contract**: Export setup functions or use Vitest's `vi.mock` at module level. Mock `createClient` to return the mock Supabase instance. Mock `classifyRepair` to return `"inne"` by default (safe category fallback). Mock `astro:env/server` to provide dummy env vars if needed.

#### 3. Verify setup with trivial test

**File**: `src/pages/api/__tests__/smoke.test.ts`

**Intent**: Confirm the mock infrastructure works — import a handler, call it with a mocked context, assert a response.

**Contract**: Import `DELETE` from `@/pages/api/repairs/[id]`. Call with unauthenticated context (`locals.user = null`). Assert `response.status === 401`. Delete or keep as a guard test.

### Success Criteria:

#### Automated Verification:

- `npx vitest run` exits 0 with the smoke test passing
- TypeScript types resolve correctly for mock utilities
- `npm run lint` passes

#### Manual Verification:

- None required — pure infrastructure

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: JSON Endpoint Tests

### Overview

Write integration tests for 5 JSON-response endpoints: PUT/DELETE/PATCH repairs and POST/PUT/DELETE service-thresholds. Each file covers auth, validation, and happy-path behavior.

### Changes Required:

#### 1. Repairs [id] tests (PUT, DELETE, PATCH)

**File**: `src/pages/api/__tests__/repairs-id.test.ts`

**Intent**: Test all three handlers in `src/pages/api/repairs/[id].ts` for auth enforcement, input validation, and mutation correctness.

**Contract** — test cases per handler:

**PUT (edit repair)**:
- Auth: `locals.user = null` → 401
- Auth: repair owned by `user-2`, request from `user-1` → 403
- Validation: invalid JSON body → 400
- Validation: empty description → 400
- Validation: negative cost → 400
- Validation: mileage below baseline → 400 with baseline message
- Happy path: valid update → Supabase `.update()` called with correct fields, response `{ success: true }`
- Behavior: description changed + category_source !== "manual" → `classifyRepair` called, update includes new category + `original_category`
- Behavior: existing repair has category=null → `classifyRepair` called even without description change
- Behavior: description unchanged (and category not null) → `classifyRepair` not called

**DELETE (remove repair)**:
- Auth: `locals.user = null` → 401
- Auth: repair owned by `user-2`, request from `user-1` → 403
- Happy path: owned repair → Supabase `.delete()` called, response `{ success: true }`

**PATCH (category override)**:
- Auth: `locals.user = null` → 401
- Auth: repair owned by `user-2`, request from `user-1` → 403
- Validation: invalid category value → 400
- Happy path: valid category → Supabase `.update()` called with `{ category, category_source: "manual" }`

#### 2. Service thresholds tests (POST)

**File**: `src/pages/api/__tests__/service-thresholds.test.ts`

**Intent**: Test POST handler in `src/pages/api/service-thresholds.ts` for auth, validation, and creation.

**Contract** — test cases:

- Auth: `locals.user = null` → 401
- Auth: car owned by different user → 404 (filtered by `eq("user_id", user.id)`)
- Validation: invalid JSON → 400
- Validation: missing both km_interval and days_interval → 400
- Validation: negative km_interval → 400
- Happy path: valid threshold → Supabase `.insert()` called with correct fields, response 201 with threshold data

#### 3. Service thresholds [id] tests (PUT, DELETE)

**File**: `src/pages/api/__tests__/service-thresholds-id.test.ts`

**Intent**: Test PUT and DELETE handlers in `src/pages/api/service-thresholds/[id].ts`.

**Contract** — test cases:

**PUT (update threshold)**:
- Auth: `locals.user = null` → 401
- Auth: threshold owned by `user-2`, request from `user-1` → 403
- Validation: empty body → 400 ("at least one field")
- Validation: invalid JSON → 400
- Happy path: valid partial update → Supabase `.update()` called with only provided fields, response with updated threshold

**DELETE (remove threshold)**:
- Auth: `locals.user = null` → 401
- Auth: threshold owned by `user-2`, request from `user-1` → 403
- Happy path: owned threshold → Supabase `.delete()` called, response 204

### Success Criteria:

#### Automated Verification:

- `npx vitest run` exits 0 with all JSON endpoint tests passing
- No TypeScript errors in test files
- `npm run lint` passes

#### Manual Verification:

- None required — handler-level tests with mocked dependencies

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: FormData Endpoint Tests

### Overview

Write integration tests for 2 FormData-based endpoints: POST repairs and POST vehicles. These return `context.redirect()` instead of `Response.json()`, so assertions check redirect URLs and error query params.

### Changes Required:

#### 1. Repairs POST tests

**File**: `src/pages/api/__tests__/repairs.test.ts`

**Intent**: Test POST handler in `src/pages/api/repairs.ts` — auth, validation, ownership, and successful creation with AI classification.

**Contract** — test cases:

- Auth: `locals.user = null` → redirects to `/auth/signin`
- Auth: car owned by `user-2`, request from `user-1` → redirects with "Vehicle not found" error
- Validation: missing description → redirects with validation error in query param
- Validation: negative cost (string "-100") → redirects with "Cost must be positive" error
- Validation: mileage below baseline → redirects with baseline error
- Happy path: valid repair → Supabase `.insert()` called with correct fields including `user_id`, `category`, `category_source`, `original_category`, redirects to `/dashboard/vehicles/{carId}?success=1`
- Behavior: `classifyRepair` returns null → category set to "pending", category_source set to "pending"
- Behavior: `classifyRepair` returns "hamulce" → category set to "hamulce", category_source set to "ai"

#### 2. Vehicles POST tests

**File**: `src/pages/api/__tests__/vehicles.test.ts`

**Intent**: Test POST handler in `src/pages/api/vehicles.ts` — auth, validation, and successful creation.

**Contract** — test cases:

- Auth: `locals.user = null` → redirects to `/auth/signin`
- Validation: missing make → redirects with error
- Validation: year in future → redirects with error
- Validation: negative baseline mileage → redirects with error
- Happy path: valid vehicle → Supabase `.insert()` called with `user_id: user.id` and validated fields, redirects to `/dashboard/vehicles`

### Success Criteria:

#### Automated Verification:

- `npx vitest run` exits 0 with all tests passing (JSON + FormData endpoints)
- No TypeScript errors
- `npm run lint` passes

#### Manual Verification:

- None required

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Cookbook Update

### Overview

Update test-plan §6.2 and §6.3 with the integration test patterns established in Phases 2-3.

### Changes Required:

#### 1. Update §6.2 — Adding an integration test

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the TBD placeholder with the established pattern: test location, naming, mock setup, assertion patterns for JSON endpoints.

**Contract**: Fill in location (`src/pages/api/__tests__/`), naming (`<endpoint>.test.ts`), mock setup reference (`src/test/helpers.ts`), run command, reference tests.

#### 2. Update §6.3 — Adding a test for a new API endpoint

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the TBD placeholder with the established pattern for testing a new endpoint: auth → validation → happy path.

**Contract**: Describe the three test groups (auth/validation/behavior), reference the shared mock utilities, note the FormData vs JSON assertion difference.

### Success Criteria:

#### Automated Verification:

- `npx vitest run` exits 0 (no regressions)

#### Manual Verification:

- §6.2 and §6.3 in test-plan.md accurately describe the test patterns established in this rollout phase

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Test Organization:

- `src/test/helpers.ts` — shared mocks and factories
- `src/pages/api/__tests__/smoke.test.ts` — infrastructure smoke test
- `src/pages/api/__tests__/repairs-id.test.ts` — PUT/DELETE/PATCH repairs
- `src/pages/api/__tests__/repairs.test.ts` — POST repairs
- `src/pages/api/__tests__/vehicles.test.ts` — POST vehicles
- `src/pages/api/__tests__/service-thresholds.test.ts` — POST thresholds
- `src/pages/api/__tests__/service-thresholds-id.test.ts` — PUT/DELETE thresholds

### Key Edge Cases:

- Cross-user ownership denial (user-1 targets user-2's resource)
- Mileage below baseline (app-layer guard, not DB constraint)
- Missing both km_interval and days_interval (zod `.refine()`)
- Zero cost (rejected by `.positive()`)
- Description change triggering re-classification
- `classifyRepair` returning null → "pending" fallback
- Invalid JSON body → 400
- FormData redirect URL contains correct error message

### Mock Strategy:

- `vi.mock("@/lib/supabase")` — `createClient` returns chainable stub
- `vi.mock("@/lib/classifyRepair")` — returns controlled category
- Supabase chain `.from().select().eq().single()` returns `{ data, error }` set per test via `mockResolvedValue` or `mockImplementation`
- No real HTTP requests or DB connections

## References

- Research: `context/changes/testing-api-auth-validation/research.md`
- Test plan: `context/foundation/test-plan.md` (risks #1, #3, #5)
- Phase 1 tests (pattern reference): `src/lib/__tests__/costPerKm.test.ts`
- Source endpoints: `src/pages/api/repairs.ts`, `src/pages/api/repairs/[id].ts`, `src/pages/api/vehicles.ts`, `src/pages/api/service-thresholds.ts`, `src/pages/api/service-thresholds/[id].ts`
- Schemas: `src/lib/schemas.ts`
- Supabase client: `src/lib/supabase.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test Infrastructure

#### Automated

- [x] 1.1 `npx vitest run` exits 0 with smoke test passing — 54af6d5
- [x] 1.2 TypeScript types resolve correctly for mock utilities — 54af6d5
- [x] 1.3 `npm run lint` passes — 54af6d5

### Phase 2: JSON Endpoint Tests

#### Automated

- [x] 2.1 `npx vitest run` exits 0 with all JSON endpoint tests passing — bb382b5
- [x] 2.2 No TypeScript errors in test files — bb382b5
- [x] 2.3 `npm run lint` passes — bb382b5

### Phase 3: FormData Endpoint Tests

#### Automated

- [x] 3.1 `npx vitest run` exits 0 with all tests passing (JSON + FormData) — c00398a
- [x] 3.2 No TypeScript errors — c00398a
- [x] 3.3 `npm run lint` passes — c00398a

### Phase 4: Cookbook Update

#### Automated

- [x] 4.1 `npx vitest run` exits 0 (no regressions)

#### Manual

- [x] 4.2 §6.2 and §6.3 in test-plan.md accurately describe the test patterns

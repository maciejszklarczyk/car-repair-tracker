---
date: 2026-06-14T20:01:27Z
researcher: Claude
git_commit: b5cb303
branch: main
repository: maciejszklarczyk/car-repair-tracker
topic: "Ground risks #1 (IDOR/RLS bypass), #3 (input validation), #5 (delete/edit side effects) for API integration tests"
tags: [research, testing, api, authorization, validation, integration]
status: complete
last_updated: 2026-06-14
last_updated_by: Claude
---

# Research: API Authorization & Input Validation Integration Tests

**Date**: 2026-06-14T20:01:27Z
**Researcher**: Claude
**Git Commit**: b5cb303
**Branch**: main
**Repository**: maciejszklarczyk/car-repair-tracker

## Research Question

Ground test-plan risks #1 (IDOR / RLS bypass), #3 (API accepts crafted input), and #5 (repair delete/edit corrupts data or skips recalculation) to produce actionable integration test contracts.

## Summary

All API endpoints follow a **belt-and-suspenders** ownership pattern: app-layer `user_id` checks PLUS Supabase RLS policies on every table. The Supabase client uses the **anon key** with cookie-based sessions, so RLS is always enforced. Every mutation endpoint (except auth and DELETE) validates input with zod `.safeParse()` before any DB write. Cost/km recalculation is **purely client-side** — no server-side recomputation on mutations — so Risk #5 narrows to "does the mutation succeed/fail correctly" rather than "is recalculation triggered."

**Testing approach**: Call exported handler functions directly with mocked `APIContext`. Mock `createClient` from `@/lib/supabase` to return a stub Supabase client with controllable `.from().select/insert/update/delete` chains. No need to spin up an Astro dev server.

## Detailed Findings

### 1. RLS Policies and Ownership Model (Risk #1)

**Ownership column**: `user_id` (UUID, FK to `auth.users(id)`) on all three tables.

| Table | RLS | SELECT | INSERT | UPDATE | DELETE |
|-------|-----|--------|--------|--------|--------|
| `cars` | ON | `auth.uid() = user_id` | `auth.uid() = user_id` | _(none)_ | _(none)_ |
| `repairs` | ON | `auth.uid() = user_id` | `auth.uid() = user_id` + car ownership check | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `service_thresholds` | ON | `auth.uid() = user_id` | `auth.uid() = user_id` + car ownership check | `auth.uid() = user_id` | `auth.uid() = user_id` |

**Key finding**: `cars` table has no UPDATE or DELETE RLS policies. Only SELECT and INSERT exist. This is a potential gap — if a vehicle edit or delete endpoint is added later without policies, it would rely solely on app-layer checks.

**Supabase client** (`src/lib/supabase.ts:5-24`): Uses `createServerClient()` from `@supabase/ssr` with the **anon key** (not service role). Session extracted from cookies → `auth.uid()` resolves correctly in RLS policies.

**App-layer ownership pattern**: Every mutation endpoint:
1. Checks `context.locals.user` exists (401 if null)
2. Fetches the target record and compares `record.user_id !== user.id` (403 if mismatch)
3. Performs the mutation (RLS as second layer)

Specific implementations:
- `src/pages/api/repairs.ts:28` — POST checks `car.user_id !== user.id`
- `src/pages/api/repairs/[id].ts:30` — PUT checks `repair.user_id !== user.id`
- `src/pages/api/repairs/[id].ts:113` — DELETE checks `repair.user_id !== user.id`
- `src/pages/api/repairs/[id].ts:149` — PATCH checks `repair.user_id !== user.id`
- `src/pages/api/service-thresholds.ts:32-37` — POST filters car by `eq("user_id", user.id)`
- `src/pages/api/service-thresholds/[id].ts:42` — PUT checks `existing.user_id !== user.id`
- `src/pages/api/service-thresholds/[id].ts:102` — DELETE checks `existing.user_id !== user.id`

**Risk #1 test-plan guidance verification**: "Authenticated = authorized" challenge is valid. The app-layer checks are present, but integration tests should verify they actually fire (i.e., User A gets 403/404 when targeting User B's resource). Since we mock the Supabase client, we can control what `.select().single()` returns — simulate a record owned by a different user.

### 2. Zod Schemas and Input Validation (Risk #3)

All schemas defined in `src/lib/schemas.ts:1-63`.

**Schema coverage by endpoint**:

| Endpoint | Schema | Parse location | Error response |
|----------|--------|---------------|----------------|
| POST `/api/repairs` | `createRepairSchema` | Line 40 (after form read, before DB) | Redirect with `?error=` |
| PUT `/api/repairs/[id]` | `updateRepairSchema` | Line 51 (after ownership check, before DB) | JSON `{ error }` 400 |
| PATCH `/api/repairs/[id]` | `categoryOverrideSchema` | Line 160 (after ownership check, before DB) | JSON `{ error }` 400 |
| DELETE `/api/repairs/[id]` | _(none — no body)_ | N/A | N/A |
| POST `/api/vehicles` | `createVehicleSchema` | Line 24 (after form read, before DB) | Redirect with `?error=` |
| POST `/api/service-thresholds` | `createServiceThresholdSchema` | Line 26 (after JSON parse, before DB) | JSON `{ error }` 400 |
| PUT `/api/service-thresholds/[id]` | `updateServiceThresholdSchema` | Line 46 (after ownership check, before DB) | JSON `{ error }` 400 |
| DELETE `/api/service-thresholds/[id]` | _(none — no body)_ | N/A | N/A |
| POST `/api/auth/signin` | _(none)_ | N/A — delegated to Supabase | Redirect |
| POST `/api/auth/signup` | _(none)_ | N/A — delegated to Supabase | Redirect |

**Key validation rules**:
- `cost`: Positive number or null. Zero rejected (`.positive()`). Negative rejected.
- `mileage`: Integer, min 0. Additional app-layer check: must be ≥ `car.baseline_mileage` (repairs.ts:46, repairs/[id].ts:57).
- `description`: Trimmed, min 1 char, max 500 chars.
- Service threshold: At least one of `km_interval` or `days_interval` required (`.refine()` at schemas.ts:34).
- Update threshold: At least one field required (`.refine()` at schemas.ts:46).

**Validation gaps found**:
1. `repair_date` — validated as non-empty string only. No date format or future-date check.
2. Auth endpoints — no server-side zod; Supabase handles validation.
3. `last_performed_date` on thresholds — accepts any trimmed string, no date validation.

**Two error response patterns**:
- **FormData endpoints** (POST vehicles, POST repairs): Return `context.redirect()` with error in query param. Status 302.
- **JSON endpoints** (PUT/PATCH/DELETE repairs, all service-thresholds): Return `Response.json({ error: "..." }, { status: 400 })`.

**Risk #3 test-plan guidance verification**: "Zod catches it — but does the endpoint actually use the schema?" → YES, all mutation endpoints with a body use `.safeParse()` before DB writes. Tests should send bad payloads and assert 400 + error message, not just test schema objects in isolation. The mileage-below-baseline check is a separate app-layer validation after zod passes — tests must cover both layers.

### 3. Repair CRUD Side Effects (Risk #5)

**Critical finding**: Cost/km is computed **purely client-side**. `computeCostPerKm()` from `src/lib/costPerKm.ts` is called only in `src/pages/dashboard/vehicles/[id].astro` during SSR page rendering. It is **never imported or called in any API endpoint**.

**Delete flow** (`src/pages/api/repairs/[id].ts:91-125`):
1. Auth check → ownership check → `supabase.from("repairs").delete().eq("id", repairId)` → returns `{ success: true }`
2. No server-side recalculation triggered
3. Client calls `window.location.reload()` → fresh page SSR → `computeCostPerKm()` runs with updated data
4. DB cascade: `repairs.car_id` has `ON DELETE CASCADE` from cars, but deleting a repair has no cascade effect itself

**Edit flow** (`src/pages/api/repairs/[id].ts:8-89`):
1. Auth check → ownership check → JSON parse → zod validate → mileage ≥ baseline check
2. Updates 4 fields: `repair_date`, `description`, `cost`, `mileage`
3. Conditional AI re-classification if description changed and category isn't manual (lines 71-79)
4. Returns `{ success: true }` — no computed values returned
5. Client redirects → fresh page SSR → `computeCostPerKm()` runs with updated data

**Risk #5 reframe**: The original risk says "fails to trigger cost/km recalculation." In reality, there's no server-side recalculation to trigger. The risk narrows to:
- **Does delete actually remove the row?** (so the next page load computes cost/km without it)
- **Does edit actually persist the changed cost/mileage?** (so the next page load sees correct values)
- **Does the API return success/error correctly?** (so the client knows to reload)
- **Does the mileage-below-baseline guard fire on edit?** (prevents invalid data that would corrupt cost/km)

### 4. Testing Architecture: Direct Handler Calls

**Handler signature**: `export const POST: APIRoute = async (context) => Response`

Handlers are plain async functions. Call directly with a mocked context:

```typescript
const response = await PUT({
  locals: { user: mockUser },
  request: new Request("http://test/api/repairs/r1", {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  }),
  cookies: mockCookies,
  params: { id: "r1" },
  // redirect, url, etc.
} as unknown as APIContext);
```

**Mock surface**: `createClient` from `@/lib/supabase` → `vi.mock("@/lib/supabase")`. Return a stub with chainable `.from().select().eq().single()` that resolves to controlled data.

**FormData endpoints** (POST repairs, POST vehicles) use `context.request.formData()` and return `context.redirect()`. Testing these requires:
- A `Request` constructed with `FormData` body
- A mock `context.redirect()` that captures the URL
- Asserting the redirect URL (including `?error=` or `?success=` params)

**JSON endpoints** (PUT/PATCH/DELETE repairs, all service-thresholds) use `context.request.json()` and return `Response.json()`. Testing these is simpler:
- A `Request` with JSON body
- Assert `response.status` and `await response.json()`

**classifyRepair dependency**: POST and PUT repairs call `classifyRepair()` from `@/lib/classifyRepair`. Mock this to return a known category or null.

## Code References

- `src/lib/supabase.ts:5-24` — Supabase client factory (anon key, cookie-based session)
- `src/lib/schemas.ts:1-63` — All zod schemas
- `src/lib/costPerKm.ts:8-14` — `computeCostPerKm` (client-side only, never in API endpoints)
- `src/middleware.ts:7-13` — User resolution from session cookie
- `src/pages/api/repairs.ts:8-73` — POST repair (FormData, redirect-based)
- `src/pages/api/repairs/[id].ts:8-89` — PUT repair (JSON, belt-and-suspenders ownership)
- `src/pages/api/repairs/[id].ts:91-125` — DELETE repair (ownership check + delete)
- `src/pages/api/repairs/[id].ts:127-179` — PATCH repair category (JSON, ownership check)
- `src/pages/api/vehicles.ts:5-43` — POST vehicle (FormData, redirect-based)
- `src/pages/api/service-thresholds.ts:8-62` — POST threshold (JSON, car ownership via filtered query)
- `src/pages/api/service-thresholds/[id].ts:8-73` — PUT threshold (JSON, ownership check)
- `src/pages/api/service-thresholds/[id].ts:75-113` — DELETE threshold (ownership check + 204)
- `supabase/migrations/20260526120000_create_cars_table.sql` — Cars table, RLS SELECT+INSERT only
- `supabase/migrations/20260531120000_create_repairs_table.sql` — Repairs table, RLS SELECT+INSERT
- `supabase/migrations/20260602120000_add_repairs_update_delete_policies.sql` — Repairs UPDATE+DELETE policies
- `supabase/migrations/20260608120000_create_service_thresholds_table.sql` — Thresholds table, full RLS
- `src/env.d.ts:1-5` — `App.Locals` type (`user: User | null`)

## Architecture Insights

1. **Belt-and-suspenders**: Every endpoint enforces ownership at app layer AND relies on RLS. Tests should verify the app layer (mock Supabase to return another user's record → expect 403) because RLS is a DB-level concern better tested against real Supabase.

2. **Two response patterns**: FormData endpoints redirect; JSON endpoints return structured responses. Integration tests must handle both patterns.

3. **No server-side recalculation**: Cost/km, trend data, and reminder status are all computed during SSR page rendering, not during API mutations. This simplifies Risk #5 tests — verify the mutation persists correct data, not that a computation is triggered.

4. **Mileage guard is app-layer only**: The `mileage >= baseline_mileage` check exists only in repairs POST (line 46) and PUT (line 57). It's not a DB constraint. Tests must cover this.

5. **Missing cars UPDATE/DELETE RLS**: No UPDATE or DELETE policies on the `cars` table. Currently no API endpoint exposes car edit/delete, but if one is added, the RLS gap would be real.

## Historical Context

- `context/changes/testing-unit-domain-logic/` — Phase 1 tests established the Vitest setup, factory helpers (`makeVehicle`, `makeRepair`), and test patterns. Integration tests should reuse factories and follow same naming conventions.
- `context/archive/` — No archived changes relevant to testing API auth/validation.

## Risk Response Guidance — Verified and Corrected

### Risk #1 (IDOR / RLS bypass)

- **Test-plan guidance**: "User A's API call returns zero rows / 403 when targeting User B's car_id" — **CONFIRMED**
- **Correction**: RLS is the real enforcement layer, but since we mock Supabase, we test the **app-layer check**. The test proves: when `.select().single()` returns a record with `user_id !== authenticated user`, the endpoint returns 403 (or 404 for car lookups).
- **Endpoints to test**: All 7 mutation endpoints (repairs POST/PUT/DELETE/PATCH, thresholds POST/PUT/DELETE, vehicles POST)
- **Anti-pattern confirmed**: Don't test only "owner sees own data." Must assert cross-user denial.

### Risk #3 (Crafted input bypasses validation)

- **Test-plan guidance**: "API returns 400 with structured error for invalid input; never persists bad data" — **CONFIRMED**
- **Correction**: FormData endpoints (POST repairs, POST vehicles) return **redirects with error params**, not JSON 400. Tests must assert redirect URL contains error. JSON endpoints return `{ error }` with 400.
- **Key payloads to test**: Negative cost, zero cost, mileage below baseline, empty description, description > 500 chars, missing required fields, invalid JSON body, threshold with neither km_interval nor days_interval
- **Anti-pattern confirmed**: Don't test zod schema in isolation. Send bad payload through the handler.

### Risk #5 (Delete/edit corrupts data)

- **Test-plan guidance**: "After delete, cost/km reflects the removal" — **REFRAMED**
- **Correction**: No server-side cost/km computation exists. Test narrows to: (a) delete calls `.delete().eq("id", ...)` on Supabase, (b) edit calls `.update()` with correct fields, (c) mileage-below-baseline guard fires, (d) conditional re-classification on description change works correctly. The "cost/km reflects removal" is a client-side rendering concern, not an API test.
- **Anti-pattern**: Don't assert computed cost/km in API response — it doesn't exist there.

## Open Questions

1. **Should FormData endpoints (POST repairs, POST vehicles) be included in integration tests?** They return redirects, not JSON — more complex to assert. Could defer to e2e. But they still have ownership checks and validation worth testing.
2. **Cars UPDATE/DELETE RLS gap** — No policies exist. No API endpoint currently exposes these operations. Worth noting in test-plan but not testing now.
3. **Auth endpoints (signin/signup)** — No zod validation, delegated to Supabase. Testing these requires real Supabase or deep mocking of `supabase.auth`. Likely not worth the cost for this rollout phase.

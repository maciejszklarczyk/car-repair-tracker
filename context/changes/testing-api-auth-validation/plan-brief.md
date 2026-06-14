# API Authorization & Input Validation Integration Tests — Plan Brief

> Full plan: `context/changes/testing-api-auth-validation/plan.md`
> Research: `context/changes/testing-api-auth-validation/research.md`

## What & Why

Integration tests for all 7 API mutation endpoints, verifying that ownership enforcement (IDOR prevention), input validation (zod rejection of bad payloads), and mutation correctness (delete/edit behavior) work as designed. This is Phase 2 of the test-plan rollout, covering risks #1, #3, and #5.

## Starting Point

Vitest configured with path alias and two unit test files covering domain logic (Phase 1 complete). Zero API endpoint tests exist. All endpoints have belt-and-suspenders ownership (app-layer + RLS) and zod validation, but nothing verifies these at the integration level.

## Desired End State

Every API mutation endpoint has tests proving: unauthenticated requests are denied, cross-user requests get 403/404, invalid payloads are rejected before DB writes, and valid mutations call Supabase correctly. Test-plan cookbook §6.2/§6.3 filled in with the established pattern.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|-------------------|--------|
| Endpoint scope | All 7 (including FormData) | Full risk coverage in one pass; redirect assertions are manageable | Plan |
| Test file layout | Flat under `src/pages/api/__tests__/` | Less nesting, all API tests discoverable in one dir | Plan |
| Shared helpers | `src/test/helpers.ts` | One mock shape to maintain; reusable across all test files | Plan |
| Mock strategy | Stub Supabase client at module level | No real DB needed; test app-layer checks directly | Research |
| Risk #5 scope | Mutation correctness only | Cost/km is client-side only — no server recalculation to test | Research |

## Scope

**In scope:** 7 endpoints (POST/PUT/DELETE/PATCH repairs, POST vehicles, POST/PUT/DELETE service-thresholds), auth denial, validation rejection, happy-path mutations, AI re-classification behavior, mileage-below-baseline guard

**Out of scope:** RLS testing against real DB, auth endpoints (signin/signup), client-side cost/km recalculation, E2E browser tests, CI wiring (Phase 3)

## Architecture / Approach

Tests call exported handler functions directly (`PUT`, `DELETE`, `POST`, `PATCH`) with a fabricated `APIContext`. The Supabase client is mocked via `vi.mock("@/lib/supabase")` — each test controls what `.from().select().single()` returns. Two assertion patterns: JSON endpoints check `response.status` + `response.json()`, FormData endpoints check captured redirect URLs.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Test Infrastructure | Supabase mock, APIContext factory, smoke test | Mock chain doesn't match real Supabase client shape |
| 2. JSON Endpoint Tests | 5 endpoints: auth + validation + behavior | ~25 test cases across 3 files |
| 3. FormData Endpoint Tests | 2 endpoints: redirect-based assertions | Different assertion pattern (redirect URLs, query params) |
| 4. Cookbook Update | §6.2 and §6.3 filled in | Must accurately reflect the patterns established |

**Prerequisites:** Vitest configured (Phase 1 complete), existing factories reusable
**Estimated effort:** ~2-3 sessions across 4 phases

## Open Risks & Assumptions

- Mock Supabase chain must faithfully represent the real client's chainable API — if shapes diverge, tests pass but production breaks
- `astro:env/server` import in `classifyRepair` may need special mock handling in Vitest
- FormData `context.redirect()` behavior depends on Astro internals — may need to check what `redirect()` actually returns

## Success Criteria (Summary)

- `npx vitest run` exits 0 with all integration tests passing
- Every mutation endpoint has auth, validation, and happy-path coverage
- Test-plan §6.2/§6.3 cookbook patterns accurately describe how to add tests

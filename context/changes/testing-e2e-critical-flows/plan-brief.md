# E2E Tests for Data Isolation and Repair Lifecycle — Plan Brief

> Full plan: `context/changes/testing-e2e-critical-flows/plan.md`
> Research: `context/changes/testing-e2e-critical-flows/research.md`

## What & Why

Add Playwright E2E tests covering test-plan.md Phase 4: Risk #1 (one user accessing another's data via RLS bypass) and Risk #5 (repair mutations silently corrupting cost/km). Integration tests mock Supabase and never hit real RLS policies — these E2E tests prove data isolation and recalculation work end-to-end through real browser + real database.

## Starting Point

Playwright v1.61 installed with config, single-user auth setup (`auth.setup.ts`), and a seed spec testing vehicle creation. One test user in `supabase/seed.sql`. No cross-user tests, no repair lifecycle tests, no CI e2e job.

## Desired End State

Two E2E test files pass against local Supabase: data isolation (User B can't see/modify User A's data) and repair lifecycle (add/edit/delete with correct cost/km recalculation). CI runs E2E tests with a local Supabase instance on every push/PR.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Second user setup | Extend auth.setup.ts with two storageState files | Reuses existing pattern; Playwright handles context switching natively. | Plan |
| Cross-user scope | Vehicle list + repair API (3-4 assertions) | Covers read + write paths; service_thresholds has identical RLS — diminishing returns. | Plan |
| Lifecycle mutations | Add + edit cost + delete, verify cost/km each time | One flow proves all three mutations trigger recalculation end-to-end. | Plan |
| DB cleanup | Test teardown deletes own data | Self-contained tests, no full DB reset needed between runs. | Plan |
| CI approach | Supabase CLI in Docker + Playwright in GH Actions | Real RLS enforcement in CI; no hosted test project needed. | Plan |

## Scope

**In scope:**
- Second test user in seed.sql + auth setup
- Data isolation E2E test (Risk #1)
- Repair lifecycle E2E test (Risk #5)
- `npm run e2e` script
- CI e2e job with Supabase

**Out of scope:**
- Vehicle edit/delete testing (not exposed in the app)
- Service thresholds cross-user testing (identical RLS pattern)
- AI classification E2E (excluded in test-plan.md §7)
- Visual regression testing

## Architecture / Approach

Tests use Playwright's `browser.newContext({ storageState })` for multi-user scenarios. Each test creates unique data (timestamp-suffixed), asserts against SSR-rendered DOM text (cost/km is computed server-side in Astro frontmatter), and cleans up in teardown. CI starts a local Supabase via Docker, seeds it, then runs Playwright against the dev server.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Two-user auth infrastructure | Second test user, storageState files, npm script | Auth setup regression breaks existing seed.spec.ts |
| 2. Data isolation test (Risk #1) | Cross-user vehicle + repair isolation assertions | Flaky if Supabase is slow to propagate RLS |
| 3. Repair lifecycle test (Risk #5) | Add/edit/delete with 3 cost/km assertions | Long test (~15-20s); cost/km DOM selector may need tuning |
| 4. CI integration | E2E job in GitHub Actions with Supabase | Supabase Docker startup adds ~2-3 min to CI |

**Prerequisites:** Local Supabase running (`supabase start`), Playwright browsers installed
**Estimated effort:** ~2 sessions across 4 phases

## Open Risks & Assumptions

- Supabase startup in CI may be slow or flaky on GitHub-hosted runners (Docker-in-Docker)
- Test user creation in seed.sql assumes `supabase db reset` is the primary DB setup method
- Cost/km DOM text format assumed to be `{value.toFixed(2)} PLN/km` — may need adjustment if UI changed

## Success Criteria (Summary)

- Two E2E tests pass locally and in CI, each tied to a test-plan.md risk
- Data isolation test fails if RLS is disabled (deliberate-break verified)
- Repair lifecycle test verifies three distinct cost/km values across add/edit/delete

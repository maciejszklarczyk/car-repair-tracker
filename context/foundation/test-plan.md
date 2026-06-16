# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-12

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   \<area\>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                        | Impact | Likelihood | Source (evidence — not anchor)                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | One owner reads/modifies another owner's cars, repairs, or thresholds via crafted API request (IDOR / RLS bypass)                              | High   | High       | PRD NFR "authorization integrity", interview Q1+Q2 (burned by RLS gaps before), hot-spot `src/pages/api/` (13 commits/30d) |
| 2   | Cost/km shows wrong number after repair add/edit/delete due to formula edge case (zero km, no costed repairs, baseline equals current mileage) | High   | High       | PRD FR-007, interview Q3 (low confidence in cost/km logic), hot-spot `src/lib/` (18 commits/30d)                           |
| 3   | API accepts crafted input that client-side validation would reject (missing/malformed fields, negative cost, injection in description)         | High   | Medium     | PRD NFR, abuse lens — zod schemas exist but zero tests verify server rejects bad input                                     |
| 4   | Mileage tracking regresses — MAX(mileage) logic breaks on edge cases (no repairs, mileage below baseline) producing wrong cost/km downstream   | High   | Medium     | Roadmap S-08 "fix-mileage-tracking" (already fixed once = fragility signal), hot-spot `src/lib/` (18 commits/30d)          |
| 5   | Repair delete/edit silently corrupts data or fails to trigger cost/km recalculation                                                            | High   | Medium     | PRD FR-006, hot-spot `src/pages/api/repairs/` (7 commits/30d)                                                              |
| 6   | Service reminder shows false positive/negative due to margin calculation bug (km or date threshold off-by-one, missing interval)               | Medium | Medium     | PRD FR-008/FR-009/US-03, roadmap S-06 risk note "requires precise unit tests"                                              |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                      | Must challenge                                                                                                        | Context `/10x-research` must ground                                                                       | Likely cheapest layer                             | Anti-pattern to avoid                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| #1   | User A's API call returns zero rows / 403 when targeting User B's car_id                                                         | "Authenticated = authorized" — being logged in does NOT mean you own the resource                                     | RLS policies per table, ownership column, how API resolves user from context                              | integration (API call with two test users)        | Testing only happy-path "owner sees own data" without cross-user assertion                |
| #2   | cost/km returns `null` (not 0, not NaN, not crash) when km=0 or no costed repairs; returns correct ratio for normal case         | "The formula works because it looks right" — edge cases (baseline=current, all repairs cost-free) are where it breaks | `computeCostPerKm` inputs/outputs, Vehicle and Repair shapes                                              | unit                                              | Copying the production formula into the test as expected value (oracle problem)           |
| #3   | API returns 400 with structured error for invalid input; never persists bad data                                                 | "Zod catches it" — but does the endpoint actually use the schema, and does it reject before DB write?                 | Which endpoints parse input, where zod is called, what happens on validation failure                      | integration (send bad payloads, assert rejection) | Testing only that zod schema exists without sending actual bad input through the endpoint |
| #4   | `computeCurrentMileage` returns baseline when repairs=[], returns max(repairs.mileage, baseline) otherwise — never NaN/undefined | "S-08 already fixed this" — fixes that lack tests regress silently                                                    | computeCurrentMileage signature, edge cases for empty array and mileage below baseline                    | unit                                              | Testing only the happy path (3 repairs with ascending mileage)                            |
| #5   | After delete, cost/km reflects the removal; after edit, changed cost propagates; no orphan records                               | "Delete works because the UI confirmed it" — what if the recalculation is stale or the cascade is incomplete?         | Delete endpoint flow, how cost/km is recomputed, whether server-side or client-side                       | integration                                       | Asserting only HTTP 200 without checking the downstream cost/km value                     |
| #6   | Reminder fires when mileage is within margin; does NOT fire when outside margin; handles missing interval gracefully             | "The formula is simple arithmetic" — but km-only vs date-only vs both thresholds have distinct paths                  | Reminder computation function, how margin is applied, how missing km_interval or days_interval is handled | unit                                              | Testing only one threshold type (km) and assuming date works the same way                 |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                     | Goal (one line)                                                                         | Risks covered | Test types  | Status      | Change folder             |
| --- | ------------------------------ | --------------------------------------------------------------------------------------- | ------------- | ----------- | ----------- | ------------------------- |
| 1   | Unit tests on domain logic     | Bootstrap Vitest + defend core formulas (cost/km, mileage, reminders) at cheapest layer | #2, #4, #6    | unit        | complete    | testing-unit-domain-logic |
| 2   | API authorization + validation | Defend data isolation and input validation with integration tests against API endpoints | #1, #3, #5    | integration | complete | testing-api-auth-validation |
| 3   | Quality gates wiring           | Lock the test floor in CI — fail PR on test regression                                  | cross-cutting | CI gates    | complete    | testing-quality-gates     |
| 4   | E2E critical flows             | Prove data isolation and repair lifecycle work end-to-end through real browser + DB      | #1, #5        | e2e         | implementing | testing-e2e-critical-flows |

## 4. Stack

| Layer       | Tool   | Version                | Notes                                                                               |
| ----------- | ------ | ---------------------- | ----------------------------------------------------------------------------------- |
| unit        | Vitest | none yet — see Phase 1 | Natural fit for Astro + TS project; fast, ESM-native                                |
| integration | Vitest | none yet — see Phase 2 | Same runner for unit + integration; API endpoint tests                              |
| e2e         | Playwright | 1.61               | Browser-level tests for cross-boundary risks that integration tests can't fully prove (real RLS, real UI recalc) |

**Stack grounding tools (current session):**

- Docs: Context7 (`resolve-library-id` → `query-docs`) — available for Vitest/Astro test setup; checked: 2026-06-12
- Search: Exa.ai (`web_search_exa`) — available for discovery; checked: 2026-06-12
- Runtime/browser: none — no Playwright MCP in session
- Provider/platform: none — no Supabase/GitHub MCP for live queries

## 5. Quality Gates

| Gate               | Where      | Required?                    | Catches                                |
| ------------------ | ---------- | ---------------------------- | -------------------------------------- |
| lint + typecheck   | local + CI | required (already wired)     | syntactic / type drift                 |
| unit tests         | local + CI | required after §3 Phase 1    | domain logic regressions               |
| integration tests  | local + CI | required after §3 Phase 2    | authorization / validation regressions |
| coverage threshold | CI on PR   | recommended after §3 Phase 3 | test floor erosion                     |
| e2e tests          | CI on PR   | required after §3 Phase 4    | cross-boundary regressions (RLS, UI recalc) |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test

**Location:** `src/lib/__tests__/<module>.test.ts`

**Naming:** Test file mirrors source module name — `costPerKm.ts` → `costPerKm.test.ts`.

**Pattern:** Create typed factory helpers (`makeVehicle`, `makeRepair`, `makeThreshold`) with sensible defaults and `Partial<T>` overrides. Use hand-calculated oracle values, not the production formula. Pin `today` via constructor (`new Date("2024-06-01T12:00:00Z")`) to avoid time-dependent flakes.

**Reference tests:** `src/lib/__tests__/costPerKm.test.ts`, `src/lib/__tests__/serviceReminders.test.ts`

**Run:** `npm run test` (single run) or `npm run test:watch` (watch mode).

### 6.2 Adding an integration test

**Location:** `src/pages/api/__tests__/<endpoint>.test.ts`

**Naming:** Test file mirrors the endpoint file — `repairs/[id].ts` → `repairs-id.test.ts`, `service-thresholds.ts` → `service-thresholds.test.ts`.

**Mock setup:** Import `"./setup"` at the top of each test file. This activates `vi.mock` for `@/lib/supabase`, `@/lib/classifyRepair`, and `astro:env/server`. Import `mockResult` (single result) or `mockResults` (FIFO queue for multi-step handlers) from `"./setup"` to control Supabase responses per test. Import `createMockContext` and entity factories from `@/test/helpers`.

**Assertion patterns — JSON endpoints:** Assert `response.status` and destructure `await response.json()` with a type cast: `const body = (await res.json()) as { error: string }`.

**Assertion patterns — FormData endpoints:** Assert `response.status === 302` and check `response.headers.get("Location")` for redirect target and URL-encoded error/success params (`%20` encoding, not `+`).

**Reset:** Call `vi.clearAllMocks()` and `mockResult({ data: null, error: null })` in `beforeEach` to reset mock state between tests.

**Reference tests:** `src/pages/api/__tests__/repairs-id.test.ts` (JSON), `src/pages/api/__tests__/repairs.test.ts` (FormData)

**Run:** `npm run test` (single run) or `npm run test:watch` (watch mode).

### 6.3 Adding a test for a new API endpoint

Every new API mutation endpoint gets three test groups:

1. **Auth** — unauthenticated (`user: null` → 401 or redirect to `/auth/signin`) + cross-user (resource owned by `"user-2"`, request from `"user-1"` → 403 or redirect with error).
2. **Validation** — invalid JSON/FormData → 400 or redirect with error; missing required fields; out-of-range values (negative cost, mileage below baseline, future year); zod `.refine()` edge cases (e.g., at least one interval required).
3. **Happy path** — valid input with owned resource → success response + correct Supabase method called.

**For JSON endpoints:** Use `new Request(url, { method, body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } })`. Assert status codes and JSON body.

**For FormData endpoints:** Build `FormData`, set fields as strings (handlers coerce with `Number()`). Assert redirect status (302) and `Location` header content.

**Multi-step Supabase calls:** Use `mockResults([...])` to queue results in order — e.g., first call returns the resource for ownership check, second returns the car for baseline mileage, third returns the mutation result.

### 6.4 Adding an E2E test

**Location:** `e2e/<risk-or-flow>.spec.ts`

**Naming:** Test file named after the risk or flow it covers — `data-isolation.spec.ts`, `repair-lifecycle.spec.ts`.

**Auth setup:** Two test users seeded in `supabase/seed.sql` (`test@test.com` and `test2@test.com`). Auth sessions are created by `e2e/auth.setup.ts` and saved as `auth-user-a.json` / `auth-user-b.json`. Default Playwright project uses User A via `storageState: "auth-user-a.json"`. For cross-user tests, create a second browser context: `browser.newContext({ storageState: "auth-user-b.json" })`.

**Data isolation pattern:** User A creates data, User B attempts to access it and gets empty/error. Use `page.request.fetch()` for API-level cross-user assertions inside a browser context.

**Cleanup:** Each test creates unique data (timestamp-suffixed names) and deletes it in teardown via UI or API. Orphan data from crashed tests is harmless due to unique names.

**Locators:** Prefer `getByRole` / `getByLabel` / `getByText`. Use `getByTestId` only when accessibility attributes are ambiguous. Never CSS selectors or XPath.

**Waits:** Never `page.waitForTimeout()`. Wait for state: `toBeVisible()`, `waitForURL()`, `waitForResponse()`.

**Reference tests:** `e2e/data-isolation.spec.ts` (cross-user isolation), `e2e/repair-lifecycle.spec.ts` (mutation + recalculation).

**Run:** `npm run e2e` (all specs) or `npm run e2e -- e2e/<file>.spec.ts` (single spec).

**CI:** E2E tests run in a dedicated `e2e` job in `.github/workflows/ci.yml` with a local Supabase instance started via `supabase start` + `supabase db reset`.

### 6.5 Per-rollout-phase notes

(Filled in as phases land.)

## 7. What We Deliberately Don't Test

- **AI classification accuracy** — Gemini output is non-deterministic; testing exact category assignments is fragile and low-signal. Test the fallback/timeout path (repair saves with `pending`), not the quality of Gemini's answer. Re-evaluate if classification provider changes or accuracy becomes a user complaint. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-15
- Stack versions last verified: 2026-06-15
- AI-native tool references last verified: n/a (none used)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.

# Reactive Cost/km & Mileage After Repair Delete — Plan Brief

> Full plan: `context/changes/reactive-cost-km/plan.md`
> Research: `context/changes/reactive-cost-km/research.md`

## What & Why

GH #49: after deleting a repair via `RepairList`'s local-state delete, the vehicle detail page's mileage, cost/km, and Cost Trends chart go stale until the user reloads. These are server-rendered once at page load, outside the React island that handles delete. Fix: make them reactive without a reload.

## Starting Point

`RepairList` is a `client:load` island that removes the deleted repair from its own local `useState` on successful `DELETE` — no other part of the page hears about it. The header stats and chart are static Astro markup / separately-mounted islands computed once server-side from `getVehiclePageData`. The calculation logic itself (`computeCurrentMileage`, `computeCostPerKm`, chart trend functions in `src/lib/costPerKm.ts`) is already pure and reused server-side — no new business logic needed, just a way to re-run it client-side and share the result across islands.

## Desired End State

Deleting a repair updates Mileage, Cost/km, and the Cost Trends chart immediately, with no page reload — matching what a reload would show today. `e2e/repair-lifecycle.spec.ts` proves this directly (no `page.reload()` before the final assertion).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Include mileage staleness, not just cost/km | Fix both | Same root cause, same header block, computeCurrentMileage already reusable — near-zero extra cost | Plan (Q&A) |
| Include Cost Trends chart | In scope | Same "computed once server-side" staleness bug; leaving it out just defers an identical follow-up issue | Plan (Q&A) |
| Cross-island reactivity mechanism | Shared store, no page reorder | Header/chart/list aren't DOM-adjacent (Service Reminders sits between them), so one merged island can't span them; a dependency-free `useSyncExternalStore` singleton avoids both reordering the UI and adding a new state-management package | Plan (research + Q&A) |
| Chart visibility threshold (<2 points) | Computed client-side, hides immediately | Matches today's server-side behavior exactly, now re-evaluated after delete | Plan (Q&A) |
| E2E test update | Update in this change | Test currently reloads before asserting — leaving it as-is would mean the e2e suite never actually proves the fix works | Plan (Q&A) |

## Scope

**In scope:**
- Cross-island `useSyncExternalStore`-based store for shared `repairs` state
- Reactive mileage + cost/km header (`VehicleStatsHeader`)
- Reactive Cost Trends chart section (`ReactiveCostTrends`), including client-side visibility threshold
- `RepairList` refactor to write deletes into the shared store
- Unit tests for the new store and components; e2e test update

**Out of scope:**
- Service Reminders / Service Thresholds reactivity (different data dependency, not part of GH #49)
- Reordering the page's visual section order
- Any new state-management dependency (Nanostores etc.)
- Changes to add/edit repair flows (still full-redirect, already correct)

## Architecture / Approach

Three independently-mounted `client:load` islands (header, chart, `RepairList`) at their current DOM positions, all reading from one module-scoped singleton store seeded from the same server-provided `repairs` array. `RepairList` calls `deleteRepair(id)` into the store instead of local `setState`; the header and chart re-render via `useSyncExternalStore` subscription. All three reuse the existing pure functions in `src/lib/costPerKm.ts` — the same functions the server already calls — so there's no duplicated business logic.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Store + reactive header | Store hook, `VehicleStatsHeader`, `RepairList` refactored to use it — fixes the primary GH #49 symptom | Store singleton correctness across island mount order |
| 2. Reactive Cost Trends chart | `ReactiveCostTrends` wrapper wired to the same store, client-side visibility threshold | Threshold logic must exactly match today's server-side behavior |
| 3. Test coverage + regression | Unit tests for store/header/chart, updated e2e test, full regression pass | Store singleton leaking state between test cases if reset is missed |

**Prerequisites:** None beyond the current codebase — no new dependencies, no schema changes, no local Supabase changes required beyond what's already running for e2e.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- Assumes no client-side SPA routing is ever added to this app (module-singleton store relies on one JS module graph per full page load). If SPA routing is introduced later, the store needs a reset-on-navigation hook.
- Assumes all three islands always receive the identical `repairs` array from the same `getVehiclePageData` call (true today) — if that ever diverges, first-mount seeding could pick up stale data.

## Success Criteria (Summary)

- Deleting a repair updates Mileage, Cost/km, and the Cost Trends chart immediately, with zero reloads.
- `e2e/repair-lifecycle.spec.ts` passes without `page.reload()` before the final delete assertion.
- No regressions in add/edit flows or the Service Reminders / Service Thresholds sections.

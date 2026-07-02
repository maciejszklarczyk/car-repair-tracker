<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Reactive Cost/km & Mileage After Repair Delete

- **Plan**: context/changes/reactive-cost-km/plan.md
- **Mode**: Deep
- **Date**: 2026-07-02
- **Verdict**: SOUND (after fixes)
- **Findings**: 1 critical, 0 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL (fixed) |
| Plan Completeness | WARNING (fixed) |

## Grounding
6/6 paths ✓, 6/6 symbols ✓, brief↔plan ✓

## Findings

### F1 — useSyncExternalStore hits SSR wrong on standalone Node server

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes
- **Dimension**: Blind Spots
- **Location**: Phase 1, item 1 (`useRepairsStore.ts` contract)
- **Detail**: Plan's module-singleton store assumed one page load = one JS context. False on the server: (1) `useSyncExternalStore` throws during SSR without `getServerSnapshot`, and Astro server-renders `client:load` islands' initial HTML; (2) `@astrojs/node` standalone is one long-lived process serving many requests — a module singleton is per-process, not per-request, risking cross-user/cross-vehicle data leaks.
- **Fix**: Store is client-only. On server (`typeof window === "undefined"`), `useRepairsStore` returns `[initialRepairs, () => {}]` directly, bypassing the singleton and `useSyncExternalStore`. Client-side, real `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` with `getServerSnapshot` returning `initialRepairs`.
- **Decision**: FIXED — applied to plan.md (Phase 1 store contract + added manual verification 1.8 for two-tab cross-vehicle check).

### F2 — VehicleStatsHeader markup contract left to implementer's judgment

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, fix is obvious
- **Dimension**: Plan Completeness
- **Location**: Phase 1, item 2 (`VehicleStatsHeader` contract)
- **Detail**: Contract left the Astro/React split for the Year span ambiguous ("as needed" / implementer's choice).
- **Fix**: Fold Year + the whole flex row into `VehicleStatsHeader` rather than splitting it across the Astro/React boundary.
- **Decision**: FIXED — applied to plan.md (Phase 1, item 2 contract).

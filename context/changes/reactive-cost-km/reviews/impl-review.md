<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Reactive Cost/km & Mileage After Repair Delete

- **Plan**: context/changes/reactive-cost-km/plan.md
- **Scope**: Full plan (Phase 1, 2, 3 — all complete)
- **Date**: 2026-07-02
- **Verdict**: NEEDS ATTENTION (pre-triage) → all findings fixed post-triage
- **Findings**: 0 critical, 2 warnings, 1 observation — all 3 FIXED

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Mandated SSR isolation guard missing from shared store

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality / Plan Adherence
- **Location**: src/components/hooks/useRepairsStore.ts:18-37
- **Detail**: plan.md's "SSR safety (required)" clause (lines 65-68) mandates: if `typeof window === "undefined"`, `useRepairsStore` must return `[initialRepairs, () => {}]` directly — no `useSyncExternalStore` call, no singleton read/write — specifically to prevent two concurrent requests for different vehicles from sharing state through this module-scoped singleton on the single long-lived `@astrojs/node` process. The shipped code has no such branch; it unconditionally calls `useSyncExternalStore(subscribe, getSnapshot, () => initialRepairs)` on every render. It is very likely safe today only because React's SSR render path for `useSyncExternalStore` calls `getServerSnapshot` and never invokes `subscribe`/`getSnapshot` — but that safety is now an implicit dependency on a React internal-dispatch detail rather than an explicit, testable guard. No automated test proves cross-request isolation (the plan called only for a manual two-tabs smoke check, item 1.8, still unchecked). A future React upgrade, a streaming/Suspense boundary, or a different SSR entry path could silently reintroduce a cross-user data leak.

  Fix A ⭐ Recommended: Add the explicit `typeof window === "undefined"` early return the plan mandated.
    Strength: Matches the plan's required contract exactly; makes the isolation guarantee explicit and independent of React SSR internals; trivial diff.
    Tradeoff: One extra branch/line; slightly more code to maintain.
    Confidence: HIGH — this is literally the plan's specified fix, already fully designed.
    Blind spot: None significant.

  Fix B: Keep current implementation, but explicitly document the reliance on React's server/client `useSyncExternalStore` dispatch in a code comment, add a regression test using `react-dom/server`'s `renderToString` twice with different `initialRepairs` to prove no cross-call contamination, and update plan.md's "required" language to reflect the conscious decision.
    Strength: Avoids a redundant branch if the team is confident in React's guarantee.
    Tradeoff: Leaves safety resting on an internal API contract that isn't part of React's public guarantees; requires writing a new SSR-specific test the plan didn't originally scope.
    Confidence: MEDIUM — functionally correct under current React 19 behavior, but more fragile long-term than Fix A.
    Blind spot: Whether Astro's island SSR entry point always goes through the standard `renderToStaticMarkup`/`renderToString` path in every deployment configuration hasn't been independently verified.

- **Decision**: FIXED via Fix A. `useRepairsStore.ts` now checks `typeof window === "undefined"` explicitly (in `subscribe`, `getSnapshot`, `deleteRepair`) and short-circuits to server-safe no-ops without touching the module singleton. `npm run test`, `npm run astro check`, `npm run lint` all pass after the change.

### F2 — subscribe/getSnapshot recreated every render, causing resubscription churn

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/hooks/useRepairsStore.ts:19-29
- **Detail**: `subscribe`, `getSnapshot`, and the `getServerSnapshot` arg are redefined as new closures on every call to `useRepairsStore`, i.e. every render of every consuming component. Since `useSyncExternalStore` re-subscribes when the `subscribe` reference changes, this causes an unsubscribe/resubscribe cycle on every render of `VehicleStatsHeader`, `ReactiveCostTrends`, and `RepairList` — not just on mount. Currently harmless (the `listeners` Set stays correct) but wasteful, and fragile if subscribe/unsubscribe timing ever matters.

  Fix: Hoist `getSnapshot` and `subscribe` to true module-level functions (they only need the module-scoped `repairs`/`listeners`, not `initialRepairs`); keep only `getServerSnapshot` as a per-call closure since it genuinely needs `initialRepairs`.

- **Decision**: FIXED. `getSnapshot`/`subscribe` hoisted to module level (stable references across renders); `getServerSnapshot` remains a per-call `() => null` closure with `?? initialRepairs` fallback on the returned snapshot. All tests/typecheck/lint pass.

## Observations

### F3 — Server still computes now-unused chart/cost fields on every page load

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/services/vehiclePageData.ts:66-70,76-80 (not in this change's file contract)
- **Detail**: `costPerKm`, `chartData`, `totalCostData`, and `mileageData` are still computed server-side in `getVehiclePageData` but `[id].astro` no longer destructures or renders them directly (only `currentMileage` remains needed, for `computeThresholdSummary`). Now dead computation on every page load since the client recomputes the same values from the shared store. Correctly out of this change's stated file contract (`vehiclePageData.ts` isn't touched), so not a finding against the plan — just worth a follow-up cleanup ticket.

  Fix: Trim the now-unused fields from `VehiclePageData` / `getVehiclePageData` in a follow-up change.

- **Decision**: FIXED. Removed `costPerKm`, `chartData`, `totalCostData`, `mileageData` from `VehiclePageData` and `getVehiclePageData`; dropped the now-unused `computeCostPerKm`/`computeCostTrendData`/`computeTotalCostTrendData`/`computeMileageTrendData` imports. Updated `vehiclePageData.test.ts` assertions accordingly. All tests/typecheck/lint pass.

## Success Criteria Verification

- `npm run test` — PASS (109/109 tests, 14 files)
- `npm run astro check` — PASS (0 errors, 0 warnings)
- `npm run lint` — PASS (0 errors; 6 pre-existing warnings unrelated to this change)
- `npm run e2e` — not re-run in this review (requires local Supabase); already verified and checked off in Progress at commit a07e58c
- Manual verification items (1.4–1.8, 2.4–2.6, 3.5–3.6) — all still unchecked in plan.md `## Progress`; none marked complete without evidence, so no rubber-stamping concern, just pending user verification

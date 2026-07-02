# Reactive Cost/km & Mileage After Repair Delete — Implementation Plan

## Overview

Fix GH #49: after deleting a repair via `RepairList`'s local-state delete, the vehicle detail page's mileage, cost/km header, and Cost Trends chart stay stale until the user reloads. This plan makes all three reactive to delete without a full page reload, by introducing a small cross-island shared state store and reusing the existing pure calculation functions client-side.

## Current State Analysis

- `src/pages/dashboard/vehicles/[id].astro:64-76` server-renders the mileage and cost/km stats directly into static Astro markup from `getVehiclePageData`'s one-time server computation.
- `src/pages/dashboard/vehicles/[id].astro:88-102` conditionally mounts `CostTrendChart` only when `chartData.length >= 2 || totalCostData.length >= 2 || mileageData.length >= 2` — a static, server-only check.
- `src/components/repairs/RepairList.tsx:22-39` is a separate `client:load` island. Its `handleDelete` calls `DELETE /api/repairs/:id` then updates its own local `useState<Repair[]>` — no signal reaches the header or the chart.
- `src/lib/costPerKm.ts` exposes pure, framework-agnostic functions (`computeCurrentMileage`, `computeCostPerKm`, `computeCostTrendData`, `computeTotalCostTrendData`, `computeMileageTrendData`) that take `(vehicle, repairs)`/`(repairs)` and have zero server-only dependencies — safe to import client-side, and already the canonical source of truth (server calls the same functions in `src/lib/services/vehiclePageData.ts:66-70`).
- No cross-island communication pattern exists anywhere in the codebase (confirmed in `context/changes/reactive-cost-km/research.md`). Every other mutation (`EditRepairForm`, `AddServiceThresholdForm`, `EditServiceThresholdForm`) reacts via full `window.location.href` redirect, which re-triggers SSR and sidesteps this problem entirely.
- The three page regions that need to become reactive together — stats header, Cost Trends chart, repair list — are **not DOM-adjacent**: `ServiceReminders` and the Service Thresholds section sit between the chart and Repair History in the current page layout (`[id].astro:88-115`). A single React island can only hydrate one contiguous DOM subtree, so a single merged island cannot span all three without reordering the page.

## Desired End State

After deleting a repair in `RepairList`, without any page reload:
- The mileage stat and cost/km stat in the header update to reflect the remaining repairs (using the same `computeCurrentMileage`/`computeCostPerKm` logic as the server).
- The Cost Trends chart re-renders with the remaining repairs' data, and disappears entirely if fewer than 2 data points remain in all three series (matching today's server-side threshold behavior, now evaluated client-side).
- `RepairList` itself continues to remove the deleted item immediately, as it does today.

Verification: `e2e/repair-lifecycle.spec.ts` asserts the "no cost data yet" state directly after delete confirmation, with no `page.reload()` in between.

### Key Discoveries:

- `src/lib/costPerKm.ts:3-14` (`computeCurrentMileage`, `computeCostPerKm`) and `src/lib/costPerKm.ts:26-72` (trend functions) are reusable as-is client-side.
- `src/components/vehicles/CostTrendChart.tsx:39` already self-guards with `if (!hasCostPerKm && !hasTotalCost && !hasMileage) return null` — the presentational component doesn't need to change, only its data source.
- No `src/components/hooks/` directory exists yet; CLAUDE.md's "React: extract hooks to `src/components/hooks/`" convention applies here for the first time.
- `RepairList`'s existing test (`src/components/repairs/__tests__/RepairList.test.tsx`) mocks `fetch` and asserts on rendered DOM — the pattern to follow for the new/updated component tests.

## What We're NOT Doing

- Not making `ServiceReminders` / `ServiceThresholdList` reactive to repair delete (they depend on `thresholdSummary`, computed server-side from `currentMileage` — out of scope per this change; their own reactivity, if ever needed, is a separate concern).
- Not reordering the page's visual section order (header card → Cost Trends → Service Reminders → Service Thresholds → Repair History stays as-is).
- Not adding a new state-management dependency (e.g. Nanostores, Zustand, Redux). The store is a small, dependency-free module built on `useSyncExternalStore` (built into React 19, already in use).
- Not changing the add/edit repair flows — they continue to redirect via `window.location.href`, which re-triggers full SSR and is unaffected by this change.
- Not adding retry/optimistic-UI behavior to delete — delete still waits for a successful `DELETE` response before updating state, same as today.

## Implementation Approach

Introduce a small cross-island store (`src/components/hooks/useRepairsStore.ts`) built on `useSyncExternalStore`, holding the current `Repair[]` for the vehicle detail page as a module-scoped singleton, seeded once from the first island that mounts (all three islands receive the identical `repairs` array from the same `getVehiclePageData` call, so seed order doesn't matter). `RepairList` writes to the store on successful delete instead of local `useState`. Two new small components — `VehicleStatsHeader` (mileage + cost/km) and `ReactiveCostTrends` (the chart section, including its own visibility threshold) — read from the same store and recompute via the existing pure functions in `src/lib/costPerKm.ts`. Each of the three regions stays its own `client:load` island at its current DOM position; only the shared store — not a shared DOM tree — makes them reactive together.

## Critical Implementation Details

- **Cross-island state without DOM adjacency**: Because the header, chart, and repair list are not contiguous in the page, a plain lifted-`useState` parent component (one island wrapping all three) is not possible without reordering the page — that was explicitly ruled out (see "What We're NOT Doing"). The store is a module-level singleton created once per page load and shared by whichever islands import it; this is safe because there is exactly one page load per navigation (no client-side SPA routing in this app) and all three islands are seeded from the same server-computed `repairs` array, so first-mount order doesn't affect correctness.
- **Test isolation for the singleton**: Because the store is a module-scoped singleton, tests that render more than one consuming component (or run multiple test cases) must reset it between tests, or state leaks across test cases/files. Export a `resetRepairsStore()` test-only helper from `useRepairsStore.ts` and call it in `beforeEach` in every test file that renders a store-consuming component.

## Phase 1: Shared repairs store + reactive header stats

### Overview

Introduce the cross-island store and make the mileage/cost-per-km header reactive to delete. This alone resolves the primary GH #49 symptom.

### Changes Required:

#### 1. Cross-island repairs store

**File**: `src/components/hooks/useRepairsStore.ts` (new)

**Intent**: Provide a minimal, dependency-free shared store so independently-mounted islands can react to the same `repairs` state, seeded once from server-provided data.

**Contract**: Exports `useRepairsStore(initialRepairs: Repair[]): [Repair[], (id: string) => void]` — a hook returning the current repairs snapshot and a `deleteRepair` function, built on `useSyncExternalStore` over a module-scoped singleton store (create-on-first-use, seeded from whichever caller mounts first). Also exports `resetRepairsStore(): void` for test isolation (clears the singleton so the next `useRepairsStore` call reseeds fresh).

**SSR safety (required)**: The module singleton is a per-process global on this app's `@astrojs/node` standalone server (one long-lived process, not one per request), and Astro server-renders `client:load` islands' initial HTML before hydration. The hook must not touch the shared singleton during SSR:
- If `typeof window === "undefined"`, `useRepairsStore` returns `[initialRepairs, () => {}]` directly — no `useSyncExternalStore` call, no singleton read/write. This avoids both the React requirement for a `getServerSnapshot` argument (otherwise SSR throws) and the cross-request leak risk (two concurrent requests for different vehicles must never share state through this module).
- Client-side (post-hydration), use the real `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`, with `getServerSnapshot` returning `initialRepairs` (reached only in non-browser test environments where `window` exists but no store has been seeded yet, e.g. some SSR-simulating test setups).
- Manual verification for this phase should include opening two different vehicles' detail pages in separate tabs and confirming neither shows the other's data (local dev may not fully replicate prod's request concurrency, but this is a cheap smoke check).

#### 2. Reactive stats header

**File**: `src/components/vehicles/VehicleStatsHeader.tsx` (new)

**Intent**: Replace the static Astro-rendered mileage/cost-per-km spans with a small React island that recomputes both values from the shared store using the existing pure functions, so they update immediately after delete.

**Contract**: Props `{ vehicle: Vehicle; initialRepairs: Repair[] }`. Renders the whole flex row (`Year`, `Mileage`, `Cost/km` spans, same Tailwind classes/text as the current markup at `[id].astro:65-76`, including the "no cost data yet" fallback) — fold `Year` into the component too rather than splitting the row across the Astro/React boundary. Mileage and Cost/km use `computeCurrentMileage(repairs, vehicle.baseline_mileage)` and `computeCostPerKm(vehicle, repairs)` from `src/lib/costPerKm.ts`, where `repairs` comes from `useRepairsStore(initialRepairs)`.

#### 3. Vehicle detail page wiring

**File**: `src/pages/dashboard/vehicles/[id].astro`

**Intent**: Mount `VehicleStatsHeader` in place of the static mileage/cost-per-km markup, and rename `RepairList`'s prop to make explicit that it's a seed, not the live list.

**Contract**: Replace the two `<span>` elements at lines 68-76 (Cost/km) and the Mileage span at line 66 with `<VehicleStatsHeader vehicle={vehicle} initialRepairs={repairs} client:load />`, keeping the surrounding "Mileage:"/"Cost/km:" label text and Year span as static Astro markup around it as needed (or fold labels into the component — implementer's choice, must match current visual output). Change `<RepairList repairs={repairs} client:load />` (line 114) to `<RepairList initialRepairs={repairs} client:load />`. Drop `costPerKm` and `currentMileage` from the frontmatter destructure (line 26) if no longer referenced elsewhere in the template.

#### 4. RepairList uses the shared store

**File**: `src/components/repairs/RepairList.tsx`

**Intent**: Make delete write into the shared store instead of local component state, so other islands observe it.

**Contract**: Props become `{ initialRepairs: Repair[] }` (was `{ repairs: Repair[] }`). Replace the internal `useState<Repair[]>(initialRepairs)` (line 23) with `const [repairs, deleteRepair] = useRepairsStore(initialRepairs);`. In `handleDelete`, replace `setRepairs((prev) => prev.filter((r) => r.id !== repairId))` (line 31) with `deleteRepair(repairId)`. The local `deleteError` state and all dialog/UI logic are unchanged.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test`
- Type checking passes: `npm run astro check` (or `npm run build`, which runs check as part of build)
- Linting passes: `npm run lint`

#### Manual Verification:

- On a vehicle detail page with 2+ repairs, deleting a repair updates the Mileage and Cost/km header values immediately, without a page reload.
- Deleting the repair that held the current max mileage correctly lowers the displayed Mileage to the next-highest remaining repair's mileage (or baseline mileage if none remain).
- Deleting the last costed repair shows the "no cost data yet" fallback text immediately.
- Add repair and Edit repair flows (which still redirect) continue to show correct values after redirect — no regression.
- Two different vehicles' detail pages, opened in separate tabs, never show each other's repairs/mileage/cost data.

---

## Phase 2: Reactive Cost Trends chart

### Overview

Wire the Cost Trends chart into the same store so it re-renders (and hides/shows correctly) after delete, matching the header's new reactivity.

### Changes Required:

#### 1. Reactive chart wrapper

**File**: `src/components/vehicles/ReactiveCostTrends.tsx` (new)

**Intent**: Absorb the "Cost Trends" section (heading + card wrapper + `CostTrendChart`) into a single reactive island so the client-side data and the visibility threshold move together, replacing the static Astro conditional.

**Contract**: Props `{ vehicle: Vehicle; initialRepairs: Repair[] }`. Reads `repairs` via `useRepairsStore(initialRepairs)`, computes `chartData`/`totalCostData`/`mileageData` via `computeCostTrendData`/`computeTotalCostTrendData`/`computeMileageTrendData` from `src/lib/costPerKm.ts`, and renders the `<h2>Cost Trends</h2>` heading plus the card wrapper (same classes as `[id].astro:90-101`) containing `<CostTrendChart costPerKmData={chartData} totalCostData={totalCostData} mileageData={mileageData} />` only when `chartData.length >= 2 || totalCostData.length >= 2 || mileageData.length >= 2`; otherwise renders `null`.

#### 2. Vehicle detail page wiring

**File**: `src/pages/dashboard/vehicles/[id].astro`

**Intent**: Replace the static conditional chart section with the new reactive wrapper.

**Contract**: Replace the block at lines 88-102 (the `{(chartData.length >= 2 || ...) && (...)}` conditional wrapping `CostTrendChart`) with `<ReactiveCostTrends vehicle={vehicle} initialRepairs={repairs} client:load />`. Drop `chartData`, `totalCostData`, `mileageData` from the frontmatter destructure (line 26) if no longer referenced elsewhere in the template. Remove the now-unused `CostTrendChart` import (line 5) since it's only used inside `ReactiveCostTrends` now.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test`
- Type checking passes: `npm run astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- On a vehicle detail page with 2+ costed/mileage-distinct repairs, deleting a repair updates the chart's data immediately (no reload).
- Deleting repairs down to fewer than 2 data points in all three series hides the entire Cost Trends section (heading included) immediately, matching today's server-side behavior when a page loads with <2 points.
- Chart tab switching (Cost/km, Total Cost, Mileage) still works correctly after a delete has updated the data.

---

## Phase 3: Test coverage and regression pass

### Overview

Bring test coverage in line with the new store-based architecture, update the e2e test that currently encodes the old stale-then-reload behavior as expected, and run a full regression pass.

### Changes Required:

#### 1. Store unit tests

**File**: `src/components/hooks/__tests__/useRepairsStore.test.ts` (new)

**Intent**: Verify the store's core contract in isolation: seeding, delete + notify, and reset-for-tests behavior.

**Contract**: Tests cover: hook returns the seeded `initialRepairs` on first render; calling `deleteRepair(id)` removes that repair and triggers a re-render reflecting the new snapshot; a second `useRepairsStore` consumer mounted in the same test observes the same store (shared singleton) after a delete from the first; `resetRepairsStore()` clears the singleton so a subsequent `useRepairsStore(seed)` call reseeds from `seed` rather than returning stale data. Use `@testing-library/react`'s `renderHook`, matching the project's existing Vitest + Testing Library setup.

#### 2. RepairList test updates

**File**: `src/components/repairs/__tests__/RepairList.test.tsx`

**Intent**: Update the existing tests for the renamed prop and add a `beforeEach` store reset so this file's test cases don't leak store state into each other.

**Contract**: Rename `repairs={repairs}` to `initialRepairs={repairs}` in both `render(<RepairList ... />)` calls (lines 21, 44). Add `resetRepairsStore()` call inside the existing `beforeEach` block (line 12-14), imported from `@/components/hooks/useRepairsStore`. Assertions (lines 22-23, 32-36, 53-57) are unchanged — they already assert on rendered DOM, not internal state shape.

#### 3. VehicleStatsHeader tests

**File**: `src/components/vehicles/__tests__/VehicleStatsHeader.test.tsx` (new)

**Intent**: Verify the header renders correct values from seed data and updates reactively when the shared store changes externally (simulating another island's delete).

**Contract**: Tests cover: renders mileage and cost/km computed from `initialRepairs` on mount; after calling `deleteRepair` from a second `useRepairsStore` hook instance in the test (simulating `RepairList` deleting), the rendered mileage/cost-per-km values update to match `computeCurrentMileage`/`computeCostPerKm` on the reduced repair set; renders the "no cost data yet" fallback when `computeCostPerKm` returns `null`. `beforeEach` resets the store.

#### 4. ReactiveCostTrends tests

**File**: `src/components/vehicles/__tests__/ReactiveCostTrends.test.tsx` (new)

**Intent**: Verify the chart section's visibility threshold and reactivity to store changes.

**Contract**: Tests cover: renders nothing (no heading, no chart) when fewer than 2 points exist in all three series; renders the heading and `CostTrendChart` when the threshold is met; after an external `deleteRepair` call drops the count below threshold, the section disappears without a remount. `beforeEach` resets the store.

#### 5. E2E test update

**File**: `e2e/repair-lifecycle.spec.ts`

**Intent**: Update the test to prove the actual fix — the "no cost data yet" state must appear without a reload, not despite one.

**Contract**: Remove `await page.reload();` (line 112) and its preceding comment. Move the assertion at line 113 (`await expect(page.getByText("— PLN/km — no cost data yet")).toBeVisible();`) to run directly after the delete-hidden assertion at line 108, with an updated comment noting the value updates reactively without reload.

### Success Criteria:

#### Automated Verification:

- Full unit test suite passes: `npm run test`
- Type checking passes: `npm run astro check`
- Linting passes: `npm run lint`
- E2E suite passes (requires local Supabase running): `npm run e2e`

#### Manual Verification:

- Manually re-run the full add → edit → delete flow on `/dashboard/vehicles/:id` in a browser and confirm mileage, cost/km, and the chart all update correctly at each step without any reload.
- Confirm no regressions in Service Reminders / Service Thresholds sections, which are untouched by this change.

---

## Testing Strategy

### Unit Tests:

- Store: seed, delete+notify, multi-consumer sharing, reset-for-tests.
- `RepairList`: delete success removes item (via store), delete failure keeps item and shows error (unchanged behavior, updated prop name).
- `VehicleStatsHeader`: correct initial render, reactive update on external delete, null-cost fallback.
- `ReactiveCostTrends`: visibility threshold on mount and after reactive update.

### Integration Tests:

- None planned beyond existing e2e coverage — the store, header, and chart interactions are covered by component-level RTL tests plus the e2e lifecycle test.

### Manual Testing Steps:

1. Open a vehicle detail page with 3+ repairs (mixed costs/mileages) in a browser.
2. Delete a repair that is not the max-mileage one; confirm Mileage stays the same, Cost/km updates, chart updates.
3. Delete the repair with the highest mileage; confirm Mileage drops to the next-highest remaining value.
4. Delete repairs until fewer than 2 costed repairs remain; confirm Cost/km shows "no cost data yet" and the Cost Trends section disappears.
5. Add a new repair (full-page redirect flow) and confirm the header/chart still reflect correct values after redirect.

## Performance Considerations

None — the calculations are the same O(n) pure functions already run server-side on every page load; running them again client-side on a small in-memory array on delete is negligible.

## Migration Notes

Not applicable — no data model or schema changes.

## References

- Related research: `context/changes/reactive-cost-km/research.md`
- Origin finding: `context/changes/vehicle-god-page/reviews/impl-review.md` (F3)
- Pure calculation functions: `src/lib/costPerKm.ts:3-72`
- Server call site: `src/lib/services/vehiclePageData.ts:66-70`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared repairs store + reactive header stats

#### Automated

- [x] 1.1 Unit tests pass: `npm run test` — 53cee88
- [x] 1.2 Type checking passes: `npm run astro check` — 53cee88
- [x] 1.3 Linting passes: `npm run lint` — 53cee88

#### Manual

- [ ] 1.4 Deleting a repair updates Mileage and Cost/km header immediately, without reload
- [ ] 1.5 Deleting the max-mileage repair correctly lowers displayed Mileage
- [ ] 1.6 Deleting the last costed repair shows "no cost data yet" fallback immediately
- [ ] 1.7 Add/Edit repair redirect flows still show correct values — no regression
- [ ] 1.8 Two different vehicles' pages in separate tabs never cross-show each other's data

### Phase 2: Reactive Cost Trends chart

#### Automated

- [x] 2.1 Unit tests pass: `npm run test`
- [x] 2.2 Type checking passes: `npm run astro check`
- [x] 2.3 Linting passes: `npm run lint`

#### Manual

- [ ] 2.4 Deleting a repair updates chart data immediately, without reload
- [ ] 2.5 Deleting down to <2 data points hides the Cost Trends section immediately
- [ ] 2.6 Chart tab switching still works after a delete-triggered update

### Phase 3: Test coverage and regression pass

#### Automated

- [ ] 3.1 Full unit test suite passes: `npm run test`
- [ ] 3.2 Type checking passes: `npm run astro check`
- [ ] 3.3 Linting passes: `npm run lint`
- [ ] 3.4 E2E suite passes: `npm run e2e`

#### Manual

- [ ] 3.5 Full add → edit → delete flow manually verified end to end, no reloads needed
- [ ] 3.6 No regressions in Service Reminders / Service Thresholds sections

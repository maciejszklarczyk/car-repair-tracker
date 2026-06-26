# Vehicle Module Structural Refactor Implementation Plan

## Overview

Structural refactor of vehicle module addressing three ranked refactor candidates from research: K3 (schemas.ts import leak), K1 (god-page service extraction with K2 select("*") folded in), and K6 (replace window.location.reload() with local state). Pure extraction and UX improvement — no behavior changes, no schema changes, no API contract changes.

## Current State Analysis

`src/pages/dashboard/vehicles/[id].astro` is a 157-line god-page mixing auth, data fetching (3 Supabase queries), data transformation (6 compute calls), success-message routing, and template rendering. All three queries use `select("*") as Type` casts — a pattern the project's own API routes avoid. `schemas.ts` has a stale import pulling in the Gemini SDK transitively. `RepairList` and `ServiceThresholdList` use `window.location.reload()` after delete, while the newer `CategorySelect` component uses optimistic local state — inconsistent interaction patterns on the same page.

## Desired End State

- `schemas.ts` imports `REPAIR_CATEGORIES` from `@/lib/repairCategories` (pure data, zero deps)
- `src/lib/services/vehiclePageData.ts` exists as a facade: single async function returning all data needed by the vehicle detail page, with explicit column selects and a typed DTO return
- `[id].astro` frontmatter reduced to: auth guard → one service call → success-message routing → template
- `RepairList` and `ServiceThresholdList` remove deleted items from local state via `useState` — no page reload
- Unit tests cover the new service function and both component delete behaviors

### Key Discoveries:

- `src/lib/services/` directory does not exist — Phase 2 establishes this pattern
- All 6 compute functions (`costPerKm.ts`, `serviceReminders.ts`) are already pure extracted functions with 38 unit tests — service layer calls them, no duplication
- `CategorySelect.tsx:16-31` already implements the optimistic UI pattern K6 will follow
- E2E `repair-lifecycle.spec.ts` covers vehicle detail page end-to-end — safety net during extraction
- The 4th `select("*")` occurrence (`repairs/[id]/edit.astro:15`) is NOT in scope — it's a separate page, not part of the god-page extraction
- Success-message routing (lines 68-78) stays in page — it's a presentation concern mapping URL params to toast text

## What We're NOT Doing

- K4 (schemas.ts split into domain files) — at 63 lines, not yet a bottleneck
- K5 (non-atomic DB ops) — RLS provides sufficient safety net; Supabase JS client doesn't support transactions
- K7 (types.ts codegen) — defer until next migration; manual sync works
- 4th `select("*")` in `repairs/[id]/edit.astro` — separate page, separate change
- React component testing infrastructure setup — just adding focused tests for delete behavior
- Any behavior changes — this is pure extraction and UX polish

## Implementation Approach

Execute in research-recommended order: K3 → K1+K2 → K1 tests → K6+tests. Each phase is independently shippable. K3 is trivial (1 line). K1 creates a service facade that moves queries and compute calls out of the page, replacing `select("*")` with explicit columns during the move. K6 converts two components from reload-on-delete to local-state-filter, following the existing `CategorySelect` optimistic pattern.

---

## Phase 1: Fix schemas.ts Import Leak (K3)

### Overview

Change 1 import path in `schemas.ts` to eliminate the transitive dependency on `@google/genai` and `astro:env/server` for all 5 API route files that import schemas.

### Changes Required:

#### 1. Fix import path

**File**: `src/lib/schemas.ts`

**Intent**: Replace stale import of `REPAIR_CATEGORIES` from `classifyRepair` (which re-exports from `repairCategories` but also imports Gemini SDK) with direct import from `repairCategories` (pure data, zero deps).

**Contract**: Line 2 import source changes from `"@/lib/classifyRepair"` to `"@/lib/repairCategories"`. The `REPAIR_CATEGORIES` named export is identical — `classifyRepair.ts:5` re-exports it from `repairCategories.ts`.

### Success Criteria:

#### Automated Verification:

- TypeScript check passes: `npx astro check`
- Build succeeds: `npm run build`
- Lint passes: `npm run lint`
- Unit tests pass: `npm run test`

#### Manual Verification:

- None required — pure import path change with identical runtime value

**Implementation Note**: After completing this phase and all automated verification passes, proceed directly to Phase 2 — no manual gate needed for a 1-line import fix.

---

## Phase 2: Extract vehiclePageData Service (K1+K2)

### Overview

Create `src/lib/services/vehiclePageData.ts` with a single async function `getVehiclePageData` that encapsulates all 3 Supabase queries (with explicit column selects replacing `select("*")`) and all 6 compute calls. Refactor `[id].astro` to call this function instead of managing data fetching inline.

### Changes Required:

#### 1. Create service function

**File**: `src/lib/services/vehiclePageData.ts` (new)

**Intent**: Facade function that fetches vehicle, repairs, and service thresholds from Supabase, runs all compute functions, and returns a typed DTO. Centralizes the 3 queries + 6 compute calls currently spread across 40 lines of page frontmatter.

**Contract**: Export `getVehiclePageData(supabase: SupabaseClient, vehicleId: string, userId: string)` returning `Promise<VehiclePageData | null>`. Returns `null` when vehicle not found, query fails, or user doesn't own vehicle. DTO interface `VehiclePageData` contains: `vehicle`, `repairs`, `currentMileage`, `costPerKm`, `chartData`, `totalCostData`, `mileageData`, `thresholdSummary`. All three queries use explicit column lists matching `Vehicle`, `Repair`, `ServiceThreshold` interfaces from `@/types`.

Explicit columns for each query:
- `cars`: `id, user_id, make, model, year, baseline_mileage, archived_at, created_at, updated_at`
- `repairs`: `id, car_id, user_id, repair_date, description, cost, mileage, category, category_source, original_category, created_at, updated_at`
- `service_thresholds`: `id, car_id, user_id, name, km_interval, days_interval, last_performed_date, last_performed_mileage, created_at, updated_at`

#### 2. Refactor vehicle detail page

**File**: `src/pages/dashboard/vehicles/[id].astro`

**Intent**: Replace inline data fetching and compute calls with a single `getVehiclePageData` call. Page frontmatter becomes: auth guard → validate params → create Supabase client → one service call → success-message routing.

**Contract**: Imports reduce from 10 to ~4 (Layout, createClient, getVehiclePageData, type imports for template). Frontmatter shrinks from ~60 lines of data logic to ~20 lines (auth + service call + success message). Template stays identical — same props passed to same React islands.

### Success Criteria:

#### Automated Verification:

- TypeScript check passes: `npx astro check`
- Build succeeds: `npm run build`
- Lint passes: `npm run lint`
- Unit tests pass: `npm run test`
- E2E tests pass: `npm run e2e`

#### Manual Verification:

- Vehicle detail page loads with all data (metrics, charts, repairs list, service thresholds, reminders)
- Cost/km and mileage display correctly
- Charts render when 2+ data points exist
- Service reminders show correct status badges
- Success toasts appear after repair/threshold add/edit
- Page redirects to vehicle list when vehicle not found

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Service Unit Tests

### Overview

Add unit tests for `getVehiclePageData` with mocked Supabase client, covering the happy path (all data loads), individual query failures, and vehicle-not-found case.

### Changes Required:

#### 1. Service test file

**File**: `src/lib/services/__tests__/vehiclePageData.test.ts` (new)

**Intent**: Test the orchestration logic of `getVehiclePageData` — correct queries dispatched, compute functions called with right args, error paths return null. Mock the Supabase client (chained `.from().select().eq().is().single()` pattern). Compute functions are already tested separately — don't re-test their math here.

**Contract**: Test cases:
- Returns full DTO when all 3 queries succeed
- Returns null when vehicle query fails or returns no data
- Returns null when repairs query fails
- Returns null when thresholds query fails
- Passes correct explicit column lists to each `select()` call
- Calls compute functions with correct arguments

### Success Criteria:

#### Automated Verification:

- New tests pass: `npm run test`
- TypeScript check passes: `npx astro check`

#### Manual Verification:

- None required — pure unit tests

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 4 — no manual gate needed for tests.

---

## Phase 4: Replace Reload with Local State (K6) + Component Tests

### Overview

Replace `window.location.reload()` in `RepairList` and `ServiceThresholdList` with local `useState` management — filter deleted items from state after successful delete. Add focused unit tests for delete behavior in both components.

### Changes Required:

#### 1. RepairList local state

**File**: `src/components/repairs/RepairList.tsx`

**Intent**: Instead of reloading the entire page after a successful delete, manage repairs in local state via `useState` initialized from props. After successful DELETE fetch, filter the deleted repair from local state. Follows the same pattern as `CategorySelect`'s optimistic UI.

**Contract**: Add `useState<Repair[]>` initialized from `repairs` prop. Render from state instead of props. On successful delete, call `setRepairs(prev => prev.filter(r => r.id !== repairId))`. Remove `window.location.reload()` call. Error handling stays unchanged.

#### 2. ServiceThresholdList local state

**File**: `src/components/service-reminders/ServiceThresholdList.tsx`

**Intent**: Same pattern as RepairList — manage thresholds in local state, filter on successful delete, remove page reload.

**Contract**: Add `useState<ThresholdWithStatus[]>` initialized from `thresholds` prop. Render from state. On successful delete, filter by id. Remove `window.location.reload()`.

#### 3. RepairList delete test

**File**: `src/components/repairs/__tests__/RepairList.test.tsx` (new)

**Intent**: Verify that after a successful delete fetch, the component removes the deleted repair from the rendered list without page reload.

**Contract**: Test cases:
- After successful delete, deleted repair disappears from rendered list
- Remaining repairs stay rendered
- On delete error, repair stays in list and error message shows

#### 4. ServiceThresholdList delete test

**File**: `src/components/service-reminders/__tests__/ServiceThresholdList.test.tsx` (new)

**Intent**: Same test pattern as RepairList — verify delete removes item from rendered list.

**Contract**: Test cases:
- After successful delete, threshold disappears from rendered list
- Remaining thresholds stay rendered
- On delete error, threshold stays and error message shows

#### 5. E2E test adjustment

**File**: `e2e/repair-lifecycle.spec.ts`

**Intent**: The existing E2E test uses `page.waitForLoadState("networkidle")` (line ~108) after delete, which implicitly relies on the `window.location.reload()` being removed in this phase. Update the wait to match the new local-state removal behavior.

**Contract**: Replace `waitForLoadState("networkidle")` after delete with an assertion that the deleted item is no longer visible (e.g. `waitForSelector` with `state: 'hidden'` or `toBeHidden`). The rest of the test (cost/km assertion after delete) stays unchanged.

### Success Criteria:

#### Automated Verification:

- TypeScript check passes: `npx astro check`
- Build succeeds: `npm run build`
- Lint passes: `npm run lint`
- All tests pass (including new component tests): `npm run test`
- E2E tests pass: `npm run e2e`

#### Manual Verification:

- Delete a repair from vehicle detail page — item disappears without page flash/reload
- Delete a service threshold — item disappears without page flash/reload
- Delete error shows error message, item stays in list
- After delete, remaining items and all other page sections (charts, metrics, reminders) stay intact
- No regressions in add/edit flows

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

- `getVehiclePageData` — orchestration logic, query construction, error paths (Phase 3)
- `RepairList` delete behavior — item removal from local state (Phase 4)
- `ServiceThresholdList` delete behavior — item removal from local state (Phase 4)
- Existing 38 tests on `costPerKm` and `serviceReminders` functions remain unchanged

### Integration Tests:

- E2E `repair-lifecycle.spec.ts` covers full vehicle detail page flow — serves as regression net for Phase 2 and Phase 4

### Manual Testing Steps:

1. Load vehicle detail page — verify all sections render (metrics, charts, repairs, thresholds, reminders)
2. Delete a repair — verify smooth removal without page reload
3. Delete a service threshold — verify smooth removal without page reload
4. Add a repair via the add repair flow — verify success toast on return
5. Edit a repair — verify success toast on return
6. Navigate to a non-existent vehicle ID — verify redirect to vehicles list

## References

- Research: `context/changes/vehicle-god-page/research.md`
- God-page: `src/pages/dashboard/vehicles/[id].astro`
- Import leak: `src/lib/schemas.ts:2`
- Pure data source: `src/lib/repairCategories.ts`
- Optimistic UI pattern (K6 reference): `src/components/repairs/CategorySelect.tsx:16-31`
- Compute functions: `src/lib/costPerKm.ts`, `src/lib/serviceReminders.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fix schemas.ts Import Leak (K3)

#### Automated

- [x] 1.1 TypeScript check passes: `npx astro check` — 17888fe
- [x] 1.2 Build succeeds: `npm run build` — 17888fe
- [x] 1.3 Lint passes: `npm run lint` — 17888fe
- [x] 1.4 Unit tests pass: `npm run test` — 17888fe

### Phase 2: Extract vehiclePageData Service (K1+K2)

#### Automated

- [x] 2.1 TypeScript check passes: `npx astro check`
- [x] 2.2 Build succeeds: `npm run build`
- [x] 2.3 Lint passes: `npm run lint`
- [x] 2.4 Unit tests pass: `npm run test`
- [x] 2.5 E2E tests pass: `npm run e2e`

#### Manual

- [ ] 2.6 Vehicle detail page loads with all data (metrics, charts, repairs, thresholds, reminders)
- [ ] 2.7 Success toasts appear after repair/threshold add/edit
- [ ] 2.8 Page redirects to vehicle list when vehicle not found

### Phase 3: Service Unit Tests

#### Automated

- [ ] 3.1 New tests pass: `npm run test`
- [ ] 3.2 TypeScript check passes: `npx astro check`

### Phase 4: Replace Reload with Local State (K6) + Component Tests

#### Automated

- [ ] 4.1 TypeScript check passes: `npx astro check`
- [ ] 4.2 Build succeeds: `npm run build`
- [ ] 4.3 Lint passes: `npm run lint`
- [ ] 4.4 All tests pass: `npm run test`
- [ ] 4.5 E2E tests pass: `npm run e2e`

#### Manual

- [ ] 4.6 Delete repair — item disappears without page reload
- [ ] 4.7 Delete threshold — item disappears without page reload
- [ ] 4.8 Delete error shows message, item stays in list
- [ ] 4.9 No regressions in other page sections after delete

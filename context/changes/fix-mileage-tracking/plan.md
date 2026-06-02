# Fix Mileage Tracking Implementation Plan

## Overview

`cars.current_mileage` is set at vehicle creation and never updated when repairs are added. The displayed mileage and cost/km calculation both read this stale value. Fix: drop the column entirely, derive current mileage on-the-fly as `MAX(repairs.mileage)` with fallback to `baseline_mileage` when no repairs exist.

## Current State Analysis

- `cars.current_mileage` — stored at vehicle creation, never written again
- `computeCostPerKm` (`src/lib/costPerKm.ts:4`) — reads `vehicle.current_mileage - vehicle.baseline_mileage` as the km delta (stale)
- Vehicle detail page (`src/pages/dashboard/vehicles/[id].astro:70`) — displays `vehicle.current_mileage` directly (stale)
- Vehicle list page (`src/pages/dashboard/vehicles/index.astro`) — queries `cars.*` only; `VehicleCard` displays `vehicle.current_mileage` (stale)
- `AddVehicleForm.tsx` — has a "Current Mileage" form field that feeds the now-removed column
- Detail page already fetches all repairs — `MAX(repairs.mileage)` computable in-memory for free
- List page fetches no repairs today — needs a PostgREST join to get mileage values per car

### Key Discoveries:

- `src/types.ts:19` — `Vehicle.current_mileage: number` must be removed after migration
- `src/lib/schemas.ts:33–42` — `createVehicleSchema` has `current_mileage` field + cross-field refine that references it; both must be removed
- `src/pages/api/vehicles.ts:21,37` — reads and inserts `current_mileage`; both must be removed
- `src/components/vehicles/AddVehicleForm.tsx:23,40–45` — has form field, state, and validation for `current_mileage`
- PostgREST join `select("*, repairs(mileage)")` returns each car with `repairs: { mileage: number }[]` — JS reduces to MAX; one round-trip, no DB view needed

## Desired End State

After this plan, the "Mileage" label on both the vehicle list card and vehicle detail page shows the highest mileage value recorded across all repairs (`MAX(repairs.mileage)`), falling back to `baseline_mileage` when no repairs exist. Cost/km uses this derived mileage as numerator minus `baseline_mileage`. The `cars.current_mileage` column is gone from the database and from every layer of the app. Adding a new repair immediately reflects the correct mileage on next page load.

### Key Discoveries:

- `computeCurrentMileage` is a pure function — straightforward to extract and verify manually
- `baseline_mileage` remains as the ownership-start mileage; it is also the zero-repair fallback for display and the denominator anchor for cost/km
- Supabase PostgREST nested select `repairs(mileage)` respects existing RLS policies — no additional grants needed

## What We're NOT Doing

- No DB view or RPC — PostgREST join handles the list page without a schema object
- No unit tests — manual verification only (user decision)
- Not renaming `baseline_mileage` — its meaning is unchanged
- Not updating repair edit/delete flows — those don't touch `cars.current_mileage`

## Implementation Approach

Two-phase approach: Phase 1 removes the stale column from every layer (migration → types → schema → API → form). Phase 2 wires in the derived value (costPerKm helper → detail page → list page → VehicleCard). Phases are ordered so Phase 1 leaves the app in a broken-but-compile-able state (TypeScript errors on `vehicle.current_mileage` usages guide Phase 2 changes).

---

## Phase 1: Drop `current_mileage` from DB and all app layers

### Overview

Remove `cars.current_mileage` from the Postgres table and from every layer that reads or writes it: Vehicle type, validation schema, API handler, and the add-vehicle form.

### Changes Required:

#### 1. DB Migration

**File**: `supabase/migrations/20260602140000_drop_cars_current_mileage.sql`

**Intent**: Drop the `current_mileage` column from `cars`. After this migration the column no longer exists; Supabase select queries will simply not return it.

**Contract**:
```sql
ALTER TABLE public.cars DROP COLUMN current_mileage;
```

#### 2. Vehicle type

**File**: `src/types.ts`

**Intent**: Remove `current_mileage: number` from the `Vehicle` interface so TypeScript enforces the removal at every usage site.

**Contract**: Delete the `current_mileage: number;` line from `interface Vehicle`.

#### 3. Validation schema

**File**: `src/lib/schemas.ts`

**Intent**: Remove `current_mileage` from `createVehicleSchema` and the cross-field refine that referenced it (`current_mileage >= baseline_mileage`). The form will no longer collect this value.

**Contract**: Remove the `current_mileage` field definition (lines 33–34) and the `.refine(...)` block (lines 39–42). The schema becomes a plain `z.object(...)` with no refinement.

#### 4. API handler

**File**: `src/pages/api/vehicles.ts`

**Intent**: Remove `current_mileage` from the `raw` object parsed from form data and from the Supabase insert payload.

**Contract**: Remove `current_mileage: Number(form.get("current_mileage"))` from `raw` (line 21) and `current_mileage: result.data.current_mileage` from the insert call (line 37).

#### 5. Add Vehicle form

**File**: `src/components/vehicles/AddVehicleForm.tsx`

**Intent**: Remove the "Current Mileage" field, its state, and its client-side validation. The form now collects only `baseline_mileage` as the mileage input.

**Contract**: Remove `currentMileage` state, `current_mileage` from `FormErrors`, the `currentNum` validation block, the `current_mileage >= baseline_mileage` cross-field check, and the `<FormField id="current_mileage" ...>` JSX block.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset` or `npx supabase migration up` with no errors
- Lint passes: `npm run lint`

#### Manual Verification:

- Add Vehicle form loads without the "Current Mileage" field
- Submitting the form with only Baseline Mileage creates a vehicle (no DB error)
- No JS console errors on the vehicles list or detail pages

**Implementation Note**: After completing Phase 1 and all automated checks pass, confirm manually that the add-vehicle flow works end-to-end before starting Phase 2.

---

## Phase 2: Derive and display correct mileage

### Overview

Extract `computeCurrentMileage` helper, update `computeCostPerKm` to use it, fix the detail page display, and update the list page query and `VehicleCard` to show the derived mileage.

### Changes Required:

#### 1. costPerKm helper

**File**: `src/lib/costPerKm.ts`

**Intent**: Extract `computeCurrentMileage` as a named export so both the detail page and list page can use it. Update `computeCostPerKm` to call it internally instead of reading the now-gone `vehicle.current_mileage`.

**Contract**:
```ts
export function computeCurrentMileage(repairs: Repair[], baselineMileage: number): number {
  if (repairs.length === 0) return baselineMileage;
  return Math.max(baselineMileage, ...repairs.map((r) => r.mileage));
}

export function computeCostPerKm(vehicle: Vehicle, repairs: Repair[]): number | null {
  const km = computeCurrentMileage(repairs, vehicle.baseline_mileage) - vehicle.baseline_mileage;
  if (km <= 0) return null;
  const totalCost = repairs.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  if (totalCost === 0) return null;
  return totalCost / km;
}
```

#### 2. Vehicle detail page

**File**: `src/pages/dashboard/vehicles/[id].astro`

**Intent**: Compute `currentMileage` from the already-loaded repairs array and display it instead of the gone `vehicle.current_mileage`.

**Contract**: Import `computeCurrentMileage` from `@/lib/costPerKm`. After the repairs query, compute `const currentMileage = computeCurrentMileage(repairs, vehicle.baseline_mileage)`. Replace `vehicle.current_mileage` in the Mileage span (line 70) with `currentMileage`.

#### 3. Vehicle list page query

**File**: `src/pages/dashboard/vehicles/index.astro`

**Intent**: Extend the cars query to include repair mileage values via a PostgREST nested select, then compute the current mileage per vehicle in-page.

**Contract**: Change the select string from `"*"` to `"*, repairs(mileage)"`. The response type for each element becomes `Vehicle & { repairs: { mileage: number }[] }`. Compute `currentMileage` per vehicle using `computeCurrentMileage(v.repairs, v.baseline_mileage)` before passing to `VehicleCard`. Import `computeCurrentMileage` from `@/lib/costPerKm`.

#### 4. VehicleCard

**File**: `src/components/vehicles/VehicleCard.astro`

**Intent**: Accept `currentMileage` as an explicit prop and display it instead of the removed `vehicle.current_mileage`.

**Contract**: Add `currentMileage: number` to the `Props` interface. Replace `{vehicle.current_mileage.toLocaleString()}` with `{currentMileage.toLocaleString()}` in the mileage span. Update every call-site in `index.astro` to pass `currentMileage`.

### Success Criteria:

#### Automated Verification:

- TypeScript build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Vehicle with two repairs (e.g. 120 000 and 122 000 km): list card and detail page both show 122 000
- Vehicle with no repairs: both views show `baseline_mileage`
- Cost/km on detail page reflects `sum(costs) / (122 000 − baseline)` correctly
- Adding a third repair at 125 000 km: refresh shows 125 000 immediately

**Implementation Note**: After automated checks pass, test the repair-then-refresh loop manually before marking the change done.

---

## Testing Strategy

### Manual Testing Steps:

1. Open vehicle detail page — note current (stale) mileage value
2. Verify second repair mileage is higher than displayed value
3. After deploy: reload detail page — mileage must match highest repair value
4. Open vehicle list — same mileage value appears on the card
5. Add a new repair with higher mileage — reload — both views update
6. Check cost/km: new repair adds cost, km denominator increases → value changes as expected
7. Add a vehicle with no repairs — both views show baseline mileage

## Migration Notes

`ALTER TABLE cars DROP COLUMN current_mileage` permanently discards any stored `current_mileage` value, including cases where it differs from `baseline_mileage`. Users who registered a vehicle with a higher `current_mileage` (e.g., 122,000 km) than their `baseline_mileage` (e.g., 120,000 km) and have logged zero repairs will see `baseline_mileage` displayed after migration. This is accepted behavior: the gap is recovered naturally as soon as the first repair with the correct mileage is logged. There is no rollback for the column drop — verify on a local dev database before applying to production.

## References

- Change folder: `context/changes/fix-mileage-tracking/`
- Stale field identified in: `src/lib/costPerKm.ts:4`, `src/pages/dashboard/vehicles/[id].astro:70`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Drop `current_mileage` from DB and all app layers

#### Automated

- [x] 1.1 Migration applies cleanly (`npx supabase db reset` or `npx supabase migration up`) — 3ab1a96
- [x] 1.2 Lint passes (`npm run lint`) — 5c19d84

#### Manual

- [ ] 1.3 Add Vehicle form loads without the "Current Mileage" field
- [ ] 1.4 Submitting the form with only Baseline Mileage creates a vehicle (no DB error)
- [ ] 1.5 No JS console errors on vehicles list or detail pages

### Phase 2: Derive and display correct mileage

#### Automated

- [x] 2.1 TypeScript build passes (`npm run build`) — 5c19d84
- [x] 2.2 Lint passes (`npm run lint`) — 5c19d84

#### Manual

- [ ] 2.3 Vehicle with two repairs shows highest repair mileage on list card and detail page
- [ ] 2.4 Vehicle with no repairs shows `baseline_mileage` on both views
- [ ] 2.5 Cost/km reflects correct `sum(costs) / (MAX(mileage) − baseline)` value
- [ ] 2.6 Adding a new repair at higher mileage updates both views on refresh

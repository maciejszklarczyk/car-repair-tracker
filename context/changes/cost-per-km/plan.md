# Cost per km (S-04) Implementation Plan

## Overview

Display a cost/km metric on the vehicle detail page, computed server-side from the car's mileage delta and all repairs that have a cost. This completes the core vertical: add vehicle → add repair → read cost/km.

## Current State Analysis

- `cars` table: `current_mileage`, `baseline_mileage` — both present; formula inputs in DB already.
- `repairs` table: `cost numeric(10,2)` (nullable) — nulls excluded from the sum per roadmap spec.
- `src/pages/dashboard/vehicles/[id].astro` — fetches the car, renders vehicle detail; currently shows Year + Mileage only. Perfect insertion point.
- `src/types.ts` — `Vehicle` and `Repair` interfaces both defined; no new types needed.
- No new migration required — all schema columns exist from S-01 and S-02.

## Desired End State

The vehicle detail page shows a "Cost/km" line in the vehicle info block. The value is computed as:

```
sum(repair.cost WHERE cost IS NOT NULL) / (current_mileage - baseline_mileage)
```

Formatted as `1.23 PLN/km`. When it cannot be computed (no cost data, or baseline = current mileage), the line shows `— PLN/km` with a short inline label explaining why. The value is always current because the page is fully SSR — every visit re-fetches and recomputes.

### Key Discoveries

- `src/pages/dashboard/vehicles/[id].astro:14` — single `supabase.from("cars").select().eq("id", id).single()` call; add a second query for repairs in the same frontmatter block.
- `src/types.ts:1-11` — `Repair.cost` is `number | null`; the helper must handle null values.
- `src/pages/api/vehicles.ts:1-45` — established pattern: supabase query → guard → render. Same pattern applies for the repair fetch.
- Roadmap (S-04, risk): baseline = current must guard division by zero; no-cost repairs must produce `null` result, not `0`.

## What We're NOT Doing

- Repair list / history display on the detail page (S-03).
- Cost/km on the vehicle list cards — vehicle detail page only.
- Real-time updates via WebSocket or subscriptions — SSR redirect on each action is sufficient.
- S-07 cost trend chart.
- Any new DB migration.

## Implementation Approach

Two-phase: first a pure testable helper in `src/lib/`, then wire it into the Astro page. The helper receives the vehicle and its repairs, returns `number | null` (null = cannot compute). The page computes once during SSR and passes the formatted string to the template.

## Phase 1: Service Helper

### Overview

Pure function `computeCostPerKm(vehicle, repairs)` in a new `src/lib/costPerKm.ts` file. Takes the vehicle record and the car's repairs, returns `number | null`.

### Changes Required

#### 1. Helper module

**File**: `src/lib/costPerKm.ts`

**Intent**: Encapsulate the cost/km formula and its two edge cases so the Astro page stays thin and the logic is reusable (S-07 will need the same function).

**Contract**:

```typescript
import type { Repair, Vehicle } from "@/types";

export function computeCostPerKm(vehicle: Vehicle, repairs: Repair[]): number | null {
  const km = vehicle.current_mileage - vehicle.baseline_mileage;
  if (km <= 0) return null;
  const totalCost = repairs.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  if (totalCost === 0) return null;
  return totalCost / km;
}
```

Returns `null` for both edge cases: zero/negative km delta (division by zero guard), and no repairs with a cost (sum is 0 — display as missing data, not 0 PLN/km).

### Success Criteria

#### Automated Verification

- `npm run build` passes (no TypeScript errors)
- `npm run lint` passes

#### Manual Verification

- File exists at `src/lib/costPerKm.ts` with the exported function
- Function returns `null` when `current_mileage === baseline_mileage`
- Function returns `null` when all repairs have `cost: null`
- Function returns correct decimal for a sample: `totalCost=100`, `kmDelta=80` → `1.25`

**Implementation Note**: Pause after Phase 1 manual verification before proceeding to Phase 2.

---

## Phase 2: Vehicle Detail Page Integration

### Overview

Fetch the car's repairs in `[id].astro`, call `computeCostPerKm`, and render the metric in the vehicle info block. Edge case: show `— PLN/km` with an inline note when the result is `null`.

### Changes Required

#### 1. Fetch repairs in frontmatter

**File**: `src/pages/dashboard/vehicles/[id].astro`

**Intent**: Fetch repairs for the car inside the existing `if (id && supabase)` block, alongside the car fetch. `id` and `supabase` are only narrowed to non-null inside that guard — placing the query outside it causes a TypeScript compilation error.

**Contract**: Declare `let repairs: Repair[] = []` before the guard block. Inside the existing `if (id && supabase)` block, after the car query, add:

```typescript
const { data: repairsData } = await supabase
  .from("repairs")
  .select("*")
  .eq("car_id", id);
repairs = (repairsData ?? []) as Repair[];
```

After the redirect guard (`if (vehicle?.user_id !== user.id)`), call `computeCostPerKm(vehicle, repairs)` and store as `const costPerKm`.

Import `Repair` from `@/types` and `computeCostPerKm` from `@/lib/costPerKm`.

#### 2. Render cost/km in the vehicle info block

**File**: `src/pages/dashboard/vehicles/[id].astro`

**Intent**: Add a "Cost/km" entry alongside the existing Year and Mileage spans. When `costPerKm` is null, show `— PLN/km` with an inline grey note explaining the gap.

**Contract**: Inside the `flex gap-6` block that holds the Year and Mileage spans, add:

```astro
<span>
  Cost/km:{" "}
  {costPerKm !== null
    ? `${costPerKm.toFixed(2)} PLN/km`
    : <span class="text-blue-100/40 text-xs">(— PLN/km — no cost data yet)</span>}
</span>
```

Match the existing `text-sm text-blue-100/70` class on the outer span.

### Success Criteria

#### Automated Verification

- `npm run build` passes
- `npm run lint` passes

#### Manual Verification

- Vehicle detail page renders `X.XX PLN/km` after a repair with cost has been added
- Vehicle detail page renders `— PLN/km (no cost data yet)` for a vehicle with no costed repairs
- Vehicle detail page renders `— PLN/km (no cost data yet)` for a vehicle where `baseline_mileage === current_mileage`
- After adding a second repair with cost, the value updates on page reload

---

## Testing Strategy

### Manual Testing Steps

1. Open vehicle detail for a vehicle with no repairs → should show `— PLN/km — no cost data yet`
2. Add a repair **without cost** → reload vehicle detail → still shows `—`
3. Add a repair **with cost** (e.g., 200 PLN at mileage delta 100 km) → reload → shows `2.00 PLN/km`
4. Add a second costed repair (e.g., 100 PLN) → reload → shows `3.00 PLN/km` (300 / 100)
5. Check a vehicle whose `baseline_mileage === current_mileage` → shows `— PLN/km — no cost data yet`

## References

- Roadmap S-04: `context/foundation/roadmap.md:103-113`
- S-02 plan (repairs schema): `context/changes/add-repair/plan.md`
- Vehicle detail page: `src/pages/dashboard/vehicles/[id].astro`
- Types: `src/types.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Service Helper

#### Automated

- [x] 1.1 npm run build passes — 0d867b8
- [x] 1.2 npm run lint passes — 0d867b8

#### Manual

- [x] 1.3 File exists at src/lib/costPerKm.ts with exported function — 0d867b8
- [x] 1.4 Returns null when current_mileage === baseline_mileage — 0d867b8
- [x] 1.5 Returns null when all repairs have cost: null — 0d867b8
- [x] 1.6 Returns correct decimal for sample inputs — 0d867b8

### Phase 2: Vehicle Detail Page Integration

#### Automated

- [x] 2.1 npm run build passes — ba49f7d
- [x] 2.2 npm run lint passes — ba49f7d

#### Manual

- [x] 2.3 Vehicle detail shows X.XX PLN/km after costed repair added — ba49f7d
- [x] 2.4 Vehicle detail shows — PLN/km when no costed repairs exist — ba49f7d
- [x] 2.5 Vehicle detail shows — PLN/km when baseline_mileage === current_mileage — ba49f7d
- [x] 2.6 Adding second costed repair updates the value on reload — ba49f7d

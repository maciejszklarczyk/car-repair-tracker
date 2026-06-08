# Cost Trend Chart Implementation Plan

## Overview

Add a visual cumulative cost/km trend chart to the vehicle detail page. The chart plots cost/km (Y) over repair dates (X), calculated as accumulated repair cost divided by km driven since baseline at each repair point.

## Current State Analysis

Vehicle detail page (`src/pages/dashboard/vehicles/[id].astro`) already fetches all repairs sorted by date DESC. `computeCostPerKm()` in `src/lib/costPerKm.ts` computes the current scalar value. No charting library is installed; all analytics are text-only. React islands on the page use `client:load` (RepairList, ServiceReminders, ServiceThresholdList).

## Desired End State

On the vehicle detail page, a chart section appears between the header stats card and the Service Reminders section. It shows a line/area chart with repair dates on X and cumulative cost/km on Y. Only repairs with non-null cost contribute data points. The chart is hidden when fewer than 2 qualifying data points exist. Hovering a data point shows a tooltip with date and cost/km value.

### Key Discoveries:

- `Repair` has `repair_date: string`, `cost: number | null`, `mileage: number` — all needed for chart data
- `Vehicle` has `baseline_mileage: number` — needed for km-driven denominator
- `computeCostPerKm()` coalesces null costs to zero (`r.cost ?? 0`); the new `computeCostTrendData` instead **filters out** null-cost repairs entirely, since they shouldn't produce chart data points
- No charting library present — Recharts must be installed
- All interactive components on this page use `client:load`; Recharts requires browser APIs so the same pattern applies

## What We're NOT Doing

- No separate API route for chart data — transform happens from already-fetched repairs
- No server-side rendering of the chart (Recharts is client-only)
- No multi-vehicle comparison
- No zoom/pan/interactive range selection
- No category breakdown within the chart

## Implementation Approach

Install Recharts, add a `computeCostTrendData()` helper that transforms `Repair[]` into chart data points (sort ASC by date, filter nulls, accumulate cost, compute cost/km at each repair), build a `CostTrendChart` React component, then insert it into the Astro page between header and service reminders.

## Phase 1: Library + Data Transform

### Overview

Install Recharts and add `computeCostTrendData()` to `src/lib/costPerKm.ts`. This produces a typed array of chart points from raw repair data.

### Changes Required:

#### 1. Install Recharts

**File**: `package.json` (via npm install)

**Intent**: Add Recharts as a runtime dependency.

**Contract**: `npm install recharts` — adds `recharts` to `dependencies` in `package.json`.

#### 2. Chart data type + transform function

**File**: `src/lib/costPerKm.ts`

**Intent**: Export a `CostTrendPoint` type and a `computeCostTrendData()` function that converts raw repairs into chart-ready data.

**Contract**:

```ts
export interface CostTrendPoint {
  date: string; // repair_date ISO string, used as X-axis label
  costPerKm: number; // cumulative cost/km at this repair, rounded to 2 decimal places
}

export function computeCostTrendData(vehicle: Vehicle, repairs: Repair[]): CostTrendPoint[];
```

Algorithm:

1. Filter repairs to those with `cost != null`
2. Sort by `repair_date` ASC
3. Accumulate cost running total; at each repair compute `kmDriven = repair.mileage - vehicle.baseline_mileage`
4. If `kmDriven <= 0` skip that point (avoid divide-by-zero)
5. Push `{ date: repair.repair_date, costPerKm: parseFloat((runningCost / kmDriven).toFixed(2)) }`
6. Return array (may be empty or have 1 point — chart component handles the hide logic)

### Success Criteria:

#### Automated Verification:

- TypeScript compiles without errors: `npm run build`
- `computeCostTrendData` with 0 repairs returns `[]`
- `computeCostTrendData` with repairs all null cost returns `[]`
- `computeCostTrendData` with 1 costed repair returns array of length 1
- `computeCostTrendData` with 2+ costed repairs returns correct cumulative values

#### Manual Verification:

- `computeCostTrendData` logic verified by eyeballing output in browser console or test

**Implementation Note**: After completing this phase, verify build passes before moving to Phase 2.

---

## Phase 2: CostTrendChart Component

### Overview

Build the React component that renders a Recharts AreaChart. Returns null when fewer than 2 data points are provided.

### Changes Required:

#### 1. CostTrendChart component

**File**: `src/components/vehicles/CostTrendChart.tsx`

**Intent**: Render an area chart visualizing the cost/km trend. Accept `chartData: CostTrendPoint[]` as props; return null silently when `chartData.length < 2`.

**Contract**:

```ts
interface Props {
  chartData: CostTrendPoint[];
}
```

UI spec:

- Recharts `<AreaChart>` with `<Area>` (type="monotone"), `<XAxis>`, `<YAxis>`, `<Tooltip>`, `<CartesianGrid>`
- Dark theme: background transparent, grid lines `stroke="rgba(255,255,255,0.1)"`, area fill gradient in blue/purple matching the page palette
- X-axis: format `date` as short date (e.g. `"Jan '25"`) — use `new Date(date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })`
- Y-axis: suffix `" PLN/km"` in tick formatter
- Tooltip: show formatted date + `X.XX PLN/km`
- Container: `<ResponsiveContainer width="100%" height={240}>`

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Chart renders correctly on a vehicle with 2+ costed repairs
- Chart is absent (no empty box) on a vehicle with 0 or 1 costed repair
- Tooltip shows correct date and value on hover
- Chart is responsive (resize browser window)
- Visual style consistent with existing page (dark glass-morphism)

**Implementation Note**: Pause here and manually verify chart appearance and responsiveness before Phase 3.

---

## Phase 3: Page Integration

### Overview

Import `CostTrendChart` and `computeCostTrendData` into the vehicle detail Astro page, compute chart data server-side, pass as prop to the React island.

### Changes Required:

#### 1. Imports and data computation

**File**: `src/pages/dashboard/vehicles/[id].astro`

**Intent**: Import the new component and helper; compute `chartData` alongside existing `costPerKm` and `thresholdSummary`.

**Contract**: Add to frontmatter imports:

```ts
import CostTrendChart from "@/components/vehicles/CostTrendChart";
import { computeCostTrendData } from "@/lib/costPerKm";
```

And compute: `const chartData = computeCostTrendData(vehicle, repairs);`

Note: `repairs` is already fetched sorted DESC — `computeCostTrendData` re-sorts ASC internally, so no change to the DB query needed.

#### 2. Chart section in template

**File**: `src/pages/dashboard/vehicles/[id].astro`

**Intent**: Render the chart between the header stats card (closing `</div>` at line ~116) and the `<ServiceReminders>` island (line 118). Only render the wrapping section when `chartData.length >= 2` (belt-and-suspenders; the component also guards internally).

**Contract**: Insert after the header card closing `</div>`:

```astro
{
  chartData.length >= 2 && (
    <div class="mt-6">
      <h2 class="mb-4 text-xl font-semibold text-blue-100/80">Cost/km Trend</h2>
      <div class="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <CostTrendChart chartData={chartData} client:load />
      </div>
    </div>
  )
}
```

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Vehicle with 2+ costed repairs shows the chart section
- Vehicle with 0 or 1 costed repair shows NO chart section (no empty box)
- Chart section appears between header and Service Reminders
- No visual regressions in header, service reminders, repair history sections
- Page loads without hydration errors in browser console

**Implementation Note**: Final manual test on both a data-rich and a data-sparse vehicle before marking done.

---

## Testing Strategy

### Manual Testing Steps:

1. Vehicle with 0 repairs: no chart section visible
2. Vehicle with 1 costed repair: no chart section visible
3. Vehicle with 1 costed + 1 null-cost repair: no chart section visible
4. Vehicle with 2+ costed repairs: chart renders, tooltip works, area fills correctly
5. Resize browser window: chart stays responsive within its container

## References

- Roadmap: `context/foundation/roadmap.md` (S-07)
- Existing cost logic: `src/lib/costPerKm.ts`
- Vehicle detail page: `src/pages/dashboard/vehicles/[id].astro`
- Recharts docs: https://recharts.org/en-US/api

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Library + Data Transform

#### Automated

- [x] 1.1 TypeScript compiles without errors: `npm run build` — b2633e0
- [x] 1.2 `computeCostTrendData` with 0 repairs returns `[]` — b2633e0
- [x] 1.3 `computeCostTrendData` with all null-cost repairs returns `[]` — b2633e0
- [x] 1.4 `computeCostTrendData` with 1 costed repair returns array of length 1 — b2633e0
- [x] 1.5 `computeCostTrendData` with 2+ costed repairs returns correct cumulative values — b2633e0

#### Manual

- [x] 1.6 Transform logic verified by eyeballing output — b2633e0

### Phase 2: CostTrendChart Component

#### Automated

- [x] 2.1 TypeScript compiles: `npm run build` — 654f12e
- [x] 2.2 Lint passes: `npm run lint` — 654f12e

#### Manual

- [x] 2.3 Chart renders correctly on vehicle with 2+ costed repairs — 778d12e
- [x] 2.4 Chart absent on vehicle with < 2 costed repairs — 778d12e
- [x] 2.5 Tooltip shows correct date and value — 778d12e
- [x] 2.6 Chart is responsive on window resize — 778d12e
- [x] 2.7 Visual style consistent with page (dark glass-morphism) — 778d12e

### Phase 3: Page Integration

#### Automated

- [x] 3.1 Build passes: `npm run build` — 778d12e
- [x] 3.2 Lint passes: `npm run lint` — 778d12e

#### Manual

- [x] 3.3 Chart section visible on data-rich vehicle — 778d12e
- [x] 3.4 No chart section on data-sparse vehicle — 778d12e
- [x] 3.5 Chart between header and Service Reminders — 778d12e
- [x] 3.6 No visual regressions in other page sections — 778d12e
- [x] 3.7 No hydration errors in browser console — 778d12e

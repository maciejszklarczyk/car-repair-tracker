# Cost Trend Chart — Plan Brief

> Full plan: `context/changes/cost-trend-chart/plan.md`

## What & Why

Add a visual cumulative cost/km chart to the vehicle detail page (S-07 from roadmap). Users currently see only a scalar cost/km number — the chart shows how that value evolved over time, turning raw data into the insight the product promised.

## Starting Point

The vehicle detail page already fetches all repairs with `repair_date`, `cost`, and `mileage`. `computeCostPerKm()` produces the current scalar value. No charting library is installed; all analytics display as plain text.

## Desired End State

A Recharts AreaChart appears between the header stats card and Service Reminders on the vehicle detail page. X-axis: repair dates. Y-axis: cumulative cost/km at each repair point. Hidden when fewer than 2 costed repairs exist (no empty boxes). Tooltip on hover shows date + value.

## Key Decisions Made

| Decision          | Choice                                    | Why (1 sentence)                                                              |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| Chart metric      | Cumulative cost/km at each repair         | Matches the product's north-star metric; more insightful than per-repair cost |
| Library           | Recharts                                  | Most popular React charting lib, shadcn/ui recommends it, strong TS types     |
| Placement         | Between header card and Service Reminders | Prominent position — new feature won't be buried                              |
| Empty state       | Hidden if < 2 costed repairs              | No empty/misleading UI boxes                                                  |
| Null-cost repairs | Skipped                                   | Consistent with existing `computeCostPerKm()` which ignores null costs        |
| Rendering         | React island `client:load`                | Recharts requires browser APIs; same pattern as RepairList, ServiceReminders  |

## Scope

**In scope:** Chart component, data transform helper, page integration, responsive layout, dark-theme styling matching existing glass-morphism.

**Out of scope:** Multi-vehicle comparison, zoom/pan, category breakdown, separate API route, test suite.

## Architecture / Approach

`computeCostTrendData(vehicle, repairs)` transforms the already-fetched `Repair[]` into `CostTrendPoint[]` (sort ASC, filter null-cost, accumulate, divide by km delta). The Astro page computes this server-side and passes it as a prop to the `CostTrendChart` React island. No new DB queries needed.

## Phases at a Glance

| Phase                       | What it delivers                                               | Key risk                                                |
| --------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| 1. Library + Data Transform | Recharts installed; `computeCostTrendData()` in `costPerKm.ts` | Edge cases: mileage ≤ baseline at a given repair point  |
| 2. CostTrendChart Component | React island rendering the chart                               | Dark-theme styling fit with existing glassmorphism      |
| 3. Page Integration         | Chart wired into `[id].astro`, visible on data-rich vehicles   | Ordering of repairs — transform re-sorts ASC internally |

**Prerequisites:** None — all S-04 data structures already in place.  
**Estimated effort:** ~1 session across 3 short phases.

## Open Risks & Assumptions

- Recharts `~90 kB` gzipped added to bundle — acceptable given it's already a React-heavy page
- If a repair's `mileage` equals `baseline_mileage`, that point is silently skipped (no cost/km possible)

## Success Criteria (Summary)

- Vehicle with 2+ costed repairs shows the chart between header and service reminders
- Vehicle with < 2 costed repairs shows no chart section (no empty boxes)
- Tooltip shows correct date and cost/km on hover

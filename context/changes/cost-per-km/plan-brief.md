# Cost per km (S-04) — Plan Brief

> Full plan: `context/changes/cost-per-km/plan.md`

## What & Why

Display a cost/km metric on the vehicle detail page so the owner can immediately see how much they're spending per kilometre. This is the north-star slice of the roadmap — it proves the core vertical (add vehicle → add repair → read cost/km) works end to end.

## Starting Point

`cars` and `repairs` tables are both live with all required columns (`baseline_mileage`, `current_mileage`, `cost`). The vehicle detail page (`[id].astro`) already fetches the car and renders Year + Mileage. No new migration needed.

## Desired End State

The vehicle detail page shows `1.23 PLN/km` in the vehicle info block. When the value can't be computed (no costed repairs, or zero km delta), it shows `— PLN/km — no cost data yet`. The value is always fresh because the page is fully SSR.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Placement | Vehicle detail page only | Zero impact on vehicle list; user navigates to detail to read analytics | Plan |
| Edge case display | `— PLN/km` + inline label | Silent blank confuses users; labelled dash communicates "not enough data" | Plan |
| Number format | 2 decimal places, PLN/km | Matches `numeric(10,2)` precision; intuitive for Polish users | Plan |
| Computation layer | Pure helper in `src/lib/costPerKm.ts` | Testable in isolation and reusable for S-07 (cost trend chart) | Plan |
| null vs 0 for no-cost repairs | Return `null` | 0 PLN/km would be misleading — it implies free repairs, not missing data | Plan |

## Scope

**In scope:**
- `src/lib/costPerKm.ts` — pure formula function
- `src/pages/dashboard/vehicles/[id].astro` — repair fetch + metric display

**Out of scope:**
- Repair list / history (S-03)
- Cost/km on the vehicle list cards
- Real-time updates / subscriptions
- Cost trend chart (S-07)
- Any DB migration

## Architecture / Approach

Server-side only. The Astro page frontmatter fetches both the car and its repairs in two sequential Supabase queries, calls `computeCostPerKm(vehicle, repairs)`, and renders the result as a formatted string. No client-side state, no new API route.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Service Helper | Pure `computeCostPerKm()` function with edge-case guards | None — pure function, no side effects |
| 2. Page Integration | Cost/km rendered in `[id].astro` vehicle info block | Repair fetch fails silently → show `—` (acceptable fallback) |

**Prerequisites:** S-01 (cars table) + S-02 (repairs table) — both done.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- `baseline_mileage` is assumed never updated after vehicle creation; if a future slice allows editing it, the formula remains correct but the displayed value may surprise users who added repairs before the edit.

## Success Criteria (Summary)

- Vehicle detail shows correct `X.XX PLN/km` after at least one costed repair
- Vehicle detail shows `— PLN/km — no cost data yet` for zero/null-cost scenarios and zero km delta
- `npm run build` and `npm run lint` pass on both phases

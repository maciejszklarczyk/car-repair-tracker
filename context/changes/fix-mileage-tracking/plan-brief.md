# Fix Mileage Tracking — Plan Brief

> Full plan: `context/changes/fix-mileage-tracking/plan.md`

## What & Why

`cars.current_mileage` is written once at vehicle creation and never updated. Every display of "current mileage" and the cost/km formula reads this stale value, producing wrong numbers as repairs accumulate. Fix: drop the column, derive current mileage on-the-fly as `MAX(repairs.mileage)` with a `baseline_mileage` fallback.

## Starting Point

The DB has `cars.current_mileage` (static). `computeCostPerKm` reads it directly. Both the vehicle list card and detail page display it. The add-vehicle form collects it. None of these are updated when repairs are added or edited.

## Desired End State

Both the list card and detail page show the highest mileage value across all recorded repairs, updating on each page load. Cost/km uses `MAX(repairs.mileage) − baseline_mileage` as the km denominator. The `current_mileage` column is gone from the DB and from every app layer. Adding a repair immediately reflects the correct mileage on refresh.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| How to derive current mileage | `MAX(repairs.mileage)` in-memory / in-query | Single source of truth, no sync bugs | Plan |
| Fallback when no repairs | `baseline_mileage` | Always shows a meaningful number the user entered | Plan |
| Drop or keep the column | Drop (`ALTER TABLE cars DROP COLUMN`) | Clean schema; stale column causes the bug | Plan |
| List page strategy | PostgREST nested select `repairs(mileage)` | One round-trip, no DB view needed | Plan |
| Tests | Manual only | User decision | Plan |

## Scope

**In scope:**
- Drop `cars.current_mileage` DB column (migration)
- Remove from `Vehicle` type, `createVehicleSchema`, API handler, and add-vehicle form
- Extract `computeCurrentMileage` helper from `costPerKm.ts`
- Fix detail page (`[id].astro`) to compute and display derived mileage
- Fix list page (`index.astro`) to join with repairs and pass derived mileage to `VehicleCard`
- Update `VehicleCard.astro` to accept `currentMileage` prop

**Out of scope:**
- DB view or RPC
- Unit/integration tests
- Repair edit/delete flow changes
- Renaming `baseline_mileage`

## Architecture / Approach

A pure helper `computeCurrentMileage(repairs, baselineMileage)` centralises the derivation logic. The detail page calls it in-memory (repairs already loaded). The list page extends the Supabase query with `select("*, repairs(mileage)")` — PostgREST returns a nested array, JS reduces to MAX per vehicle. No new DB objects needed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Drop `current_mileage` | DB migration + type/schema/API/form cleanup | TypeScript build fails until Phase 2 completes display fixes |
| 2. Derive & display | `computeCurrentMileage` helper + detail + list + VehicleCard | PostgREST nested select must respect RLS — test with real auth |

**Prerequisites:** Local Supabase running (`npx supabase start`); repairs table populated with at least two repairs at different mileages for manual verification.
**Estimated effort:** ~1 session across 2 phases (7 files touched, no new API routes or migrations beyond the DROP).

## Open Risks & Assumptions

- PostgREST nested select `repairs(mileage)` is assumed to work via the FK relationship `repairs.car_id → cars.id`; if the relationship isn't auto-detected, a manual relationship hint may be needed in Supabase dashboard.
- Dropping a column is irreversible in local dev without a reset — verify on local first.

## Success Criteria (Summary)

- Vehicle with two repairs at 120 000 and 122 000 km shows 122 000 on both the list card and detail page
- Vehicle with no repairs shows `baseline_mileage` on both views
- Cost/km reflects the correct formula after the fix

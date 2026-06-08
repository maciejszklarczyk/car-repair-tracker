# Add Repair (S-02) — Plan Brief

> Full plan: `context/changes/add-repair/plan.md`

## What & Why

Record a repair (date, description, optional cost, mileage) against a vehicle. This is the second slice of the core vertical: data in (S-01 add vehicle, S-02 add repair) → insight out (S-04 cost/km). Without repairs in the DB, no downstream slice (cost/km, AI classification, history) has data to operate on.

## Starting Point

S-01 is complete: `cars` table exists with RLS, `Vehicle` type defined, VehicleCard renders on the vehicles list. No repair table, no repair UI, no vehicle detail page exists.

## Desired End State

Owner clicks "Add repair" on a vehicle card, fills in the form, submits, and lands on a minimal vehicle detail page with a success confirmation. The repair row is in the DB with correct ownership, optional cost stored as NULL when blank.

## Key Decisions Made

| Decision                   | Choice                                           | Why (1 sentence)                                                         | Source |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ | ------ |
| Entry point                | Button on VehicleCard → `?vehicle_id=<id>`       | Natural UX — "this car needs a repair" matches how owners think          | Plan   |
| Redirect target            | Minimal `/dashboard/vehicles/[id].astro`         | Sets up S-03 structure; gives user visible confirmation on the right car | Plan   |
| Date default               | Today's date pre-filled (client-side)            | 90% of repairs are recorded right after they happen                      | Plan   |
| Mileage validation         | Non-negative only, no cross-check vs car mileage | Past repairs are valid; cross-check adds DB read with little gain        | Plan   |
| Cost UX                    | Blank optional field, labelled "(optional)"      | Matches FormField pattern; simple and sufficient                         | Plan   |
| Description limit          | 500 chars, Zod + client counter                  | Prepares for AI classification input; prevents DB bloat                  | Plan   |
| vehicle_id ownership check | API fetches car before insert, confirms user_id  | RLS alone isn't enough when car_id comes from a URL param                | Plan   |

## Scope

**In scope:**

- `repairs` table migration + RLS (select + insert)
- `Repair` TypeScript interface
- `createRepairSchema` Zod validation
- `POST /api/repairs` route with ownership check
- `AddRepairForm.tsx` React component
- `/dashboard/repairs/new.astro` page
- Minimal `/dashboard/vehicles/[id].astro` vehicle detail page
- "Add repair" link on VehicleCard

**Out of scope:**

- AI category classification (S-05)
- Cost-per-km display (S-04)
- Repair list, edit, delete (S-03)
- Vehicle edit/archive

## Architecture / Approach

VehicleCard → `/dashboard/repairs/new?vehicle_id=<id>` → Astro page fetches car (SSR, ownership check) → React form (`client:load`, car context as props) → POST `/api/repairs` → ownership re-check → DB insert → redirect `/dashboard/vehicles/<id>?success=1` → vehicle detail page.

## Phases at a Glance

| Phase                        | What it delivers                                   | Key risk                                                             |
| ---------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| 1. DB migration + type       | `repairs` table, RLS, `Repair` interface           | Schema must accommodate future S-03/S-04 queries without migration   |
| 2. Schema + API              | Zod validation, POST endpoint with ownership check | Ownership check logic must run before insert, not rely on RLS alone  |
| 3. Form + page               | AddRepairForm, /dashboard/repairs/new              | Date default is client-side only — SSR renders blank field initially |
| 4. Detail page + VehicleCard | Entry point, redirect target                       | VehicleCard change is Astro (SSR) — no hydration issues              |

**Prerequisites:** S-01 complete (cars table, Vehicle type, vehicles list page).
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- `cost` stored as `numeric(10,2)` — if currency handling needs change later (e.g. non-PLN), schema migration needed.
- Vehicle detail page is minimal (placeholder repairs section) — S-03 will flesh it out; risk of duplication if S-03 rewrites the page significantly.

## Success Criteria (Summary)

- Owner can add a repair from the vehicles list and see it confirmed on the vehicle detail page
- Repair with no cost has `cost = NULL` in DB and is excluded from future cost/km (S-04 contract honoured)
- Attempting to submit a repair for another user's car is rejected

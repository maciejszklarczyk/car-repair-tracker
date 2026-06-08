# Add Repair (S-02) Implementation Plan

## Overview

Add the ability for an authenticated owner to record a repair (date, description, optional cost, mileage at repair time) against one of their vehicles. This slice completes the data-entry half of the core vertical: vehicle added (S-01) → repair recorded (S-02) → cost/km visible (S-04).

## Current State Analysis

- `cars` table exists with RLS (select + insert policies); `Vehicle` type defined in `src/types.ts`.
- No `repairs` table, no `Repair` type, no repair schema, no repair API route, no repair components.
- No vehicle detail page (`/dashboard/vehicles/[id].astro`) — VehicleCard is display-only.
- Reusable UI atoms available: `FormField`, `SubmitButton`, `ServerError` from `src/components/auth/`.
- API pattern established: FormData → Zod validate → Supabase insert → redirect (see `src/pages/api/vehicles.ts`).

## Desired End State

Owner opens the vehicles list, clicks "Add repair" on a vehicle card, fills in the form (date defaulting to today, description up to 500 chars, optional cost, mileage), submits, and lands on a minimal vehicle detail page confirming the repair was recorded. The repair row exists in the DB, owned by the authenticated user, with correct FK to the car.

### Key Discoveries

- `src/components/vehicles/VehicleCard.astro:1` — Astro component, needs one link added; no existing actions.
- `src/pages/api/vehicles.ts:5-44` — canonical API route pattern to mirror.
- `src/lib/schemas.ts:3-21` — Zod schema pattern with `.refine()` for cross-field validation.
- `src/components/vehicles/AddVehicleForm.tsx:1-149` — React form pattern with local state, `validate()`, `clearError()`, `handleSubmit()`.
- `supabase/migrations/20260526120000_create_cars_table.sql` — migration format and RLS policy pattern.

## What We're NOT Doing

- AI classification (S-05) — no `category` column or classification call in this slice.
- Cost-per-km calculation or display (S-04).
- Listing, editing, or deleting repairs (S-03).
- Vehicle archiving, editing, or deletion.
- Mileage cross-validation against `car.current_mileage` — non-negative only.

## Implementation Approach

Mirror the S-01 pattern exactly: migration → type → schema → API → React form → Astro page. Add one new artifact (vehicle detail page) as the redirect target. VehicleCard gets a single "Add repair" link.

The `vehicle_id` flows through query param → hidden form field → API validation (ownership check) → DB insert. The API fetches the car from Supabase before inserting to confirm `user_id` matches — one extra query, no middleware change needed.

## Phase 1: Database Migration + Repair Type

### Overview

Create the `repairs` table with FK to `cars`, enable RLS with select and insert policies, and add the `Repair` TypeScript interface.

### Changes Required

#### 1. Migration file

**File**: `supabase/migrations/20260531120000_create_repairs_table.sql`

**Intent**: Create `repairs` table, index it by car, enable RLS, add select-own and insert-own policies mirroring the cars table pattern.

**Contract**:

```sql
create table public.repairs (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  repair_date date not null,
  description text not null,
  cost numeric(10, 2),            -- nullable; excluded from cost/km when null
  mileage integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

RLS policies:

- `repairs_select_own`: `for select using (auth.uid() = user_id)`
- `repairs_insert_own`: `for insert with check (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.cars WHERE id = car_id AND user_id = auth.uid()))`

The EXISTS subquery enforces car ownership at the DB layer — direct Supabase API calls cannot insert repairs against another user's car even with a valid JWT.
Index on `car_id` for future list queries.

#### 2. Repair type

**File**: `src/types.ts`

**Intent**: Add `Repair` interface alongside `Vehicle`.

**Contract**:

```typescript
export interface Repair {
  id: string;
  car_id: string;
  user_id: string;
  repair_date: string; // ISO date string "YYYY-MM-DD"
  description: string;
  cost: number | null;
  mileage: number;
  created_at: string;
  updated_at: string;
}
```

### Success Criteria

#### Automated Verification

- Migration applies cleanly against local Supabase: `npx supabase db reset` (or `supabase migration up`)
- TypeScript compiles: `npm run build` (no type errors)

#### Manual Verification

- `repairs` table visible in Supabase Studio with correct columns and RLS enabled
- Attempting to insert a repair with a `car_id` belonging to another user fails (RLS rejects it)

**Implementation Note**: Pause after Phase 1 passes manual verification before proceeding to Phase 2.

---

## Phase 2: Zod Schema + API Route

### Overview

Add `createRepairSchema` to the shared schemas file and implement the `POST /api/repairs` route following the exact vehicles API pattern.

### Changes Required

#### 1. Repair schema

**File**: `src/lib/schemas.ts`

**Intent**: Add `createRepairSchema` validating all repair fields. Cost is optional (empty string → `undefined` → `null` in DB). Description capped at 500 chars.

**Contract**: Fields: `repair_date` (non-empty ISO date string), `description` (1–500 chars), `cost` (optional positive decimal), `mileage` (non-negative integer), `car_id` (non-empty string — validated for ownership in the API, not in Zod).

#### 2. API route

**File**: `src/pages/api/repairs.ts`

**Intent**: POST handler that authenticates the user, validates that the target car belongs to them, validates form data via `createRepairSchema`, inserts into `repairs`, and redirects to `/dashboard/vehicles/<car_id>`.

**Contract**: Pattern mirrors `src/pages/api/vehicles.ts` exactly. Extra step between auth check and insert: fetch `cars` row by `car_id` and confirm `user_id === user.id`; if not found or mismatched → redirect with error. Cost field: `form.get("cost")` empty string → `null`, non-empty → `Number(...)`. On success, redirect to `/dashboard/vehicles/<car_id>?success=1`.

### Success Criteria

#### Automated Verification

- TypeScript compiles: `npm run build`
- `npm run lint` passes

#### Manual Verification

- POST to `/api/repairs` with valid data and a valid session creates a row in `repairs`
- POST with a `car_id` belonging to another user returns redirect with error (ownership check works)
- POST with empty `description` or invalid `mileage` returns redirect with validation error

**Implementation Note**: Test with `curl` or Supabase Studio before building the UI.

---

## Phase 3: Add Repair Form + Page

### Overview

Create the React form component and the Astro page that hosts it. The page reads `vehicle_id` from query params and passes it (and the vehicle's make/model for display) to the form.

### Changes Required

#### 1. React form component

**File**: `src/components/repairs/AddRepairForm.tsx`

**Intent**: Client-side validated form for a repair. Same structure as `AddVehicleForm.tsx`: local state per field, `validate()`, `clearError()`, `handleSubmit()`. Includes a hidden `car_id` field. Date field defaults to today's date (`new Date().toISOString().split("T")[0]`). Cost field labelled "Cost (PLN) — optional". Opis textarea (not input) with character counter showing remaining chars out of 500.

**Contract**:

```typescript
interface Props {
  carId: string;
  vehicleName: string; // e.g. "Skoda Octavia (2018)" — displayed above form
  serverError?: string | null;
}
```

Form `action="/api/repairs"`, method POST. Fields: `car_id` (hidden), `repair_date` (date), `description` (textarea, maxLength=500), `cost` (number, optional), `mileage` (number).

Use `FormField` for date, cost, mileage. For `description`, create `src/components/ui/TextareaField.tsx` — same label/error/icon visual structure as `FormField` but renders `<textarea>` instead of `<input>`, with a char counter (`{500 - description.length} chars remaining`) below the textarea. Import and use `TextareaField` in `AddRepairForm` for the description field.

#### 2. Astro page

**File**: `src/pages/dashboard/repairs/new.astro`

**Intent**: Server-renders the page; reads `vehicle_id` from query params, fetches the car from Supabase to confirm ownership and get display name, renders `AddRepairForm` with `client:load`.

**Contract**: If `vehicle_id` missing or car not found/not owned → redirect to `/dashboard/vehicles` with error. Passes `carId` and `vehicleName` ("`${car.make} ${car.model} (${car.year})`") to the form component. Reads `error` query param for `serverError` prop (same pattern as `new.astro` for vehicles).

### Success Criteria

#### Automated Verification

- `npm run build` passes
- `npm run lint` passes

#### Manual Verification

- Navigating to `/dashboard/repairs/new?vehicle_id=<valid-id>` renders the form with vehicle name visible
- Navigating without `vehicle_id` redirects to vehicles list
- Client-side validation prevents submit: empty description, non-numeric mileage, description > 500 chars
- Submitting valid form creates repair and redirects to vehicle detail page

---

## Phase 4: Vehicle Detail Page + VehicleCard Entry Point

### Overview

Create the minimal vehicle detail page that serves as the redirect target after repair submission, and add an "Add repair" link to `VehicleCard`.

### Changes Required

#### 1. Vehicle detail page

**File**: `src/pages/dashboard/vehicles/[id].astro`

**Intent**: Minimal SSR page showing vehicle name, year, mileage, and a "Repair added successfully" banner when a `success` query param is present. Includes a static placeholder section for repair history (visible but empty — content comes in S-03). Serves as the redirect target from `POST /api/repairs`.

**Contract**: Reads `id` from `Astro.params`. Fetches car from Supabase (select-own via RLS); redirects to `/dashboard/vehicles` if not found. Reads `success` query param for success banner. Shows "No repairs yet" placeholder in the repairs section. Add a "Back to vehicles" link and an "Add repair" button linking to `/dashboard/repairs/new?vehicle_id=<id>`.

#### 2. VehicleCard update

**File**: `src/components/vehicles/VehicleCard.astro`

**Intent**: Add an "Add repair" link/button to each card so users can navigate to the form directly from the vehicles list.

**Contract**: Accepts same `vehicle: Vehicle` prop. Add anchor tag styled as a secondary button below the existing content, pointing to `/dashboard/repairs/new?vehicle_id=${vehicle.id}`. Match existing Tailwind styling conventions.

### Success Criteria

#### Automated Verification

- `npm run build` passes
- `npm run lint` passes

#### Manual Verification

- Vehicles list shows "Add repair" on each card; clicking navigates to correct form URL
- After submitting a repair, user lands on `/dashboard/vehicles/<id>` with success banner
- Vehicle detail page shows correct vehicle info
- Direct navigation to `/dashboard/vehicles/<nonexistent-id>` redirects to vehicles list

---

## Testing Strategy

### Manual Testing Steps

1. Add a vehicle via the existing flow, note its ID
2. Click "Add repair" on the vehicle card
3. Verify form shows vehicle name, date defaults to today
4. Submit with empty description → error shown
5. Submit with description > 500 chars → error shown
6. Submit valid repair without cost → repair saved, redirects to vehicle detail with success banner
7. Submit valid repair with cost → same flow
8. Open Supabase Studio → verify `repairs` row has correct `car_id`, `user_id`, `cost` values
9. Verify repair with no cost has `cost = NULL` in DB

## Migration Notes

Migration filename uses timestamp `20260531120000` to sort after the cars migration (`20260526120000`). Run `npx supabase db reset` locally to apply.

## References

- S-01 implementation: `src/pages/api/vehicles.ts`, `src/components/vehicles/AddVehicleForm.tsx`
- Cars migration: `supabase/migrations/20260526120000_create_cars_table.sql`
- Roadmap entry S-02: `context/foundation/roadmap.md:79-89`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database Migration + Repair Type

#### Automated

- [x] 1.1 Migration applies cleanly (npx supabase db reset) — 9006e28
- [x] 1.2 TypeScript compiles — npm run build — 9006e28

#### Manual

- [x] 1.3 repairs table visible in Supabase Studio with correct columns and RLS — 9006e28
- [x] 1.4 Insert with foreign car_id rejected by RLS — 9006e28

### Phase 2: Zod Schema + API Route

#### Automated

- [x] 2.1 TypeScript compiles — npm run build — 4b229ca
- [x] 2.2 npm run lint passes — 4b229ca

#### Manual

- [x] 2.3 POST with valid data creates repairs row — 4b229ca
- [x] 2.4 POST with another user's car_id returns error (ownership check) — 4b229ca
- [x] 2.5 POST with invalid fields returns validation error redirect — 4b229ca

### Phase 3: Add Repair Form + Page

#### Automated

- [x] 3.1 npm run build passes — 02eae33
- [x] 3.2 npm run lint passes — 02eae33

#### Manual

- [x] 3.3 /dashboard/repairs/new?vehicle_id=<valid> renders form with vehicle name — 02eae33
- [x] 3.4 Missing vehicle_id redirects to vehicles list — 02eae33
- [x] 3.5 Client-side validation blocks invalid submit — 02eae33
- [x] 3.6 Valid submit creates repair and redirects to vehicle detail page — 02eae33

### Phase 4: Vehicle Detail Page + VehicleCard Entry Point

#### Automated

- [x] 4.1 npm run build passes — 557d72d
- [x] 4.2 npm run lint passes — 557d72d

#### Manual

- [x] 4.3 VehicleCard shows "Add repair" link on vehicles list — 557d72d
- [x] 4.4 Post-repair redirect lands on vehicle detail with success banner — 557d72d
- [x] 4.5 Vehicle detail shows correct vehicle info — 557d72d
- [x] 4.6 Nonexistent vehicle ID redirects to vehicles list — 557d72d

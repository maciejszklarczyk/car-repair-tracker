# Add Vehicle — Implementation Plan

## Overview

Implement S-01 from the roadmap: an authenticated owner can add a vehicle (make, model, year, current mileage, baseline mileage) and see it listed on a dedicated vehicles page. This is the first vertical slice — it introduces the `cars` table, RLS policies, API endpoint, types, and two new pages. The schema must accommodate downstream slices (S-02 through S-07) without requiring schema changes.

## Current State Analysis

- Auth is fully wired: Supabase SSR client, middleware with `context.locals.user`, protected routes
- Dashboard is a placeholder showing email + signout
- No `src/types.ts`, no migrations directory, no business-logic API endpoints
- UI components: only `button.tsx` from shadcn; auth forms use custom `FormField`, `SubmitButton`, `ServerError` React components
- Form submission pattern: HTML `<form method="POST">` to API route, redirect on success/error with query param for error message

### Key Discoveries:

- `supabase` devDependency present — `npx supabase` available for migration commands
- `PROTECTED_ROUTES` in middleware uses `startsWith` — adding `/dashboard` already protects `/dashboard/vehicles` and `/dashboard/vehicles/new`
- No `supabase/migrations/` directory yet — needs creation alongside first migration
- Astro env schema has `SUPABASE_URL` and `SUPABASE_KEY` as optional — supabase client returns `null` when missing

## Desired End State

After this plan is complete:

- A `cars` table exists in Supabase with RLS enforcing per-owner isolation
- An authenticated owner visiting `/dashboard/vehicles` sees their vehicle list (or an empty state with a call-to-action)
- Clicking "Add vehicle" navigates to `/dashboard/vehicles/new` with a form
- Submitting the form creates the vehicle and redirects back to the list
- Validation prevents bad data (missing required fields, invalid ranges)
- The dashboard (`/dashboard`) redirects to `/dashboard/vehicles`

Verification: log in with two different accounts, add vehicles from each, confirm each account sees only their own cars.

## What We're NOT Doing

- Edit or archive vehicles (deferred per scope decision — schema includes `archived_at` for future use)
- Delete vehicles
- Vehicle detail page
- Any repair-related functionality (S-02)
- Automated tests (manual CRUD verification per roadmap risk note)
- Dashboard overview/summary page design

## Implementation Approach

Bottom-up: database → types → API → pages. Each phase is independently verifiable. The form follows the existing HTML POST + redirect pattern from auth forms.

## Phase 1: Database Migration + RLS

### Overview

Create the `cars` table with RLS policies that enforce per-owner data isolation.

### Changes Required:

#### 1. Supabase migration

**File**: `supabase/migrations/20260526120000_create_cars_table.sql`

**Intent**: Create the `cars` table with all columns needed for S-01 and schema-level preparation for downstream slices. Enable RLS with granular per-operation policies.

**Contract**: Table `cars` with columns:

- `id` UUID PK default `gen_random_uuid()`
- `user_id` UUID NOT NULL references `auth.users(id)` on delete cascade
- `make` TEXT NOT NULL
- `model` TEXT NOT NULL
- `year` INTEGER NOT NULL
- `current_mileage` INTEGER NOT NULL
- `baseline_mileage` INTEGER NOT NULL
- `archived_at` TIMESTAMPTZ NULL (for future FR-002 archive)
- `created_at` TIMESTAMPTZ NOT NULL default `now()`
- `updated_at` TIMESTAMPTZ NOT NULL default `now()`

RLS policies:

- `cars_select_own`: SELECT where `auth.uid() = user_id`
- `cars_insert_own`: INSERT with check `auth.uid() = user_id`

Index on `user_id` for list query performance.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset` (or `npx supabase migration up` on running instance)
- Table visible in Supabase Studio at `localhost:54323`

#### Manual Verification:

- In Supabase SQL Editor: insert a row with a valid `user_id` from `auth.users` — succeeds
- Insert with a different `user_id` while authenticated as another user — blocked by RLS
- Select returns only rows matching the authenticated user

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Types + Zod Schema + API Endpoint

### Overview

Define the Vehicle type, zod validation schema, and the POST API endpoint for creating a vehicle.

### Changes Required:

#### 0. Install zod

**Command**: `npm install zod`

**Intent**: Add zod as a runtime dependency for input validation.

#### 1. Shared types

**File**: `src/types.ts` (new file)

**Intent**: Define the `Vehicle` type matching the `cars` table shape, to be shared across API and UI layers.

**Contract**: Export `Vehicle` interface with fields matching the DB columns.

#### 2. Validation schema

**File**: `src/lib/schemas.ts` (new file)

**Intent**: Zod schema for vehicle creation input with the agreed validation rules.

**Contract**: Export `createVehicleSchema` — zod object with:

- `make`: string, trimmed, min 1
- `model`: string, trimmed, min 1
- `year`: number, integer, min 1900, max current year
- `current_mileage`: number, integer, min 0
- `baseline_mileage`: number, integer, min 0
- Refine: `current_mileage >= baseline_mileage`

#### 3. API endpoint

**File**: `src/pages/api/vehicles.ts` (new file)

**Intent**: POST endpoint that validates input, inserts into `cars` table via Supabase client, and redirects to the vehicle list.

**Contract**: Export `POST` APIRoute. Reads form data, validates with `createVehicleSchema`, inserts with `user_id` from `context.locals.user.id`. On success: redirect to `/dashboard/vehicles`. On validation error: redirect to `/dashboard/vehicles/new?error=<message>`. On Supabase error: redirect with error message.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npx astro check` passes
- Lint passes: `npm run lint`

#### Manual Verification:

- POST to `/api/vehicles` with valid form data creates a row in `cars` table
- POST with invalid data (e.g. year = 0) redirects back with error message
- POST without authentication returns 401 or redirects to signin

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Vehicle List Page

### Overview

Create the `/dashboard/vehicles` page that fetches and displays the authenticated owner's vehicles.

### Changes Required:

#### 1. Vehicle list page

**File**: `src/pages/dashboard/vehicles/index.astro`

**Intent**: Server-rendered page that queries the owner's vehicles from Supabase and displays them in a list. Shows an empty state with a CTA when no vehicles exist.

**Contract**: Astro page using `Layout`. Fetches `cars` where `archived_at IS NULL`, ordered by `created_at DESC`. Renders each vehicle as a card/row showing make, model, year, current mileage. Includes "Add vehicle" link/button pointing to `/dashboard/vehicles/new`. Error query param displayed as alert.

#### 2. Vehicle card component

**File**: `src/components/vehicles/VehicleCard.astro`

**Intent**: Presentational component for a single vehicle in the list.

**Contract**: Astro component accepting `Vehicle` props, rendering make + model as title, year and mileage as metadata. Static — no interactivity needed.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npx astro check` passes
- Lint passes: `npm run lint`
- Page renders without error on `npm run dev`

#### Manual Verification:

- Visiting `/dashboard/vehicles` while authenticated shows empty state when no vehicles exist
- After adding vehicles via SQL/API, they appear in the list
- Unauthenticated visit redirects to `/auth/signin`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Add Vehicle Form

### Overview

Create the `/dashboard/vehicles/new` page with a React form component for adding a vehicle.

### Changes Required:

#### 1. Add vehicle form component

**File**: `src/components/vehicles/AddVehicleForm.tsx`

**Intent**: React island with form fields for make, model, year, current mileage, and baseline mileage. Client-side validation matching the zod schema. Submits as HTML form POST to `/api/vehicles`.

**Contract**: React component. Uses the existing `FormField` pattern from auth forms (or equivalent). Fields: make (text), model (text), year (number), current_mileage (number), baseline_mileage (number). Client-side validation on submit: required fields, year range, mileage >= 0, current >= baseline. Form action: `POST /api/vehicles`. Accepts `serverError` prop for displaying redirect-based errors.

#### 2. Add vehicle page

**File**: `src/pages/dashboard/vehicles/new.astro`

**Intent**: Astro page wrapping the `AddVehicleForm` React island.

**Contract**: Astro page using `Layout`. Reads `error` from `Astro.url.searchParams`. Renders `AddVehicleForm` with `client:load` directive, passing `serverError`.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npx astro check` passes
- Lint passes: `npm run lint`

#### Manual Verification:

- Form renders all fields correctly
- Client-side validation prevents submission of empty/invalid data
- Successful submission creates vehicle and redirects to `/dashboard/vehicles` where new vehicle appears
- Server-side validation error displays on the form
- Form works without JavaScript (progressive enhancement — HTML form still posts)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Navigation + Polish

### Overview

Wire up navigation: dashboard redirects to vehicles, topbar gets nav links, protected routes are consistent.

### Changes Required:

#### 1. Dashboard redirect

**File**: `src/pages/dashboard.astro`

**Intent**: Redirect `/dashboard` to `/dashboard/vehicles` so the old placeholder is replaced by the vehicle list as the landing page for authenticated users.

**Contract**: Replace page content with a server-side redirect to `/dashboard/vehicles`.

#### 2. Topbar navigation

**Files**: `src/components/Topbar.astro`, `src/components/Welcome.astro`

**Intent**: Update Topbar with vehicle navigation and move it from Welcome.astro to Layout so it appears on all authenticated pages without duplication.

**Contract**: Update Topbar: change `/dashboard` link to `/dashboard/vehicles`, add "My Vehicles" nav link. Remove Topbar import/render from `Welcome.astro` (it will be rendered from Layout instead). Keep user email + signout button.

#### 3. Layout integration

**File**: `src/layouts/Layout.astro`

**Intent**: Include the topbar/nav in the layout so it appears on all pages.

**Contract**: Render `Topbar` component in layout **conditionally** — only when `Astro.locals.user` is truthy. Auth pages (signin, signup, confirm-email) will not show the topbar.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npx astro check` passes
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- `/dashboard` redirects to `/dashboard/vehicles`
- Topbar shows on all pages with correct links
- Sign out from topbar works
- Full flow: sign in → see vehicles → add vehicle → see it listed → sign out
- RLS isolation: repeat with second account, confirm no data leakage

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Manual Testing Steps:

1. Sign up / sign in as User A
2. Visit `/dashboard/vehicles` — see empty state
3. Click "Add vehicle", fill form (e.g. Skoda Octavia 2018, mileage 145000/142000)
4. Submit — redirected to vehicle list, new car visible
5. Add a second vehicle
6. Sign out, sign in as User B
7. Visit `/dashboard/vehicles` — see empty state (User A's cars NOT visible)
8. Add a vehicle as User B — only User B's car visible
9. Test validation: try submitting empty form, year=0, baseline > current
10. Test form without JS disabled — HTML form still works

## Performance Considerations

No performance concerns at this scale. UUID index on `user_id` ensures list queries are fast. No pagination needed for S-01 (an owner with 1-3 cars per the persona).

## Migration Notes

First migration creates `supabase/migrations/` directory. Migration timestamp should be generated fresh at implementation time. `npx supabase db reset` is the simplest verification path for local development.

## References

- Roadmap slice: `context/foundation/roadmap.md` §S-01
- PRD requirements: FR-001, FR-002, US-01
- Auth form pattern: `src/components/auth/SignInForm.tsx`
- API endpoint pattern: `src/pages/api/auth/signin.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Migration + RLS

#### Automated

- [x] 1.1 Migration applies cleanly — 0164bd1
- [x] 1.2 Table visible in Supabase Studio — 0164bd1

#### Manual

- [x] 1.3 Insert with valid user_id succeeds — 0164bd1
- [x] 1.4 RLS blocks cross-user access — 0164bd1
- [x] 1.5 Select returns only authenticated user's rows — 0164bd1

### Phase 2: Types + Zod Schema + API Endpoint

#### Automated

- [x] 2.1 TypeScript compiles
- [x] 2.2 Lint passes

#### Manual

- [x] 2.3 POST with valid data creates row
- [x] 2.4 POST with invalid data shows error
- [x] 2.5 POST without auth rejected

### Phase 3: Vehicle List Page

#### Automated

- [ ] 3.1 TypeScript compiles
- [ ] 3.2 Lint passes
- [ ] 3.3 Page renders without error

#### Manual

- [ ] 3.4 Empty state shown when no vehicles
- [ ] 3.5 Vehicles appear after adding via API
- [ ] 3.6 Unauthenticated visit redirects to signin

### Phase 4: Add Vehicle Form

#### Automated

- [ ] 4.1 TypeScript compiles
- [ ] 4.2 Lint passes

#### Manual

- [ ] 4.3 Form renders all fields
- [ ] 4.4 Client-side validation works
- [ ] 4.5 Successful submit creates vehicle + redirects
- [ ] 4.6 Server error displays on form
- [ ] 4.7 Form works without JavaScript

### Phase 5: Navigation + Polish

#### Automated

- [ ] 5.1 TypeScript compiles
- [ ] 5.2 Lint passes
- [ ] 5.3 Build succeeds

#### Manual

- [ ] 5.4 Dashboard redirects to vehicles
- [ ] 5.5 Topbar navigation works
- [ ] 5.6 Full end-to-end flow works
- [ ] 5.7 RLS isolation verified with two accounts
- [ ] 5.8 Sign out from topbar works

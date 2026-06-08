# Repair History — Browse, Edit & Delete (S-03) Implementation Plan

## Overview

Fill the "No repairs yet" placeholder on the vehicle detail page with a full repair history list, and add edit and delete capabilities for each repair. This completes the S-03 outcome: owner can browse, edit, and delete repairs from a single vehicle view.

## Current State Analysis

- `repairs` table exists (migration `20260531120000`) with SELECT + INSERT RLS only — no UPDATE or DELETE policies.
- `Repair` TypeScript type in `src/types.ts`, `createRepairSchema` in `src/lib/schemas.ts`.
- `POST /api/repairs` exists at `src/pages/api/repairs.ts` for creating repairs.
- Vehicle detail page (`src/pages/dashboard/vehicles/[id].astro:64-70`) has a static "No repairs yet" placeholder — no repair data is fetched.
- No edit or delete API routes, no edit form component.

## Desired End State

The vehicle detail page fetches all repairs for the vehicle (date-descending) and renders them in a `RepairList` React island. Each row shows date, truncated description, cost, and mileage, with an "Edit" link and a "Delete" button. Delete opens a shadcn AlertDialog for confirmation; on confirm the repair is removed and the page reloads. Edit navigates to `/dashboard/repairs/[id]/edit`, which renders a pre-filled form; on save the user lands back on the vehicle detail page.

### Key Discoveries

- `src/pages/dashboard/vehicles/[id].astro:64-70` — static placeholder to replace with `<RepairList>` island.
- `src/pages/api/repairs.ts` — existing POST route; new `repairs/[id].ts` sits alongside it without conflict.
- `src/components/repairs/AddRepairForm.tsx:1-133` — exact structural template for `EditRepairForm.tsx`.
- `src/components/auth/FormField.tsx` + `src/components/ui/TextareaField.tsx` — reuse in edit form.
- shadcn AlertDialog not yet in the project — needs `npx shadcn@latest add alert-dialog` before Phase 4.

## What We're NOT Doing

- Cost-per-km recalculation (S-04) — delete removes the row; no aggregate is updated yet.
- AI category classification (S-05).
- Repair list pagination or sort controls — date-descending, all repairs shown.
- Mileage cross-validation against `car.current_mileage`.

## Implementation Approach

Four phases in dependency order: DB policies → API routes → edit UI → list UI. Edit uses a separate Astro page mirroring the add-repair pattern. Delete is handled by a `fetch()` call from the React island with shadcn AlertDialog confirmation, then `window.location.reload()`. PUT and DELETE API routes return JSON (not redirects) because they are called via `fetch()`, not form POST.

## Phase 1: RLS Migration

### Overview

Add UPDATE and DELETE RLS policies to the `repairs` table so the new API routes can operate on owned rows.

### Changes Required

#### 1. Migration file

**File**: `supabase/migrations/20260602120000_add_repairs_update_delete_policies.sql`

**Intent**: Add `repairs_update_own` and `repairs_delete_own` policies, mirroring the existing select/insert ownership pattern.

**Contract**:

```sql
create policy "repairs_update_own"
  on public.repairs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "repairs_delete_own"
  on public.repairs for delete
  using (auth.uid() = user_id);
```

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase migration up` (or `npx supabase db reset`)

#### Manual Verification

- Supabase Studio shows UPDATE + DELETE policies on the `repairs` table.

**Implementation Note**: Pause here, confirm policies visible in Studio before proceeding.

---

## Phase 2: API Routes — PUT + DELETE

### Overview

Add `src/pages/api/repairs/[id].ts` with PUT (update) and DELETE handlers. Both authenticate, verify ownership, then operate. Both return JSON because they are called via `fetch()`.

### Changes Required

#### 1. `updateRepairSchema` in schemas.ts

**File**: `src/lib/schemas.ts`

**Intent**: Add `updateRepairSchema` — same validation rules as `createRepairSchema` but without `car_id`, which is immutable on update.

**Contract**: Fields: `repair_date` (non-empty ISO date string), `description` (1–500 chars), `cost` (`z.number().positive().nullable().optional()` — JSON sends a number or null, not a string; no string transform), `mileage` (non-negative integer). Export as `updateRepairSchema`. Note: `cost` intentionally differs from `createRepairSchema.cost` (which uses `z.string().transform()` for FormData input).

#### 2. API route

**File**: `src/pages/api/repairs/[id].ts`

**Intent**: PUT handler validates and updates the repair; DELETE handler removes it. Both verify ownership before acting.

**Contract**:

- `export const prerender = false`
- Ownership check shared by both: `supabase.from("repairs").select("id, user_id").eq("id", repairId).single()` — if not found or `user_id !== user.id`, return `Response.json({ error: "Forbidden" }, { status: 403 })`.
- `PUT`: parse `context.params.id`, check ownership, parse `await context.request.json()`, validate with `updateRepairSchema`, run `supabase.from("repairs").update({...}).eq("id", repairId)`, return `Response.json({ success: true })` on success or `Response.json({ error: message }, { status: 400 })` on validation/DB error.
- `DELETE`: parse `context.params.id`, check ownership, run `supabase.from("repairs").delete().eq("id", repairId)`, return `Response.json({ success: true })`.

### Success Criteria

#### Automated Verification

- `npm run build` passes
- `npm run lint` passes

#### Manual Verification

- `PUT /api/repairs/<valid-id>` with valid JSON body updates the row in Supabase Studio.
- `PUT /api/repairs/<other-user-repair-id>` returns 403.
- `DELETE /api/repairs/<valid-id>` removes the row.
- `DELETE /api/repairs/<other-user-repair-id>` returns 403.

**Implementation Note**: Test with curl or fetch in browser console before building the edit UI.

---

## Phase 3: Edit Form + Edit Page

### Overview

Create `EditRepairForm.tsx` (pre-filled variant of `AddRepairForm.tsx`) and the Astro edit page that fetches the repair and renders the form.

### Changes Required

#### 1. EditRepairForm component

**File**: `src/components/repairs/EditRepairForm.tsx`

**Intent**: Pre-filled form for editing an existing repair. Mirrors `AddRepairForm.tsx` structure exactly — same fields, same `validate()` / `clearError()` pattern. On submit, calls `fetch('/api/repairs/${repair.id}', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({...}) })`. On success (`response.ok`), sets `window.location.href = /dashboard/vehicles/${repair.car_id}?success=updated`. On API error, sets local `serverError` state from the response JSON.

**Contract**:

```typescript
interface Props {
  repair: Repair;
  vehicleName: string;
}
```

Initial state for each field sourced from `repair` prop: `repairDate = repair.repair_date`, `description = repair.description`, `cost = repair.cost != null ? String(repair.cost) : ""`, `mileage = String(repair.mileage)`. SubmitButton label: "Save changes". No hidden `car_id` field needed — the repair ID in the URL owns the identity.

#### 2. Edit page

**File**: `src/pages/dashboard/repairs/[id]/edit.astro`

**Intent**: SSR page that fetches the repair by `id`, confirms ownership, fetches the associated vehicle for display name, then renders `EditRepairForm` with `client:load`.

**Contract**: Read `id` from `Astro.params`. Fetch `repairs` row by id with `supabase.from("repairs").select("*").eq("id", id).single()`; if not found or `user_id !== user.id`, redirect to `/dashboard/vehicles`. Fetch associated `cars` row using `repair.car_id` for the vehicle name. Pass `repair` and `vehicleName` (`${car.make} ${car.model} (${car.year})`) to `<EditRepairForm client:load />`. Page title: "Edit repair".

### Success Criteria

#### Automated Verification

- `npm run build` passes
- `npm run lint` passes

#### Manual Verification

- Navigating to `/dashboard/repairs/<valid-repair-id>/edit` renders the form with all fields pre-filled.
- Navigating with an unknown or another user's repair ID redirects to vehicles list.
- Saving valid changes updates the row and redirects to vehicle detail with `?success=updated`.
- Client-side validation blocks empty description and invalid mileage.
- Cost field empty string on save → `cost: null` in DB.

---

## Phase 4: RepairList Island + Vehicle Detail Page Update

### Overview

Build the `RepairList.tsx` React island for rendering the history list with edit/delete, then wire it into the vehicle detail page replacing the static placeholder.

### Changes Required

#### 1. Install AlertDialog

**Terminal command**: `npx shadcn@latest add alert-dialog`

**Intent**: Add shadcn AlertDialog component to `src/components/ui/alert-dialog.tsx` so RepairList can use it for delete confirmation.

#### 2. RepairList component

**File**: `src/components/repairs/RepairList.tsx`

**Intent**: Renders the repair list with edit link and delete button per row. Delete opens AlertDialog; on confirm calls `fetch('/api/repairs/${repair.id}', { method: 'DELETE' })` then `window.location.reload()`. Empty state renders "No repairs yet." paragraph when `repairs.length === 0`.

**Contract**:

```typescript
interface Props {
  repairs: Repair[];
  carId: string;
}
```

Repairs are pre-sorted date-descending by the caller. Each row layout: `repair_date` (formatted as locale date string), description (`line-clamp-2` CSS class), cost (`cost != null ? ${cost.toLocaleString()} PLN : "—"`), mileage (`${mileage.toLocaleString()} km`). Edit link: `href={/dashboard/repairs/${repair.id}/edit}`. AlertDialog trigger: "Delete" button. AlertDialog title: "Delete repair?", description: "This action cannot be undone.", confirm button: "Delete" (destructive variant). On delete API error, show inline error message via local `deleteError` state.

#### 3. Vehicle detail page update

**File**: `src/pages/dashboard/vehicles/[id].astro`

**Intent**: Fetch all repairs for the vehicle and pass them to the RepairList island, replacing the static placeholder.

**Contract**: After the existing `vehicle` fetch, add:

```ts
const { data: repairs } = await supabase
  .from("repairs")
  .select("*")
  .eq("car_id", id)
  .order("repair_date", { ascending: false });
```

Import `RepairList` from `@/components/repairs/RepairList`. Replace lines 64–70 (the static placeholder `<div>`) with:

```astro
<RepairList repairs={repairs ?? []} carId={vehicle.id} client:load />
```

Keep the `<h2>Repair History</h2>` heading outside the island. Also update the success banner to distinguish `?success=1` ("Repair added successfully.") from `?success=updated` ("Repair saved.").

### Success Criteria

#### Automated Verification

- `npm run build` passes
- `npm run lint` passes

#### Manual Verification

- Vehicle detail page shows all repairs in date-descending order.
- Each row displays date, truncated description (2 lines), cost or "—", mileage.
- Clicking "Edit" navigates to the pre-filled edit page.
- Clicking "Delete" opens AlertDialog; cancelling leaves the row intact.
- Confirming delete removes the row and reloads the page with the repair gone.
- Vehicle with zero repairs shows the "No repairs yet." empty state.
- Adding a repair via "Add repair" → redirects back, new repair appears at the top of the list.
- "Repair saved." banner appears after a successful edit redirect.

---

## Testing Strategy

### Manual Testing Steps

1. Open vehicle detail for a vehicle with at least 2 repairs; confirm list renders in date-descending order.
2. Click "Edit" on one repair — verify form pre-filled; change description; save — verify update in Studio and in the list.
3. Click "Delete" on a repair — verify AlertDialog appears; cancel — verify repair still present.
4. Click "Delete" — confirm — verify row gone from list and from Studio.
5. Verify no-repairs empty state for a vehicle with zero repairs.
6. Verify delete of another user's repair returns 403 (curl or Supabase Studio direct insert test).
7. Verify edit of another user's repair returns 403.

## Migration Notes

Migration timestamp `20260602120000` sorts after `20260531120000` (create repairs) — correct order. Apply with `npx supabase migration up`.

## References

- S-02 plan: `context/changes/add-repair/plan.md`
- Repair POST API: `src/pages/api/repairs.ts`
- AddRepairForm pattern: `src/components/repairs/AddRepairForm.tsx:1-133`
- Vehicle detail page: `src/pages/dashboard/vehicles/[id].astro`
- Roadmap S-03: `context/foundation/roadmap.md:91-101`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: RLS Migration

#### Automated

- [x] 1.1 Migration applies cleanly (npx supabase migration up) — d16c10a

#### Manual

- [x] 1.2 Supabase Studio shows UPDATE + DELETE policies on repairs table — d16c10a

### Phase 2: API Routes — PUT + DELETE

#### Automated

- [x] 2.1 npm run build passes — 2f379ff
- [x] 2.2 npm run lint passes — 2f379ff

#### Manual

- [x] 2.3 PUT with valid body updates repair row — 2f379ff
- [x] 2.4 PUT with another user's repair returns 403 — 2f379ff
- [x] 2.5 DELETE removes the row — 2f379ff
- [x] 2.6 DELETE with another user's repair returns 403 — 2f379ff

### Phase 3: Edit Form + Edit Page

#### Automated

- [x] 3.1 npm run build passes — 3576aeb
- [x] 3.2 npm run lint passes — 3576aeb

#### Manual

- [x] 3.3 Edit page renders pre-filled form for valid repair ID — 3576aeb
- [x] 3.4 Unknown or other-user repair ID redirects to vehicles list — 3576aeb
- [x] 3.5 Saving valid edits updates the row and redirects with success — 3576aeb
- [x] 3.6 Client-side validation blocks invalid submit — 3576aeb
- [x] 3.7 Cost field empty string on save stores null in DB — 3576aeb

### Phase 4: RepairList Island + Vehicle Detail Page Update

#### Automated

- [x] 4.1 npm run build passes — d57d48d
- [x] 4.2 npm run lint passes — d57d48d

#### Manual

- [x] 4.3 Repair list renders in date-descending order with correct fields — d57d48d
- [x] 4.4 Edit link navigates to pre-filled edit page — d57d48d
- [x] 4.5 Delete AlertDialog opens on button click; cancel leaves row intact — d57d48d
- [x] 4.6 Confirming delete removes row and reloads page — d57d48d
- [x] 4.7 Zero-repair vehicle shows empty state — d57d48d
- [x] 4.8 Post-add and post-edit success banners show correct messages — d57d48d

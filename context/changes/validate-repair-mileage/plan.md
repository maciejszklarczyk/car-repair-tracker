# Validate Repair Mileage Implementation Plan

## Overview

Repair forms currently accept any mileage ≥ 0, including values below the vehicle's `baseline_mileage`. A repair logged below baseline is logically invalid (it would predate ownership). Fix: add server-side rejection in both API routes and inline client-side validation in both repair forms.

## Current State Analysis

- `POST /api/repairs.ts:21` — selects only `id, user_id` from cars; `baseline_mileage` never fetched or checked
- `PUT /api/repairs/[id].ts:23` — selects only `id, user_id` from the repair record; car's `baseline_mileage` not accessible
- `AddRepairForm.tsx:50` — validates `mileage >= 0` only; no `baselineMileage` prop
- `EditRepairForm.tsx:50` — same gap; `vehicle` with `baseline_mileage` already fetched on the edit page but not passed to the form
- `new.astro:22` — `CarRow` interface and select query omit `baseline_mileage`; car fetch is already present
- `[id]/edit.astro:26` — `vehicle: Vehicle` already fetched and has `baseline_mileage`; not forwarded to form

## Desired End State

Submitting a repair with `mileage < vehicle.baseline_mileage` is rejected at both the server boundary (error message redirected back to form) and the client (inline error on the mileage field before submission). The error message includes the actual baseline value so the user knows the minimum acceptable input.

### Key Discoveries

- `new.astro` already fetches the car — only the select string and `CarRow` interface need extending
- `[id]/edit.astro` already has `vehicle: Vehicle` which includes `baseline_mileage` — just pass it as a prop
- `PUT /api/repairs/[id].ts` fetches the repair but not the car; needs a second select for the car's `baseline_mileage` via `repair.car_id` (requires adding `car_id` to the repair select)
- Error message pattern: `"Mileage must be at or above baseline mileage (${baselineMileage} km)"` — shows the actual value

## What We're NOT Doing

- No DB constraint — validation is app-layer only
- No check that repair mileage is ≥ previous repair mileage (ordering across repairs is out of scope)
- No backfill or migration of existing invalid data

## Implementation Approach

Two phases: Phase 1 hardens the server boundary (API routes reject invalid mileage with a clear message). Phase 2 adds client-side UX so the error appears inline before the network round-trip.

---

## Phase 1: Server-side validation

### Overview

Extend both API routes to fetch `baseline_mileage` from the car and reject the request when `mileage < baseline_mileage`. No schema change needed — the check is post-validation app logic.

### Changes Required:

#### 1. POST repairs API

**File**: `src/pages/api/repairs.ts`

**Intent**: After the existing car ownership check, use the already-fetched car to validate `mileage >= baseline_mileage` before inserting.

**Contract**: Change the car select from `"id, user_id"` to `"id, user_id, baseline_mileage"`. After `result.success` check, add a guard: if `result.data.mileage < car.baseline_mileage`, redirect with an error message `"Mileage must be at or above baseline mileage (${car.baseline_mileage} km)"`.

#### 2. PUT repairs API

**File**: `src/pages/api/repairs/[id].ts`

**Intent**: The PUT route currently only fetches the repair to verify ownership. It needs the car's `baseline_mileage` to validate the new mileage value.

**Contract**: Extend the repair select from `"id, user_id"` to `"id, user_id, car_id"`. After the ownership check, add a second select: fetch `baseline_mileage` from `cars` using `repair.car_id`. If that fetch returns an error or null data, return `Response.json({ error: "Vehicle not found" }, { status: 404 })`. After `result.success` check, add a guard: if `result.data.mileage < car.baseline_mileage`, return `Response.json({ error: "Mileage must be at or above baseline mileage (${car.baseline_mileage} km)" }, { status: 400 })`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`

#### Manual Verification:

- POST: submitting Add Repair form with mileage below baseline returns the error message on the form
- PUT: submitting Edit Repair form with mileage below baseline shows the error message inline

---

## Phase 2: Client-side validation

### Overview

Pass `baselineMileage` to both forms and add an inline mileage check so the error appears before the network round-trip. Also extend the `new.astro` car select and `CarRow` interface to include `baseline_mileage`.

### Changes Required:

#### 1. Add Repair page

**File**: `src/pages/dashboard/repairs/new.astro`

**Intent**: The car select currently omits `baseline_mileage`. Extend it so the value is available to pass to the form.

**Contract**: Add `baseline_mileage: number` to the `CarRow` interface. Change the select string from `"id, make, model, year, user_id"` to `"id, make, model, year, user_id, baseline_mileage"`. Pass `baselineMileage={car.baseline_mileage}` to `<AddRepairForm>`.

#### 2. AddRepairForm

**File**: `src/components/repairs/AddRepairForm.tsx`

**Intent**: Accept `baselineMileage` and validate that the entered mileage is at or above it, showing an inline error on the mileage field.

**Contract**: Add `baselineMileage: number` to the `Props` interface. In `validate()`, change the existing `mileageNum < 0` branch to `else if (mileageNum < baselineMileage) next.mileage = \`Mileage must be at or above baseline mileage (${baselineMileage} km)\`` so the baseline error only fires when the non-negative check passes.

#### 3. Edit Repair page

**File**: `src/pages/dashboard/repairs/[id]/edit.astro`

**Intent**: `vehicle` is already fetched with full `Vehicle` type including `baseline_mileage`. Forward it to the form.

**Contract**: Pass `baselineMileage={vehicle.baseline_mileage}` to `<EditRepairForm>`.

#### 4. EditRepairForm

**File**: `src/components/repairs/EditRepairForm.tsx`

**Intent**: Same as AddRepairForm — accept `baselineMileage` and add inline mileage validation.

**Contract**: Add `baselineMileage: number` to the `Props` interface. In `validate()`, apply the same `else if (mileageNum < baselineMileage)` pattern as AddRepairForm.

### Success Criteria:

#### Automated Verification:

- TypeScript build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Add Repair form: entering mileage below baseline shows inline error without submitting
- Edit Repair form: same inline error on save attempt
- Valid mileage (≥ baseline) submits without error on both forms

---

## Testing Strategy

### Manual Testing Steps:

1. Open Add Repair for a vehicle with `baseline_mileage = 120000`
2. Enter mileage `119999` — inline error should appear: "Mileage must be at or above baseline mileage (120000 km)"
3. Form must not submit
4. Enter mileage `120000` — error clears, form submits
5. Repeat steps 2–4 on Edit Repair form
6. Bypass client-side JS (disable JS in browser) and POST with mileage `119999` — server returns the same error message

## References

- GitHub issue: #24
- Related: `src/lib/schemas.ts` — repair schemas (mileage validated as `int().min(0)` only)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Server-side validation

#### Automated

- [x] 1.1 Lint passes (`npm run lint`)

#### Manual

- [ ] 1.2 POST with mileage below baseline returns error on the form
- [ ] 1.3 PUT with mileage below baseline returns inline error in Edit Repair form

### Phase 2: Client-side validation

#### Automated

- [ ] 2.1 TypeScript build passes (`npm run build`)
- [ ] 2.2 Lint passes (`npm run lint`)

#### Manual

- [ ] 2.3 Add Repair form shows inline error for mileage below baseline without submitting
- [ ] 2.4 Edit Repair form shows inline error for mileage below baseline without submitting
- [ ] 2.5 Valid mileage (≥ baseline) submits successfully on both forms

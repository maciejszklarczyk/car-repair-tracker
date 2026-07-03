# Repair/Threshold Mileage & Date Validation — Implementation Plan

## Overview

GitHub issue #58 found that repair `mileage` is only checked against `car.baseline_mileage`, never against other logged repairs for the same vehicle — a repair can be saved with a lower mileage than an earlier one. Framing (`context/changes/issue-58/frame.md`) reframed the fix from a global-MAX check (which would break legitimate edits/backfills) to a **chronological-neighbor bound**: mileage must be consistent with the repairs immediately before and after it *by date*, not with the single highest mileage on record. Three related gaps sharing the same "unvalidated against the vehicle's timeline" shape are folded into this change: `repair_date` has no format/future-date check, and `service_thresholds.last_performed_mileage`/`last_performed_date` aren't validated against baseline or repair history.

## Current State Analysis

- `src/pages/api/repairs.ts:46` (POST) and `src/pages/api/repairs/[id].ts:57` (PUT) only check `mileage < car.baseline_mileage`.
- `src/lib/schemas.ts:7-8,19-20` — `repair_date` is `z.string().trim().min(1, ...)`, no format or future-date bound.
- `src/lib/schemas.ts:25-48` — `last_performed_mileage`/`last_performed_date` on service thresholds have no cross-reference to `baseline_mileage` or repair history.
- `src/pages/api/service-thresholds.ts:32-37` (POST) and `src/pages/api/service-thresholds/[id].ts:31-35` (PUT) never fetch `baseline_mileage` or `repairs` at all — this pattern was never adopted here, unlike the repairs routes.
- `src/lib/costPerKm.ts:3-6` (`computeCurrentMileage`) intentionally uses `MAX(baseline, repairs.mileage)`, order-independent — this is the *correct* model for "current odometer" but the *wrong* model for validating a new/edited entry's mileage.
- `src/lib/costPerKm.ts:26-54` (`computeCostTrendData`, `computeMileageTrendData`) sort repairs by `repair_date` and plot values in that order — an out-of-order mileage produces a visible dip / wrong per-point cost/km. This is the concrete downstream harm the new validation protects.
- No "find previous/next repair by date" helper exists anywhere in the codebase (confirmed via research) — this is new logic.
- `AddRepairForm.tsx`/`EditRepairForm.tsx` only receive `baselineMileage`, not sibling repairs; `AddServiceThresholdForm.tsx`/`EditServiceThresholdForm.tsx` receive neither. Per the user's decision, none of the four forms will be threaded with sibling-repair data — the new checks are server-side only, matching the existing form's role of showing whatever error the server returns.
- `context/changes/validate-repair-mileage/plan.md:30` recorded "No check that repair mileage is ≥ previous repair mileage (ordering across repairs is out of scope)" as a deliberate scope cut on 2026-06-02 — this change closes that gap.

### Key Discoveries:

- Sort key convention: same-date repairs are ordered by mileage (per user decision) rather than being unordered — this only affects tie-break/display consistency; the validation bound itself only compares against *strictly* earlier/later dated repairs (see Critical Implementation Details).
- `src/pages/api/service-thresholds/[id].ts:31-35` currently selects `"id, user_id"` for the existing threshold row — needs extending to `car_id`, `last_performed_date`, `last_performed_mileage` so a partial update (only one of the two fields changing) can fall back to the stored value of the other.
- Test convention: pure functions get a `describe`/`it` file under `src/lib/__tests__/` using `makeVehicle`/`makeRepair`/`makeServiceThreshold` factories from `src/test/helpers.ts` (see `costPerKm.test.ts`); API routes get `mockResults([...])` queued Supabase responses via `src/pages/api/__tests__/setup.ts`.

## Desired End State

- Creating or updating a repair with a mileage that would be lower than the nearest earlier-dated repair, or higher than the nearest later-dated repair (for the same vehicle), is rejected with a clear error naming the violated bound. Editing a repair excludes itself from the comparison and re-evaluates neighbors against the *submitted* `repair_date` (not the stored one).
- Creating or updating a repair with `repair_date` that is not a valid calendar date, or is after today, is rejected.
- Creating or updating a service threshold with `last_performed_mileage` below `baseline_mileage`, or inconsistent with the vehicle's repair history at `last_performed_date`, is rejected — using the same neighbor-bound logic as repairs.
- All four scenarios are covered by automated tests; existing behavior (baseline-only check, valid submissions) continues to pass unchanged.

### Key Discoveries:

- (see Current State Analysis above — discoveries are listed there per research findings)

## What We're NOT Doing

- No client-side (React form) duplication of the neighbor-bound or threshold cross-check logic — confirmed by the user; forms keep their existing baseline-only inline check and surface new errors only via the server response.
- No change to `computeCurrentMileage`'s MAX-based semantics — it remains correct for "current odometer" purposes; this change only affects the create/update *validation* path.
- No lower bound on `repair_date` beyond "must be a valid date not in the future" — backfilling old repairs is explicitly legitimate (confirmed by user).
- No new field tracking "vehicle owned since" — not needed given the above.
- No DB constraint/migration — validation stays app-layer only, consistent with `validate-repair-mileage`'s prior decision.
- No change to `computeMileageTrendData`/`computeCostTrendData`'s sort comparator (still sorts by `repair_date` only) — the same-date mileage tiebreak is a validation-time concept, not a display-time one; two same-day repairs remain sorted by date only on the trend charts, which is unchanged existing behavior.
- Threshold cross-check applies the full neighbor bound only when **both** `last_performed_mileage` and an effective `last_performed_date` are known (submitted or already stored) — see Critical Implementation Details.

## Implementation Approach

Build one shared pure helper for the chronological-neighbor bound (Phase 1), then wire it into the repair endpoints (Phase 2), add the independent `repair_date` schema validation (Phase 3), and finally wire the same helper into the service-threshold endpoints (Phase 4). Phases 2-4 are independent of each other once Phase 1 lands, but are sequenced in issue-priority order (headline repair gap first).

## Critical Implementation Details

**Neighbor-bound algorithm**: Given a candidate `(referenceDate, mileage)` and a car's sibling repairs (excluding the repair being edited, if any):
- `min` bound = `MAX(baselineMileage, mileage of every sibling with repair_date < referenceDate)` (baseline alone if no earlier sibling).
- `max` bound = `MIN(mileage of every sibling with repair_date > referenceDate)`, or unbounded (`Infinity`) if no later sibling exists.
- Siblings with `repair_date === referenceDate` are excluded from both bounds — same-date repairs don't constrain each other by design (per user decision, their relative order for display purposes is by mileage, which is automatically satisfied without an explicit bound, since inserting a value between two others by its own magnitude can't violate a same-date ordering rule).
- On update, neighbors are computed against the **submitted** `repair_date`, not the repair's stored date, and the repair's own id is excluded from the sibling set — so moving a repair to a new date re-validates against its new position (per user decision).

**Threshold cross-check applicability**: The full neighbor-bound check on a service threshold's `last_performed_mileage` only runs when an *effective* `last_performed_date` is available — either submitted in this request or already stored on the threshold (for partial updates that change only one of the two fields). If no effective date is available (mileage set without ever having a date), only the simpler `last_performed_mileage >= baseline_mileage` check applies — mirroring the repair-side baseline check pattern for the no-neighbor-context case. If a field is explicitly cleared (`null`), no check runs for that field.

## Phase 1: Shared mileage-bound helper

### Overview

A pure, framework-agnostic function computing the acceptable mileage range for a given date, given a car's existing repairs and baseline mileage. Used identically by both repair and threshold validation in later phases.

### Changes Required:

#### 1. New mileage-bounds helper

**File**: `src/lib/mileageValidation.ts`

**Intent**: Compute the `[min, max]` mileage bound for a candidate `repair_date`, given the car's other repairs and baseline mileage, excluding a specific repair id (for edits).

**Contract**: Export `computeMileageBounds(repairs: Pick<Repair, "id" | "repair_date" | "mileage">[], baselineMileage: number, referenceDate: string, excludeId?: string): { min: number; max: number }`. `min` is `baselineMileage` maxed with the highest mileage among repairs with `repair_date < referenceDate` (excluding `excludeId`). `max` is the lowest mileage among repairs with `repair_date > referenceDate` (excluding `excludeId`), or `Infinity` if none. Repairs with `repair_date === referenceDate` are excluded from both computations, per the neighbor-bound algorithm above.

#### 2. Unit tests

**File**: `src/lib/__tests__/mileageValidation.test.ts`

**Intent**: Cover the bound computation across the cases that matter for correctness: no siblings, only-earlier siblings, only-later siblings, siblings on both sides, same-date siblings excluded from the bound, and edit exclusion (`excludeId`) removing a repair from consideration on both sides.

**Contract**: Follow the `describe("computeMileageBounds", ...)` / `it(...)` / `makeRepair` fixture convention from `src/lib/__tests__/costPerKm.test.ts`. At minimum: (a) empty repairs → `{ min: baseline, max: Infinity }`; (b) earlier-only sibling → `min` raised, `max` stays `Infinity`; (c) later-only sibling → `min` stays baseline, `max` lowered; (d) siblings on both sides → both bounds tight; (e) same-date sibling → excluded from both bounds regardless of its mileage; (f) `excludeId` matching a sibling that would otherwise set a bound → that sibling ignored.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test -- mileageValidation`
- Type checking passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- N/A — pure function, covered entirely by automated tests.

---

## Phase 2: Repair create/update validation

### Overview

Replace the baseline-only mileage check in both repair endpoints with the neighbor-bound check from Phase 1, and extend the Supabase fetches to supply the sibling-repair data the bound needs.

### Changes Required:

#### 1. POST repairs API

**File**: `src/pages/api/repairs.ts`

**Intent**: After the existing car-ownership fetch, also fetch the car's other repairs and use `computeMileageBounds` instead of the raw baseline comparison.

**Contract**: Add a second Supabase query fetching `id, repair_date, mileage` from `repairs` where `car_id = carId`, after the existing car fetch and before/after the Zod parse (either ordering works — fetch it alongside the car). Replace the `result.data.mileage < car.baseline_mileage` guard (line 46) with a call to `computeMileageBounds(repairs, car.baseline_mileage, result.data.repair_date)` and reject if `mileage < bounds.min` (message: `` `Mileage must be at least ${bounds.min} km based on baseline mileage and previously logged repairs` ``) or `mileage > bounds.max` (message: `` `Mileage must be at most ${bounds.max} km to stay consistent with a later repair already logged for this vehicle` ``), redirecting the same way the existing guard does.

**Test note**: `src/pages/api/__tests__/repairs.test.ts` mocks Supabase via ordered `mockResults([...])` queues consumed in call order. The new sibling-repairs query inserts an extra call between the car fetch and the insert — update every existing test's queue to insert the new mocked response at the matching position, or they'll desync and fail against the wrong mocked response.

#### 2. PUT repairs API

**File**: `src/pages/api/repairs/[id].ts`

**Intent**: Same replacement as POST, but exclude the repair being edited from the sibling set and use the *submitted* `repair_date` as the reference date.

**Contract**: Extend the initial repair select (currently `"id, user_id, car_id, description, category, category_source"`, line 26) to keep as-is (no new fields needed there). Add a query fetching `id, repair_date, mileage` from `repairs` where `car_id = repair.car_id`, after the car fetch. Replace the `result.data.mileage < car.baseline_mileage` guard (line 57) with `computeMileageBounds(repairs, car.baseline_mileage, result.data.repair_date, repairId)` and the same two-sided rejection as POST, returning `Response.json({ error: ... }, { status: 400 })` matching the existing pattern.

**Test note**: same queue-ordering caveat as POST — update `src/pages/api/__tests__/repairs-id.test.ts` mock queues for the new sibling-repairs query.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test -- repairs`
- Type checking passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Add Repair: submitting a mileage below the nearest earlier-dated repair (or baseline) shows the "at least" error and does not save.
- Add Repair: submitting a mileage above the nearest later-dated repair shows the "at most" error and does not save.
- Add Repair: backfilling a repair with an old date and a mileage between two existing repairs' mileages (matching the timeline) succeeds.
- Edit Repair: lowering an existing repair's own mileage to correct a typo succeeds when it doesn't violate its (recomputed) neighbor bound.
- Edit Repair: changing a repair's date to a new position in the timeline is validated against the *new* neighbors, not the old ones.

---

## Phase 3: repair_date format and future-date validation

### Overview

Independent of the mileage bound — reject a `repair_date` that isn't a valid calendar date or that falls in the future, for both create and update.

### Changes Required:

#### 1. Repair schemas

**File**: `src/lib/schemas.ts`

**Intent**: Extend `repair_date` validation on both `createRepairSchema` (line 7) and `updateRepairSchema` (line 19) beyond "non-empty string" to also require a valid, parseable date that is not after today.

**Contract**: Add a `.refine(...)` (or a shared reusable date-validity checker) to the existing `repair_date: z.string().trim().min(1, "Repair date is required")` field on both schemas, producing a validation error such as `"Repair date must be a valid date"` for an unparseable value and `"Repair date cannot be in the future"` for a date after today (compared at day granularity, consistent with the `type="date"` input format `YYYY-MM-DD`).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test -- schemas` (new test file if none currently covers `schemas.ts` directly — check for an existing one first and extend it, otherwise create `src/lib/__tests__/schemas.test.ts`)
- Type checking passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- POST directly (bypassing the `type="date"` input, e.g. via API client) with a malformed `repair_date` string returns a clear validation error.
- POST/PUT with a `repair_date` set to tomorrow is rejected with the future-date error.
- Existing valid submissions (today's date, past dates) continue to succeed.

---

## Phase 4: Service-threshold mileage/date cross-check

### Overview

Bring the service-threshold create/update endpoints up to the same validation standard as repairs: `last_performed_mileage` must be at least `baseline_mileage`, and — when an effective `last_performed_date` is known — consistent with the vehicle's repair history via the Phase 1 helper.

### Changes Required:

#### 1. POST service-thresholds API

**File**: `src/pages/api/service-thresholds.ts`

**Intent**: Extend the existing car-ownership fetch to include `baseline_mileage`, and — only when the request provides both `last_performed_mileage` and `last_performed_date` — also fetch the car's repairs and apply the neighbor-bound check; when only `last_performed_mileage` is provided (no date), apply the simpler baseline-only check.

**Contract**: Change the car select (line 32-37, currently `"id"`) to `"id, baseline_mileage"`. When `result.data.last_performed_mileage !== undefined`, validate per the rule above (baseline-only vs. full bound, depending on whether `result.data.last_performed_date` is also present) before the insert (line 43), returning `Response.json({ error: ... }, { status: 400 })` on violation with messages mirroring Phase 2's wording (substituting "service threshold" language where natural, e.g. `` `Last performed mileage must be at least ${bounds.min} km based on baseline mileage and logged repairs` ``).

**Test note**: update `src/pages/api/__tests__/service-thresholds.test.ts` mock queues for the extended car select and any conditional repairs fetch.

#### 2. PUT service-thresholds API

**File**: `src/pages/api/service-thresholds/[id].ts`

**Intent**: Same validation as POST, but resolve the *effective* mileage/date by falling back to the threshold's currently stored values for whichever field isn't present in this request, and exclude the check entirely when a field is explicitly cleared to `null`.

**Contract**: Extend the existing threshold select (line 31-35, currently `"id, user_id"`) to `"id, user_id, car_id, last_performed_date, last_performed_mileage"`. Add a car fetch (`"baseline_mileage"` by `existing.car_id`) alongside the existing ownership check. Compute `effectiveMileage` and `effectiveDate` as `result.data.<field> !== undefined ? result.data.<field> : existing.<field>` for each of `last_performed_mileage`/`last_performed_date`. If `effectiveMileage` is a number, validate it (full bound when `effectiveDate` is also a non-null string — fetching repairs for `existing.car_id` in that case — else baseline-only), returning a 400 on violation before the update (line 60).

**Test note**: update `src/pages/api/__tests__/service-thresholds-id.test.ts` mock queues for the extended threshold select, the new car fetch, and any conditional repairs fetch.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test -- service-thresholds`
- Type checking passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Add Service Threshold: entering a `last_performed_mileage` below the vehicle's baseline is rejected.
- Add Service Threshold: entering a `last_performed_mileage`/`last_performed_date` pair inconsistent with logged repairs (e.g. higher mileage than a later-dated repair) is rejected.
- Edit Service Threshold: updating only `last_performed_mileage` (leaving a previously-set `last_performed_date` untouched) is validated against that stored date.
- Edit Service Threshold: clearing `last_performed_mileage` to null succeeds without triggering the check.

---

## Testing Strategy

### Unit Tests:

- `computeMileageBounds`: all cases listed in Phase 1's contract (no siblings, earlier-only, later-only, both-sides, same-date exclusion, edit exclusion).
- Repair route tests: valid mileage within bounds succeeds; below-min and above-max both rejected with the correct message; edit excludes self; edit against a new date re-validates correctly.
- Schema tests: malformed `repair_date`, future `repair_date`, valid past/today dates.
- Service-threshold route tests: baseline-only rejection (no date), full-bound rejection (date present), partial-update fallback to stored values, null-clearing skips the check.

### Integration Tests:

- None planned beyond the existing route-level tests (which already mock Supabase) — no new e2e flows required for this change.

### Manual Testing Steps:

1. Create a vehicle with `baseline_mileage = 100000`.
2. Add repairs: `2024-01-01 / 105000`, `2024-06-01 / 110000`.
3. Try adding a repair `2024-03-01 / 108000` (between the two, mileage above both) → expect the "at most" error citing the `2024-06-01` repair's mileage bound.
4. Try adding a repair `2024-03-01 / 106000` (between the two, mileage between them) → expect success.
5. Edit the `2024-06-01` repair's mileage down to `109500` → expect success (still above the `2024-01-01` repair, no later repair to conflict with).
6. Try adding a repair dated tomorrow → expect the future-date error.
7. Add a service threshold with `last_performed_mileage = 90000` (below baseline) → expect rejection.
8. Add a service threshold with `last_performed_date = 2024-03-01, last_performed_mileage = 112000` (above the `2024-06-01` repair) → expect rejection.

## Performance Considerations

Each validated request now issues one additional Supabase query (the sibling-repairs fetch) — acceptable given this app's per-vehicle repair counts are small (see `demo-seed.ts` — under 10 repairs per vehicle in the seed data) and the existing `vehiclePageData.ts` aggregation already fetches full repair lists per page view.

## Migration Notes

No data migration — existing repairs/thresholds that already violate the new invariant are left as-is; the check only applies to new create/update requests going forward.

## References

- Frame brief: `context/changes/issue-58/frame.md`
- GitHub issue: https://github.com/maciejszklarczyk/car-repair-tracker/issues/58
- Related change (prior explicit scope cut): `context/changes/validate-repair-mileage/plan.md`
- Related change (MAX-mileage design intent): `context/changes/fix-mileage-tracking/change.md`
- Test conventions: `src/lib/__tests__/costPerKm.test.ts`, `src/test/helpers.ts`, `src/pages/api/__tests__/repairs.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Shared mileage-bound helper

#### Automated

- [x] 1.1 Unit tests pass (`npm run test -- mileageValidation`) — 92c4661
- [x] 1.2 Type checking passes (`npm run build`) — 92c4661
- [x] 1.3 Lint passes (`npm run lint`) — 92c4661

### Phase 2: Repair create/update validation

#### Automated

- [x] 2.1 Unit tests pass (`npm run test -- repairs`) — 6280d86
- [x] 2.2 Type checking passes (`npm run build`) — 6280d86
- [x] 2.3 Lint passes (`npm run lint`) — 6280d86

#### Manual

- [x] 2.4 Add Repair: mileage below nearest earlier-dated repair (or baseline) rejected — verified manually via Playwright MCP against the dev server + local Supabase (Skoda Octavia seed vehicle)
- [x] 2.5 Add Repair: mileage above nearest later-dated repair rejected — verified manually via Playwright MCP
- [x] 2.6 Add Repair: backfilled repair with mileage consistent with its date-neighbors succeeds — verified manually via Playwright MCP
- [ ] 2.7 Edit Repair: lowering own mileage to correct a typo succeeds when neighbor-consistent
- [ ] 2.8 Edit Repair: changing date re-validates against new neighbors

### Phase 3: repair_date format and future-date validation

#### Automated

- [x] 3.1 Unit tests pass (`npm run test -- schemas`) — ceb0067
- [x] 3.2 Type checking passes (`npm run build`) — ceb0067
- [x] 3.3 Lint passes (`npm run lint`) — ceb0067

#### Manual

- [ ] 3.4 Malformed repair_date rejected
- [x] 3.5 Future repair_date rejected — verified manually via Playwright MCP
- [x] 3.6 Valid past/today dates still succeed — verified manually via Playwright MCP (backfilled past date succeeded)

### Phase 4: Service-threshold mileage/date cross-check

#### Automated

- [x] 4.1 Unit tests pass (`npm run test -- service-thresholds`) — 788783d
- [x] 4.2 Type checking passes (`npm run build`) — 788783d
- [x] 4.3 Lint passes (`npm run lint`) — 788783d

#### Manual

- [x] 4.4 Add Service Threshold: last_performed_mileage below baseline rejected — verified manually via Playwright MCP
- [x] 4.5 Add Service Threshold: mileage/date pair inconsistent with repairs rejected — verified manually via Playwright MCP
- [ ] 4.6 Edit Service Threshold: partial update falls back to stored date/mileage correctly
- [ ] 4.7 Edit Service Threshold: clearing last_performed_mileage to null skips the check

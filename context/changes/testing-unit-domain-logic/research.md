---
date: 2026-06-12T12:00:00+02:00
researcher: Claude
git_commit: be4b3eb6d3149bff026cf09a4070bedd71b263dd
branch: main
repository: car-repair-tracker
topic: "Ground domain logic functions for unit testing — risks #2 (cost/km), #4 (mileage), #6 (service reminders)"
tags: [research, testing, domain-logic, costPerKm, serviceReminders]
status: complete
last_updated: 2026-06-12
last_updated_by: Claude
---

# Research: Domain Logic Functions for Unit Testing

**Date**: 2026-06-12
**Git Commit**: be4b3eb
**Branch**: main
**Repository**: car-repair-tracker

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md`. For risks #2 (cost/km formula regression), #4 (mileage tracking regression), and #6 (service reminder margin bug): identify the exact functions, their edge cases, input/output contracts, existing test coverage, and the cheapest test layer. Also determine what infrastructure is needed to bootstrap Vitest.

## Summary

Three files contain all testable domain logic: `src/lib/costPerKm.ts` (5 pure functions), `src/lib/serviceReminders.ts` (3 functions including a helper), and `src/types.ts` (type definitions). All are pure functions with no side effects, no Astro context, and no external dependencies — testable with Vitest alone, no mocking needed.

Zero test infrastructure exists today. Vitest setup requires one package install and one config file with path alias resolution.

The research confirms all three test plan response guidance entries. No backport corrections needed — the plan's evidence citations were accurate.

## Detailed Findings

### 1. Cost/km and Mileage Logic (`src/lib/costPerKm.ts`)

Five pure functions. No external dependencies beyond TypeScript types.

#### `computeCurrentMileage(repairs: Repair[], baselineMileage: number): number` (line 3)

Returns `Math.max(baselineMileage, ...repairs.map(r => r.mileage))`, or `baselineMileage` if repairs is empty.

**Edge cases to test:**

- Empty repairs → returns baseline (safe)
- All repairs with mileage < baseline → returns baseline (Math.max handles)
- Single repair with mileage = baseline → returns baseline (km driven = 0)
- Multiple repairs with varying mileage → returns max

**No existing tests.**

#### `computeCostPerKm(vehicle: Vehicle, repairs: Repair[]): number | null` (line 8)

Formula: `totalCost / (currentMileage - baseline_mileage)`. Returns `null` when km <= 0 or totalCost === 0.

**Edge cases to test:**

- No repairs → km = 0 → null
- All repairs with null cost → totalCost = 0 → null
- Repairs with mileage = baseline → km = 0 → null
- Mixed null/numeric costs → nulls treated as 0 via `r.cost ?? 0` (bias risk: inflates repair count without contributing cost)
- Normal case → correct division
- Single repair, known values → verify against hand-calculated result (NOT the formula itself — oracle problem)

**No existing tests.**

#### `computeCostTrendData(vehicle: Vehicle, repairs: Repair[]): CostTrendPoint[]` (line 26)

Filters to costed repairs, sorts by `repair_date` (lexicographic `localeCompare`), builds cumulative cost/km trend. Skips points where `kmDriven <= 0`. Rounds to 2 decimal places via `toFixed(2)`.

**Edge cases to test:**

- Empty / all-null-cost → returns []
- First repair at baseline mileage (kmDriven = 0) → skipped; runningCost still accumulates for next point
- Rounding: `toFixed(2)` rounds half-up (1.105 → "1.11")
- Date sorting relies on ISO-8601 format (YYYY-MM-DD) — lexicographic sort works correctly for this format

**No existing tests.**

#### `computeMileageTrendData(repairs: Repair[]): MileagePoint[]` (line 51)

Simple sort + map. No filtering, no null handling needed (mileage is non-null).

**Edge cases:** Empty array → []. Decreasing mileage between repairs → included (no validation).

#### `computeTotalCostTrendData(repairs: Repair[]): TotalCostPoint[]` (line 56)

Similar to cost trend but without the kmDriven check. Filters null costs, sorts, accumulates.

**Edge cases:** Same as cost trend minus the kmDriven skip.

### 2. Service Reminder Logic (`src/lib/serviceReminders.ts`)

Three functions. Pure, no external dependencies.

#### `daysBetween(dateStr: string, today: Date): number` (line 12)

Converts date string to Date, calculates `Math.floor((today - past) / MS_PER_DAY)`.

**Edge cases:**

- Future date → returns negative number (no validation)
- Invalid date string → returns NaN (no validation)
- Same day → returns 0

#### `computeReminderStatus(threshold: ServiceThreshold, currentMileage: number, today: Date): ReminderStatus` (line 18)

Returns `"overdue" | "approaching" | "ok"`.

**Key logic with asymmetric margins:**

- If both `last_performed_mileage` and `last_performed_date` are null → immediate `"overdue"` (line 25-26)
- **Mileage check** (line 31-39): `km_remaining = last_performed_mileage + km_interval - currentMileage`
  - `km_remaining <= 0` → `"overdue"` (returns immediately)
  - `km_remaining <= km_interval * 0.1` → `"approaching"` (10% relative margin)
- **Date check** (line 41-50): `days_remaining = days_interval - daysBetween(last_performed_date, today)`
  - `days_remaining <= 0` → `"overdue"` (returns immediately)
  - `days_remaining <= 30` → `"approaching"` (fixed 30-day margin, intentional per code comment)

**Status precedence:** overdue > approaching > ok. First overdue found returns immediately.

**Edge cases to test:**

- Never performed (both nulls) → "overdue"
- km_remaining = 0 exactly → "overdue" (boundary)
- km_remaining = 1 → depends on interval size (if interval = 10, 10% = 1, so "approaching")
- km_remaining = km_interval \* 0.1 exactly → "approaching" (uses `<=`)
- km_remaining = km_interval \* 0.1 + 1 → "ok"
- days_remaining = 0 → "overdue"
- days_remaining = 30 → "approaching" (uses `<=`)
- days_remaining = 31 → "ok"
- Both intervals present, km overdue but date ok → "overdue" (km checked first)
- Both intervals present, km ok but date overdue → "overdue"
- Both approaching → "approaching"
- Only km_interval set (days_interval null) → date check skipped
- Only days_interval set (km_interval null) → km check skipped
- Future last_performed_date → negative daysBetween → inflated days_remaining

**No existing tests.**

#### `computeThresholdSummary(thresholds: ServiceThreshold[], currentMileage: number): ThresholdWithStatus[]` (line 55)

Maps each threshold through `computeReminderStatus()`, adds computed `km_remaining` and `days_remaining`. Creates `today = new Date()` internally (line 56).

**Testability concern:** `new Date()` inside function makes deterministic testing harder. Either:

- Accept the slight non-determinism for summary-level tests (dates won't change within a test run)
- Focus unit tests on `computeReminderStatus()` which accepts `today` as parameter
- Consider refactoring to accept `today` as parameter (but this is a code change, not a test-only decision)

**Recommendation:** Test `computeReminderStatus()` directly (accepts `today` param) for all edge cases. Test `computeThresholdSummary()` only for array mapping behavior (empty array, multiple thresholds, null-safety of km_remaining/days_remaining).

### 3. Callers and Null Handling

| Caller                                                  | Functions used                                   | Null handling                                                |
| ------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| `src/pages/dashboard/vehicles/index.astro:64`           | `computeCurrentMileage`                          | None needed (always returns number)                          |
| `src/pages/dashboard/vehicles/[id].astro:61-66`         | All 5 cost functions + `computeThresholdSummary` | `costPerKm` checked with ternary; trend data passed to chart |
| `src/components/vehicles/CostTrendChart.tsx:34-38`      | Receives trend data as props                     | Checks `.length >= 2` before rendering                       |
| `src/components/service-reminders/ServiceReminders.tsx` | Receives ThresholdWithStatus[]                   | Filters for overdue/approaching                              |

All null paths handled at call sites. No unguarded null dereferences.

### 4. Vitest Setup Requirements

**Current state:** Zero test infrastructure. No runner, no config, no test files.

**Required:**

- Install: `npm install -D vitest`
- Create `vitest.config.ts` with `@` → `./src` path alias (matches `tsconfig.json` paths)
- Add scripts to `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`
- Environment: `node` (no DOM needed for pure functions)

**Not required for Phase 1:**

- `jsdom` or `happy-dom` (no React component tests)
- `@astrojs/test-utils` (no Astro component tests)
- MSW or any mocking library (pure functions, no HTTP)
- Playwright (no e2e)

**CI integration:** Add `npm run test` before `npm run lint` in `.github/workflows/ci.yml`.

### 5. Test Plan Response Guidance Verification

| Risk | Plan guidance                                                 | Research verdict                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #2   | Unit test `computeCostPerKm` edge cases; avoid oracle problem | Confirmed. Function is pure, 6 edge cases identified. Test oracle must be hand-calculated values, not the formula.                                                                               |
| #4   | Unit test `computeCurrentMileage`; challenge "S-08 fixed it"  | Confirmed. Function is pure, 4 edge cases. No regression tests exist despite prior fix.                                                                                                          |
| #6   | Unit test reminder margins; test both km and date paths       | Confirmed. Asymmetric margins (10% km vs 30-day fixed) are non-obvious. `computeReminderStatus` is the primary target (accepts `today` param). 12+ edge case combinations for status precedence. |

No corrections needed to test plan §2.

## Code References

- `src/lib/costPerKm.ts:3-6` — computeCurrentMileage
- `src/lib/costPerKm.ts:8-14` — computeCostPerKm
- `src/lib/costPerKm.ts:26-44` — computeCostTrendData
- `src/lib/costPerKm.ts:51-54` — computeMileageTrendData
- `src/lib/costPerKm.ts:56-72` — computeTotalCostTrendData
- `src/lib/serviceReminders.ts:12-16` — daysBetween
- `src/lib/serviceReminders.ts:18-53` — computeReminderStatus
- `src/lib/serviceReminders.ts:55-77` — computeThresholdSummary
- `src/types.ts:1-14` — Repair interface (cost: number | null)
- `src/types.ts:16-27` — ServiceThreshold interface (4 nullable fields)
- `src/types.ts:29-39` — Vehicle interface (baseline_mileage: number)
- `src/lib/schemas.ts:6-15` — createRepairSchema (cost validation)
- `src/lib/schemas.ts:25-36` — createServiceThresholdSchema (interval validation)

## Architecture Insights

- All domain logic is properly extracted into `src/lib/` as pure functions — ideal for unit testing.
- Type system enforces nullability correctly (`cost: number | null`, interval fields optional).
- `computeThresholdSummary` creates `new Date()` internally, making it less testable than `computeReminderStatus` which accepts `today` as param.
- Zod schemas validate at API boundary but domain functions must still handle edge cases (null costs, zero km).

## Open Questions

1. **`computeThresholdSummary` testability:** Should we refactor to accept `today` as parameter, or test `computeReminderStatus` directly and keep summary tests minimal? Recommendation: test `computeReminderStatus` directly for all edge cases; test summary only for array mapping.
2. **Trend function date sorting:** All trend functions sort via `localeCompare`. This works for ISO-8601 (YYYY-MM-DD) which is what the app uses, but is fragile if date format ever changes. Worth a defensive test with ISO dates to document the assumption.

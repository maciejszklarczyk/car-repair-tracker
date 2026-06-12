# Unit Tests on Domain Logic — Implementation Plan

## Overview

Bootstrap Vitest and write unit tests defending the three highest-risk domain logic areas: cost/km formula (risk #2), mileage tracking (risk #4), and service reminder margins (risk #6). All targets are pure functions — no mocking, no Astro context, no external deps.

## Current State Analysis

- **Test infrastructure:** Zero. No runner, no config, no test files.
- **Test targets:** 8 functions across `src/lib/costPerKm.ts` (5 exported) and `src/lib/serviceReminders.ts` (3 — `daysBetween` requires adding `export` for direct testability). All accept typed inputs, return typed outputs, no side effects.
- **Path alias:** `@/*` → `./src/*` configured in `tsconfig.json` — must be replicated in Vitest config.
- **CI:** `.github/workflows/ci.yml` runs lint + build. Tests not yet wired.

### Key Discoveries:

- `computeCostPerKm` treats null costs as 0 via `r.cost ?? 0` — silently biases downward when repairs have missing cost
- `computeReminderStatus` uses asymmetric margins: 10% relative for km, fixed 30 days for date — non-obvious boundary behavior
- `computeThresholdSummary` creates `new Date()` internally — test `computeReminderStatus` directly instead (accepts `today` param)
- Trend functions sort via `localeCompare` — works for ISO-8601 dates only

## Desired End State

Vitest installed and configured. Two test files cover all domain logic edge cases identified in research. `npm run test` passes locally. CI not yet wired (that's rollout Phase 3). Test-plan §6.1 cookbook updated with the unit test pattern.

**Verification:** `npx vitest run` exits 0 with all tests passing.

## What We're NOT Doing

- React component tests (no jsdom/happy-dom needed)
- API endpoint integration tests (rollout Phase 2)
- CI wiring (rollout Phase 3)
- Refactoring `computeThresholdSummary` to accept `today` param
- Testing AI classification accuracy (negative space per test-plan §7)

## Implementation Approach

Three phases: bootstrap infrastructure, then one test file per source module, ordered by risk priority (cost/km first, reminders second). Final sub-phase updates test-plan §6 cookbook.

---

## Phase 1: Bootstrap Vitest

### Overview

Install Vitest, create config with path alias, add npm scripts, verify with a trivial passing test.

### Changes Required:

#### 1. Install Vitest

**Intent**: Add vitest as dev dependency.

**Contract**: `npm install -D vitest` — adds `vitest` to `devDependencies` in `package.json`.

#### 2. Create Vitest config

**File**: `vitest.config.ts`

**Intent**: Minimal Vitest config with `@` path alias resolution matching `tsconfig.json`.

**Contract**: `defineConfig` from `vitest/config` with `resolve.alias` mapping `@` to `./src` and `test.include` pattern `src/**/__tests__/**/*.test.ts`.

#### 3. Add npm scripts

**File**: `package.json`

**Intent**: Add test commands for local development.

**Contract**: Add `"test": "vitest run"` and `"test:watch": "vitest"` to `scripts`.

#### 4. Verify setup with trivial test

**File**: `src/lib/__tests__/costPerKm.test.ts`

**Intent**: Confirm Vitest runs, path alias resolves, and imports from `@/lib/costPerKm` work.

**Contract**: Single `describe` block with one `it` that imports `computeCurrentMileage` and asserts a known value. Delete or expand this test in Phase 2.

### Success Criteria:

#### Automated Verification:

- `npx vitest run` exits 0 with 1 passing test
- Path alias `@/lib/costPerKm` resolves correctly in test
- `npm run test` script works

#### Manual Verification:

- None required for this phase

---

## Phase 2: Cost/km + Mileage Tests

### Overview

Write unit tests for `computeCurrentMileage`, `computeCostPerKm`, and smoke tests for the three trend functions. Covers risks #2 and #4.

### Changes Required:

#### 1. Cost/km and mileage tests

**File**: `src/lib/__tests__/costPerKm.test.ts`

**Intent**: Replace the trivial test from Phase 1 with comprehensive edge case coverage for the two core functions, plus smoke tests for trend functions.

**Contract**: Test suites for each function:

**`computeCurrentMileage`** — 4 cases:
- Empty repairs → returns baseline
- All repairs below baseline → returns baseline
- Single repair at baseline → returns baseline (km = 0)
- Multiple repairs with varying mileage → returns max

**`computeCostPerKm`** — 6 cases (oracle = hand-calculated values, NOT the formula):
- No repairs → null
- All repairs with null cost → null
- Repairs at baseline mileage (km = 0) → null
- Mixed null/numeric costs → correct ratio excluding nulls from denominator? No — they're treated as 0. Document this behavior.
- Single repair, known values (e.g., cost=500, mileage=10500, baseline=10000) → 500/500 = 1.0
- Multiple repairs → hand-calculated cumulative result

**`computeCostTrendData`** — 3 smoke cases:
- Empty array → []
- Single costed repair above baseline → array with one point
- Repair at baseline (kmDriven = 0) → skipped, returns []

**`computeMileageTrendData`** — 2 smoke cases:
- Empty → []
- Multiple repairs → sorted by date, all included

**`computeTotalCostTrendData`** — 2 smoke cases:
- Empty → []
- Multiple costed repairs → running total, sorted by date

### Success Criteria:

#### Automated Verification:

- `npx vitest run` exits 0 with all cost/km tests passing
- TypeScript types resolve correctly (Vehicle, Repair from `@/types`)

#### Manual Verification:

- None required — pure function tests

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Service Reminder Tests + Cookbook Update

### Overview

Write unit tests for `daysBetween`, `computeReminderStatus` (primary target — all edge cases), and minimal `computeThresholdSummary` tests. Then update test-plan §6.1 with the cookbook pattern.

### Changes Required:

#### 0. Export daysBetween

**File**: `src/lib/serviceReminders.ts`

**Intent**: Add `export` keyword to `daysBetween` (line 12) so tests can import it directly. No logic change.

**Contract**: `function daysBetween` → `export function daysBetween`. No other changes to the file.

#### 1. Service reminder tests

**File**: `src/lib/__tests__/serviceReminders.test.ts`

**Intent**: Cover the asymmetric margin logic and status precedence in `computeReminderStatus`, plus edge cases in `daysBetween` and array-mapping in `computeThresholdSummary`.

**Contract**: Test suites for each function:

**`daysBetween`** — 3 cases:
- Same day → 0
- 30 days apart → 30
- Future date → negative number

**`computeReminderStatus`** — 12+ cases covering all status paths:

*Never-performed:*
- Both last_performed fields null → "overdue"

*Mileage-only (days_interval null):*
- km_remaining = 0 → "overdue"
- km_remaining = km_interval * 0.1 (boundary) → "approaching"
- km_remaining = km_interval * 0.1 + 1 → "ok"
- Large remaining → "ok"

*Date-only (km_interval null):*
- days_remaining = 0 → "overdue"
- days_remaining = 30 (boundary) → "approaching"
- days_remaining = 31 → "ok"

*Both intervals present (precedence):*
- km overdue, date ok → "overdue"
- km ok, date overdue → "overdue"
- Both approaching → "approaching"
- Both ok → "ok"

**`computeThresholdSummary`** — 3 minimal cases:
- Empty array → []
- Single threshold → correct status propagated
- km_remaining null when km_interval null → verified

#### 2. Update test-plan §6.1 cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Fill in §6.1 "Adding a unit test" with the pattern established by this rollout phase.

**Contract**: Replace TBD placeholder with: location (`src/lib/__tests__/`), naming (`<module>.test.ts`), reference test path, run command (`npm run test`).

### Success Criteria:

#### Automated Verification:

- `npx vitest run` exits 0 with all tests passing (cost/km + reminders)
- No TypeScript errors in test files

#### Manual Verification:

- §6.1 in test-plan.md accurately describes the test pattern

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Testing Strategy

### Unit Tests:

- `src/lib/__tests__/costPerKm.test.ts` — 17 cases across 5 functions
- `src/lib/__tests__/serviceReminders.test.ts` — 18+ cases across 3 functions

### Key edge cases:

- Division by zero (km = 0) → null, not crash
- Null cost handling (treated as 0, not skipped)
- Boundary conditions on reminder margins (10% km, 30 days)
- Status precedence when both km and date intervals present
- Empty arrays → safe returns ([], null)

### Oracle strategy:

- Hand-calculate expected values for cost/km (e.g., 500 PLN / 500 km = 1.0 PLN/km)
- Use exact boundary values for reminder margins (not the formula)
- Document non-obvious behavior in test names (e.g., "null cost treated as zero, not excluded")

## References

- Research: `context/changes/testing-unit-domain-logic/research.md`
- Test plan: `context/foundation/test-plan.md`
- Source: `src/lib/costPerKm.ts`, `src/lib/serviceReminders.ts`
- Types: `src/types.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Bootstrap Vitest

#### Automated

- [x] 1.1 `npx vitest run` exits 0 with 1 passing test — c2697f2
- [x] 1.2 Path alias `@/lib/costPerKm` resolves correctly in test — c2697f2
- [x] 1.3 `npm run test` script works — c2697f2

### Phase 2: Cost/km + Mileage Tests

#### Automated

- [x] 2.1 `npx vitest run` exits 0 with all cost/km tests passing — 26fd796
- [x] 2.2 TypeScript types resolve correctly (Vehicle, Repair from `@/types`) — 26fd796

### Phase 3: Service Reminder Tests + Cookbook Update

#### Automated

- [x] 3.1 `npx vitest run` exits 0 with all tests passing (cost/km + reminders)
- [x] 3.2 No TypeScript errors in test files

#### Manual

- [ ] 3.3 §6.1 in test-plan.md accurately describes the test pattern

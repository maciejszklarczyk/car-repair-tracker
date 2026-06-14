<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: API Auth & Validation Tests

- **Plan**: context/changes/testing-api-auth-validation/plan.md
- **Scope**: Full plan (Phases 1–4)
- **Date**: 2026-06-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Classification tests don't verify inserted payload

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/__tests__/repairs.test.ts:97-119, src/pages/api/__tests__/repairs-id.test.ts:129-147
- **Detail**: Tests for classifyRepair behavior only assert the function was called — never verify what was passed to supabase .insert()/.update(). A bug ignoring classifyRepair's return value would pass these tests.
- **Fix**: Spy on the chainable insert/update mock and assert payload contains expected category, category_source, original_category fields.
  - Strength: Closes the exact regression gap the plan intended to cover (Risk #5).
  - Tradeoff: Requires extending the mock to capture call args (~15 min).
  - Confidence: HIGH — standard vi.fn() spy pattern.
  - Blind spot: None significant.
- **Decision**: FIXED — exported insert/update spies from setup.ts, added payload assertions in both test files.

### F2 — No tests for Supabase mutation errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: All test files
- **Detail**: Every endpoint has an `if (error)` handler after insert/update/delete returning 500 or redirect with error. None tested.
- **Fix**: Add one "DB error on mutation" test per endpoint group.
  - Strength: Covers a real failure mode cheaply.
  - Tradeoff: ~5 new tests, small effort.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED — added DB-error tests to all 5 endpoint test files.

### F3 — No test for createClient returning null

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/__tests__/setup.ts:11
- **Detail**: Source endpoints check `if (!supabase)` and return 500/redirect. Mock always returns the client object.
- **Fix**: Add one test per response style where createClient returns null.
  - Strength: Covers Supabase-not-configured edge case.
  - Tradeoff: 2 new tests, trivial.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED — added createClient-returns-null tests for JSON (500) and FormData (redirect) endpoints.

### F4 — jsonRequest/formRequest helpers duplicated across files

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: repairs-id.test.ts, service-thresholds.test.ts, service-thresholds-id.test.ts, repairs.test.ts, vehicles.test.ts
- **Detail**: jsonRequest copy-pasted in 3 files. formRequest in 2 files. src/test/helpers.ts already exists.
- **Fix**: Extract to src/test/helpers.ts.
- **Decision**: FIXED — extracted both helpers, updated all imports.

### F5 — beforeEach at file scope instead of inside describe

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: repairs-id.test.ts:25, repairs.test.ts:26
- **Detail**: Works in Vitest. File-scope beforeEach is justified for multi-describe files sharing the same reset.
- **Decision**: SKIPPED — file-scope beforeEach correct for multi-describe files.

### F6 — Shared mock instance fragility

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: setup.ts:8
- **Detail**: Single createMockSupabase() shared across files. Works because Vitest runs files in separate threads by default.
- **Decision**: SKIPPED

### F7 — Old test files still have local factory duplicates

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/lib/__tests__/costPerKm.test.ts:11-42
- **Detail**: costPerKm.test.ts defines makeVehicle/makeRepair locally. New tests use shared helpers.ts.
- **Decision**: FIXED — updated old test to import from shared helpers.

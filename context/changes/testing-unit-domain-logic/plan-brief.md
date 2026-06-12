# Unit Tests on Domain Logic — Plan Brief

> Full plan: `context/changes/testing-unit-domain-logic/plan.md`
> Research: `context/changes/testing-unit-domain-logic/research.md`

## What & Why

Bootstrap Vitest and write unit tests for the three highest-risk domain logic areas: cost/km formula, mileage tracking, and service reminder margins. These are pure functions with zero test coverage despite being the core business logic. The cost/km formula was already fixed once (S-08) with no regression protection.

## Starting Point

Zero test infrastructure. All domain logic is properly extracted as pure functions in `src/lib/costPerKm.ts` (5 functions) and `src/lib/serviceReminders.ts` (3 functions). No mocking needed.

## Desired End State

Vitest installed and configured. Two test files with ~35 test cases covering all edge cases identified in research. `npm run test` passes locally. Test-plan §6.1 cookbook documents the unit test pattern for future contributors.

## Key Decisions Made

| Decision                            | Choice                              | Why (1 sentence)                                                           | Source   |
| ----------------------------------- | ----------------------------------- | -------------------------------------------------------------------------- | -------- |
| Test runner                         | Vitest                              | ESM-native, fast, works with Astro/Vite out of the box                     | Research |
| Test file location                  | `src/lib/__tests__/`                | User preference for separate directory                                     | Plan     |
| computeThresholdSummary testability | Test computeReminderStatus directly | Avoids production code change; computeReminderStatus accepts `today` param | Research |
| Trend function depth                | Smoke tests only                    | Lower risk than core formulas; cost × signal principle                     | Plan     |
| Oracle strategy                     | Hand-calculated values              | Avoid copying production formula into tests (oracle problem)               | Research |

## Scope

**In scope:** Vitest setup, unit tests for costPerKm.ts and serviceReminders.ts, test-plan §6.1 update

**Out of scope:** API integration tests (Phase 2), CI wiring (Phase 3), React component tests, AI classification tests

## Phases at a Glance

| Phase                        | What it delivers                              | Key risk                                             |
| ---------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| 1. Bootstrap Vitest          | Working test runner with path alias           | Path alias misconfiguration                          |
| 2. Cost/km + mileage tests   | 17 test cases covering risks #2, #4           | Oracle problem — must hand-calculate expected values |
| 3. Reminder tests + cookbook | 18+ test cases covering risk #6 + §6.1 update | Asymmetric margin boundaries (10% km vs 30 days)     |

**Prerequisites:** None — greenfield test setup
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- Vitest version compatibility with Vite 7.3.2 (already overridden in package.json) — verify during Phase 1
- `computeThresholdSummary` date path remains untested in isolation (accepted risk — core logic tested via `computeReminderStatus`)

## Success Criteria (Summary)

- `npx vitest run` exits 0 with all ~35 tests passing
- Edge cases for cost/km (null costs, zero km, baseline=current) are regression-protected
- Service reminder boundary conditions (10% km margin, 30-day date margin) are regression-protected

# Quality Gates Wiring — Implementation Plan

## Overview

Wire the existing test suite and type checker into CI and add a PostToolUse agent hook so regressions are caught automatically — in CI on every PR, and locally while the agent edits risk-area files.

## Current State Analysis

- **CI** (`.github/workflows/ci.yml`): runs lint → build on PRs. No test step, no explicit typecheck step.
- **Local pre-commit** (Husky + lint-staged): ESLint fix on `*.{ts,tsx,astro}`, Prettier on `*.{json,css,md}`. No tests.
- **Test suite**: 8 test files (2 unit in `src/lib/__tests__/`, 6 integration in `src/pages/api/__tests__/`), all run via `npm run test` (Vitest).
- **Agent hooks**: none configured in `.claude/settings.json`.

### Key Discoveries:

- `npm run test` = `vitest run` — single-run, non-watch mode, CI-safe.
- `npx astro check` provides Astro-aware type checking (stricter than `tsc` for `.astro` files).
- `npx astro sync` already runs in CI before lint — type stubs are available.
- Vitest supports `vitest related <file> --run` for scoped test runs (ideal for agent hooks).

## Desired End State

1. Every PR to `main` must pass lint, typecheck (`astro check`), and tests (`vitest run`) before merge.
2. While the agent edits files under `src/lib/` or `src/pages/api/`, a PostToolUse hook runs ESLint + related tests and feeds failures back into context.
3. Pre-commit stays lint-only (fast commits, no test friction).

Verification: open a PR that breaks a test → CI fails. Edit a risk-area file in Claude Code → hook surfaces the failure inline.

## What We're NOT Doing

- Coverage threshold — no % floor enforced yet; test-must-pass is the gate.
- Pre-commit test expansion — pre-commit stays lint-staged only.
- E2E tests or Playwright — not in scope for this rollout phase.
- New test code — this change wires existing tests into gates, doesn't add tests.

## Implementation Approach

Three phases: fix existing type errors first (Phase 0), then CI gates (Phase 1), then agent hook (Phase 2). All additive — no existing behavior changes.

---

## Phase 0: Fix Existing Type Errors

### Overview

`astro check` currently reports 10 errors. Fix them so the typecheck gate is clean from day one.

### Changes Required:

#### 1. Recharts Tooltip type fixes

**File**: `src/components/vehicles/CostTrendChart.tsx`

**Intent**: Fix 6 type errors where Recharts Tooltip `formatter` and `labelFormatter` prop types don't match the callback signatures. These are Recharts v3 type strictness issues.

**Contract**: Cast formatter/labelFormatter callbacks or adjust signatures to satisfy `Formatter<ValueType, NameType>` and the label formatter union type. Follow Recharts v3 typing conventions.

#### 2. Service reminders impossible comparison

**File**: `src/lib/serviceReminders.ts`

**Intent**: Fix 1 error where a comparison against `"overdue"` is unreachable because the type is `"ok" | "approaching"`.

**Contract**: Either the type union needs `"overdue"` added or the comparison logic needs adjustment — check the runtime behavior to determine which.

#### 3. Test setup type casts

**File**: `src/pages/api/__tests__/setup.ts`

**Intent**: Fix 2 errors where `SupabaseClient | null` is cast to `Record<string, unknown>` without intermediate `unknown` cast.

**Contract**: Add `as unknown as Record<string, unknown>` to satisfy the type checker.

#### 4. Vehicle index type mismatch

**File**: `src/pages/dashboard/vehicles/index.astro`

**Intent**: Fix 1 error where `{ mileage: number }[]` is passed where `Repair[]` is expected.

**Contract**: Either pass full `Repair[]` data or adjust `computeCurrentMileage` to accept a narrower type.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `npx astro check` reports 0 errors
- Tests still pass: `npm run test`
- Build still passes: `npm run build`

#### Manual Verification:

- Vehicle detail page still renders cost trend chart correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 1: CI Quality Gates

### Overview

Add typecheck and test steps to the GitHub Actions CI workflow so PRs cannot merge with type errors or test failures.

### Changes Required:

#### 1. CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Add `npx astro check` after `npx astro sync` (typecheck) and `npm run test` after lint (test gate). Both run in the existing `ci` job, before `npm run build`.

**Contract**: The `ci` job steps become: checkout → setup-node → npm ci → astro sync → lint → astro check → test → build. The `astro check` step needs the same `SUPABASE_URL`/`SUPABASE_KEY` env vars as build (astro check loads env schema). The test step needs no env vars (tests mock Supabase).

### Success Criteria:

#### Automated Verification:

- CI workflow is valid YAML: `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
- Tests pass locally: `npm run test`
- Typecheck passes locally: `npx astro check`

#### Manual Verification:

- Push a branch with a broken test → CI fails on test step
- Push a branch with a type error → CI fails on astro check step
- Push a clean branch → CI passes all steps including new ones

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: PostToolUse Agent Hook

### Overview

Configure a Claude Code PostToolUse hook that runs ESLint and related Vitest tests when the agent edits files in risk areas (`src/lib/` and `src/pages/api/`).

### Changes Required:

#### 1. Hook script

**File**: `scripts/post-edit-check.sh` (new)

**Intent**: Shell script that receives the edited file path, runs ESLint on it, and if the file is in a risk area (`src/lib/` or `src/pages/api/`) also runs `vitest related <file> --run`. Exit code 2 on failure (blocking), 0 on success.

**Contract**: Claude Code PostToolUse hooks receive tool input as JSON on stdin. The script extracts the file path via `jq -r '.tool_input.file_path'` from stdin. Runs `npx eslint --no-warn-ignored "$FILE"` first. If file matches `src/lib/**` or `src/pages/api/**`, also runs `npx vitest related "$FILE" --run`. Outputs failures to stdout (Claude Code captures up to 10,000 chars via `additionalContext`). Skips non-TS files (`.json`, `.css`, `.md`, `.astro`). Exit 2 on any failure, 0 otherwise.

#### 2. Claude Code settings

**File**: `.claude/settings.json`

**Intent**: Add a PostToolUse hook entry that fires on Write and Edit tool calls, running the hook script with the edited file path.

**Contract**: Add `hooks.postToolUse` array entry with matcher for `Write|Edit`, command `bash scripts/post-edit-check.sh`. The hook receives JSON on stdin (Claude Code convention); the script handles extraction. Preserve existing `permissions` block unchanged.

### Success Criteria:

#### Automated Verification:

- Hook script is executable: `test -x scripts/post-edit-check.sh`
- Hook script exits 0 on a clean file: `bash scripts/post-edit-check.sh src/lib/costPerKm.ts`
- Settings JSON is valid: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"`

#### Manual Verification:

- In Claude Code, edit a file in `src/lib/` — hook runs and shows lint + test results
- Edit a file outside risk areas (e.g., `src/components/`) — hook runs lint only, no tests
- Introduce a deliberate test break in `src/lib/costPerKm.ts` — hook surfaces the failure in context

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No new tests — this change wires existing tests into gates.

### Manual Testing Steps:

1. Push a PR branch with all tests passing → CI green
2. Break a test locally, push → CI red on test step
3. Break a type → CI red on astro check step
4. Edit risk-area file in Claude Code → hook feedback appears
5. Edit non-risk file → lint only, no test run

## References

- Test plan: `context/foundation/test-plan.md` §3 Phase 3, §5 Quality Gates
- Current CI: `.github/workflows/ci.yml`
- Claude Code hooks docs: PostToolUse with exit code 2 = blocking error with context injection

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 0: Fix Existing Type Errors

#### Automated

- [x] 0.1 Typecheck passes (`npx astro check` reports 0 errors) — 8f7a6b4
- [x] 0.2 Tests still pass (`npm run test`) — 8f7a6b4
- [x] 0.3 Build still passes (`npm run build`) — 8f7a6b4

#### Manual

- [x] 0.4 Vehicle detail page still renders cost trend chart correctly — 8f7a6b4

### Phase 1: CI Quality Gates

#### Automated

- [x] 1.1 CI workflow YAML is valid — 7288e48
- [x] 1.2 Tests pass locally (`npm run test`) — 7288e48
- [x] 1.3 Typecheck passes locally (`npx astro check`) — 7288e48

#### Manual

- [x] 1.4 PR with broken test → CI fails on test step — 7288e48
- [x] 1.5 PR with type error → CI fails on astro check step — 7288e48
- [x] 1.6 Clean PR → CI passes all steps — 7288e48

### Phase 2: PostToolUse Agent Hook

#### Automated

- [x] 2.1 Hook script is executable — bc4b384
- [x] 2.2 Hook script exits 0 on clean file — bc4b384
- [x] 2.3 Settings JSON is valid — bc4b384

#### Manual

- [x] 2.4 Edit risk-area file → hook shows lint + test results — bc4b384
- [x] 2.5 Edit non-risk file → lint only — bc4b384
- [x] 2.6 Deliberate test break → hook surfaces failure — bc4b384

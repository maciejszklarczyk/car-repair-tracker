# Quality Gates Wiring — Plan Brief

> Full plan: `context/changes/testing-quality-gates/plan.md`

## What & Why

Wire the existing test suite and type checker into CI and local agent hooks so regressions are caught automatically — before merge (CI) and while the agent works (PostToolUse). This is Phase 3 of the test-plan rollout, locking the quality floor established by Phases 1–2.

## Starting Point

CI runs lint + build on PRs but has no test or typecheck step. Husky pre-commit runs lint-staged. Eight test files exist from Phases 1–2 (unit + integration). No Claude Code agent hooks configured.

## Desired End State

Every PR must pass lint, typecheck (`astro check`), and tests (`vitest run`) before merge. Agent edits to risk-area files (`src/lib/`, `src/pages/api/`) trigger immediate lint + related-test feedback in Claude Code.

## Key Decisions Made

| Decision              | Choice                            | Why (1 sentence)                                                    |
| --------------------- | --------------------------------- | ------------------------------------------------------------------- |
| Coverage threshold    | None yet                          | Test-must-pass catches regressions; % floor adds friction too early |
| Agent hook scope      | Lint + related tests on risk dirs | Balances signal (catch breaks mid-edit) vs speed (~2-4s per edit)   |
| Pre-commit expansion  | Keep lint-only                    | Fast commits; tests covered by agent hook + CI                      |
| Typecheck in CI       | Add `astro check` step            | Clearer type error messages than build failures; fails faster       |

## Scope

**In scope:** CI test + typecheck steps, Claude Code PostToolUse hook, hook script

**Out of scope:** Coverage threshold, pre-commit tests, e2e/Playwright, new test code

## Architecture / Approach

Additive changes only. Phase 1 adds two steps to the existing CI job (astro check + vitest run). Phase 2 adds a shell script + PostToolUse hook config that runs lint and scoped tests on agent edits to risk-area files.

## Phases at a Glance

| Phase              | What it delivers                                   | Key risk                                              |
| ------------------ | -------------------------------------------------- | ----------------------------------------------------- |
| 1. CI Quality Gates | typecheck + test steps in GitHub Actions CI        | `astro check` may need env vars (same as build step)  |
| 2. Agent Hook       | PostToolUse lint + related tests on risk-area edits | Hook must not slow down edits to non-risk files        |

**Prerequisites:** Tests pass locally (`npm run test`), typecheck passes (`npx astro check`)
**Estimated effort:** ~1 session, 2 phases

## Open Risks & Assumptions

- `astro check` needs `SUPABASE_URL`/`SUPABASE_KEY` env vars (same as build) — must set them in CI step
- `vitest related` must correctly resolve file dependencies for scoped runs

## Success Criteria (Summary)

- PR with broken test → CI blocks merge
- PR with type error → CI blocks merge
- Agent edit to risk-area file → immediate test feedback in Claude Code context

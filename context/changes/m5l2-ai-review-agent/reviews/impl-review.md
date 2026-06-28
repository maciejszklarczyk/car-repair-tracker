<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: M5L2 — AI Code Review Agent

- **Plan**: context/changes/m5l2-ai-review-agent/plan.md
- **Scope**: All Phases (1–3 of 3)
- **Date**: 2026-06-28
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Provider switched from Google Gemini to OpenRouter

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: packages/code-reviewer/review.ts:2,6,13-16,20
- **Detail**: Plan specified @ai-sdk/google with GEMINI_API_KEY and google("gemini-2.0-flash"). Implementation uses @ai-sdk/openai pointed at OpenRouter. Commit 48cd296 documents this as deliberate. Plan body never amended.
- **Fix A ⭐ Recommended**: Accept drift, amend plan as addendum
  - Strength: Preserves working code; updates source of truth.
  - Tradeoff: Plan becomes a slightly moving target.
  - Confidence: HIGH — commit message explicitly documents the decision.
  - Blind spot: None significant.
- **Fix B**: Revert to Google Gemini per original plan
  - Strength: Plan and code stay aligned.
  - Tradeoff: Undoes deliberate decision.
  - Confidence: LOW — unknown why the switch happened.
  - Blind spot: Original reason for switching not documented.
- **Decision**: FIXED via Fix A — addendum added to plan.md

### F2 — No error handling around AI API call

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/review.ts:57-60,69
- **Detail**: `reviewer.generate()` and top-level `await review(diff)` had no try/catch. API failure would crash with unhandled rejection. Project pattern in classifyRepair.ts wraps AI calls in try/catch. Compounded by `structuredOutputs: false`.
- **Fix**: Wrap in try/catch, log error to stderr with model name, exit non-zero.
  - Strength: Matches project pattern; prevents cryptic stack traces.
  - Tradeoff: ~5 lines added.
  - Confidence: HIGH — identical pattern in classifyRepair.ts.
  - Blind spot: None significant.
- **Decision**: FIXED

### F3 — `dotenv` imported but not declared as dependency

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: packages/code-reviewer/review.ts:1
- **Detail**: `import "dotenv/config"` worked only via transitive dependency. Not listed in package.json.
- **Fix**: Add dotenv to devDependencies.
- **Decision**: FIXED — `npm install -D dotenv`

### F4 — `@ai-sdk/google` installed but unused

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: package.json:19
- **Detail**: `@ai-sdk/google` in dependencies but no file imports it. Leftover from pre-switch.
- **Fix**: Remove from package.json.
- **Decision**: FIXED — `npm uninstall @ai-sdk/google`

### F5 — Mixed English/Polish in CLI output and prompts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: packages/code-reviewer/review.ts (multiple lines)
- **Detail**: System prompt English, schema describes Polish, user prompt Polish, error messages mixed.
- **Fix**: Normalize all strings to English.
- **Decision**: FIXED — all strings normalized to English

### F6 — No stdin size guard

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/review.ts:42-46
- **Detail**: readDiff() reads all stdin with no size limit. Low risk for dev CLI.
- **Decision**: FIXED — added 1 MB size guard with early exit

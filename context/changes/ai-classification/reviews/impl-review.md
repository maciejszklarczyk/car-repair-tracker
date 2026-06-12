<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: AI Repair Classification

- **Plan**: context/changes/ai-classification/plan.md
- **Scope**: Phase 1–4 of 4
- **Date**: 2026-06-10
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Optimistic rollback skips null previous category

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: src/components/repairs/CategorySelect.tsx:25
- **Detail**: On PATCH failure, `if (previous) onCategoryChange(previous)` skips rollback when previous is null. UI shows category that was never persisted.
- **Fix**: Remove the if guard — always call onCategoryChange(previous). Widen type to string | null.
- **Decision**: FIXED

### F2 — Prompt injection surface in classifyRepair

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: src/lib/classifyRepair.ts:20
- **Detail**: User description concatenated directly into prompt. Crafted input could manipulate classification.
- **Fix**: Wrap description in triple-backtick delimiters + instruct model to ignore instructions inside the block.
- **Decision**: FIXED

### F3 — Plan drift: "pending" fallback vs null on classification failure

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/repairs.ts:52-54
- **Detail**: Plan's manual test 3.4 says category_source = null when Gemini key unset. Implementation uses "pending" instead. Functionally reasonable.
- **Fix**: Accept as-is.
- **Decision**: SKIPPED

### F4 — Silent error swallowing in classifyRepair catch

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: src/lib/classifyRepair.ts:33
- **Detail**: Catch block returns null silently. Non-transient errors indistinguishable from timeouts.
- **Fix**: Add console.warn in catch block.
- **Decision**: FIXED

### F5 — Unplanned file: src/lib/repairCategories.ts

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Scope Discipline
- **Location**: src/lib/repairCategories.ts
- **Detail**: REPAIR_CATEGORIES extracted to avoid importing astro:env/server in client bundle. Necessary adaptation.
- **Decision**: ACCEPTED

### F6 — No CHECK constraints on category columns

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260610120000_add_repair_category.sql
- **Detail**: Plan explicitly chose app-layer validation. Implementation matches plan intent.
- **Decision**: ACCEPTED

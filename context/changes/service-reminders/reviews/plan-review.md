<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Service Reminders Implementation Plan

- **Plan**: `context/changes/service-reminders/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-08
- **Verdict**: SOUND (after fixes)
- **Findings**: 0 critical (1 downgraded to observation) 1 warning 3 observations

## Verdicts

| Dimension             | Verdict            |
| --------------------- | ------------------ |
| End-State Alignment   | PASS               |
| Lean Execution        | PASS               |
| Architectural Fitness | PASS               |
| Blind Spots           | WARNING (resolved) |
| Plan Completeness     | WARNING (resolved) |

## Grounding

7/7 paths ✓ (`[id].astro`, `costPerKm.ts`, `schemas.ts`, `types.ts`, `RepairList.tsx`, `repairs.ts`, `repairs/[id].ts`), migrations dir ✓, Progress↔Phase 4/4 ✓, brief↔plan ✓

## Findings

### F1 — `export const prerender = false` not mentioned for new API endpoints

- **Severity**: 💡 OBSERVATION (downgraded from CRITICAL — project uses Node adapter not Cloudflare Workers; `output: "server"` makes all routes dynamic by default)
- **Impact**: 🏃 LOW — quick decision
- **Dimension**: Blind Spots
- **Location**: Phase 2 — API Endpoints
- **Detail**: Existing `repairs.ts:5` and `repairs/[id].ts:5` export this line as convention. New endpoint contracts didn't mention it. Project uses `@astrojs/node` standalone adapter, not Cloudflare Workers — so functional impact is nil, but consistency matters.
- **Fix**: Added note to both endpoint contracts pointing to convention.
- **Decision**: FIXED

### F2 — PUT endpoint partial update strategy undefined

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — updateServiceThresholdSchema + PUT contract
- **Detail**: Existing PUT in `repairs/[id].ts:64-72` does full replace (all fields required). Plan proposed `updateServiceThresholdSchema` with optional fields but didn't specify how update object is built. Without guidance, implementer would follow full-replace pattern, writing null for omitted optional fields (km_interval, last_performed_date, etc.).
- **Fix A ⭐**: Specified partial-update pattern in PUT contract — filter undefined keys before passing to `.update()`.
- **Decision**: FIXED via Fix A

### F3 — RLS insert policy SQL form differs from codebase

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Migration contract
- **Detail**: Plan described `car_id IN (SELECT id...)` but actual pattern in `20260531120000_create_repairs_table.sql:20-26` uses `EXISTS (SELECT 1 FROM public.cars WHERE id = car_id AND user_id = auth.uid())` with an additional `auth.uid() = user_id` row check.
- **Fix**: Updated migration contract with exact RLS SQL for all 4 policies.
- **Decision**: FIXED

### F4 — Phase 3 automated verification is only `npm run build`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Reminder Calculation Logic
- **Detail**: Plan described `computeReminderStatus` as "testable in isolation" but the only automated criterion was `npm run build`. No test runner configured for MVP.
- **Fix**: Added note clarifying "manual verification only for this phase — no test runner on MVP".
- **Decision**: FIXED

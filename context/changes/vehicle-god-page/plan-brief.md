# Vehicle Module Structural Refactor — Plan Brief

> Full plan: `context/changes/vehicle-god-page/plan.md`
> Research: `context/changes/vehicle-god-page/research.md`

## What & Why

Vehicle detail page (`[id].astro`) accumulated 3 domains across 6 additive commits into a 157-line god-page with no service layer. Research classified all 7 identified problems as accidental complexity and ranked 3 for immediate action: an import leak pulling Gemini SDK into all schema consumers, the god-page itself, and an inconsistent reload-after-delete UX pattern.

## Starting Point

`[id].astro` frontmatter handles auth, 3 Supabase queries (`select("*")` with type casts), 6 compute calls, and success-message routing. `schemas.ts` transitively imports `@google/genai` via stale import path. `RepairList` and `ServiceThresholdList` use `window.location.reload()` after delete while newer `CategorySelect` uses optimistic local state. `src/lib/services/` directory doesn't exist.

## Desired End State

Service facade at `src/lib/services/vehiclePageData.ts` owns all data fetching with explicit column selects. Page frontmatter is auth + service call + success routing. Both list components manage delete via local `useState`. All new code has unit tests.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Scope | K3 + K1 + K6 (all ranked) | Natural execution chain — each enables or complements the next | Research |
| Success-message routing | Stays in page | Presentation concern; service stays pure data-fetching | Plan |
| K2 (select("*")) | Fold into K1 | 3 of 4 occurrences move to service — fixing during extraction costs near-zero | Research + Plan |
| Service pattern | Single async function | Matches project convention (costPerKm.ts, serviceReminders.ts are all functions) | Plan |
| Service testing | Unit test with mocked Supabase | Catches orchestration bugs without running full SSR | Plan |
| K6 component tests | Add focused delete tests | Validates new local-state pattern; ~15 lines per component | Plan |

## Scope

**In scope:** K3 import fix, K1 service extraction, K2 explicit columns (folded into K1), K6 reload replacement, unit tests for service + delete behavior

**Out of scope:** K4 (schema split), K5 (non-atomic ops), K7 (types codegen), 4th select("*") in edit.astro, component testing infrastructure, behavior changes

## Architecture / Approach

Extract a `getVehiclePageData(supabase, vehicleId, userId)` facade into `src/lib/services/`. Page becomes thin orchestrator: auth → service call → template. List components adopt the same optimistic local-state pattern already proven in `CategorySelect`. No new dependencies, no API changes, no schema changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Import leak fix (K3) | Clean dependency graph for schemas.ts | None — 1-line change |
| 2. Service extraction (K1+K2) | vehiclePageData facade, page slimmed, explicit column selects | Template rendering regression if data shape changes |
| 3. Service unit tests | Test coverage for orchestration logic | Mock fidelity — Supabase chained API |
| 4. Reload replacement (K6) + tests | Smooth delete UX, component tests | State sync — local state diverging from server |

**Prerequisites:** None — can start immediately
**Estimated effort:** ~2-3 sessions across 4 phases

## Open Risks & Assumptions

- Supabase mock for service tests must replicate chained query builder API faithfully
- Local state after delete diverges from server — acceptable because page will re-query on next navigation
- 4th `select("*")` in `repairs/[id]/edit.astro` left for a future change

## Success Criteria (Summary)

- Vehicle detail page renders identically after service extraction (E2E passes, manual verification)
- Delete in RepairList and ServiceThresholdList removes item without page reload
- New service function and component delete behavior have unit test coverage

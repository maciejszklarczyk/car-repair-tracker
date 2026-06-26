---
date: 2026-06-18T18:30:00+02:00
researcher: Claude
git_commit: 2e8c15a
branch: feature/vehicle-god-page-research
repository: car-repair-tracker
topic: "Structural refactor candidates — evidence-based analysis of technical debt from vehicle module dependency research"
tags: [research, codebase, refactor-candidates, technical-debt, god-page, schema-drift, blast-radius]
status: complete
last_updated: 2026-06-18
last_updated_by: Claude
prior_research: "context/changes/vehicle-god-page/research.md (2026-06-18, commit 3064e06) — vehicle module dependency analysis"
prior_artifacts: "context/map/repo-map.md — repo territory + structure + contributors synthesis"
---

# Research: Structural Refactor Candidates

**Date**: 2026-06-18
**Git Commit**: 2e8c15a
**Branch**: feature/vehicle-god-page-research
**Prior research**: vehicle module dependency analysis (commit 3064e06)
**Prior artifacts**: repo-map.md (territory + structure + contributors)

## Research Question

Zbadaj każdy problem zidentyfikowany w raporcie zależności modułu vehicles. Sklasyfikuj jako KANDYDAT (naprawa zmienia strukturę kodu) lub nie-kandydat. Dla każdego kandydata: potwierdź obecny kształt w kodzie, ustal intencjonalność (świadome ograniczenie vs przypadkowa złożoność), oceń wykonalność migracji. Zakończ rankingiem refactor opportunities.

## Problem Inventory and Classification

### KANDYDACI (structural code changes)

| ID | Problem | Source |
|----|---------|--------|
| K1 | God-Page `vehicles/[id].astro` — 3 domains, no service layer | §2.1 |
| K2 | `select("*") as Type` — silent schema drift, 4 occurrences | §2.2 |
| K3 | `schemas.ts` import leak — transitive Gemini SDK dependency | §2.4 |
| K4 | `schemas.ts` bottleneck — flat 6-schema file, merge-conflict magnet | §2.4 |
| K5 | Non-atomic DB ops in `repairs/[id].ts` — 3 DB + 1 AI, no transaction | §2.5 |
| K6 | `window.location.reload()` — 2 occurrences, inconsistent with optimistic pattern | §2.6 |
| K7 | `types.ts ↔ migrations` manual sync — no codegen | §3.2 |

### NIE-KANDYDACI (test gaps, hardening — input to cost assessment)

| ID | Problem | Why not candidate |
|----|---------|-------------------|
| A | Zero React component unit tests | Test gap, not structural |
| B | `classifyRepair.ts` fully mocked in tests | Test strategy, not structural |
| C | `vehicles/[id].ts` API untested (GET/PUT/DELETE) | Test gap, not structural |
| D | No service-threshold E2E | Test gap, not structural |
| E | No client-side Zod validation of API responses | Hardening, not structural |

---

## Candidate Analysis

### K1: God-Page `vehicles/[id].astro`

#### Current Shape

- **10 import statements** from 6 source modules across 3 domains (vehicles, repairs, service-reminders) **[evidence: [id].astro:1-17]**
- **3 Supabase queries** — `cars` (line 30), `repairs` (line 43), `service_thresholds` (line 53) — all `select("*") as Type` **[evidence]**
- **6 compute calls** — `computeCurrentMileage`, `computeCostPerKm`, `computeCostTrendData`, `computeTotalCostTrendData`, `computeMileageTrendData`, `computeThresholdSummary` (lines 61-66) **[evidence]**
- **5 React islands** with `client:load` — CostTrendChart, RepairList, ServiceReminders, ServiceThresholdList, AddServiceThresholdForm (lines 133-155) **[evidence]**
- **No intermediate abstraction** between page and Supabase client. The ~60-line frontmatter block handles auth, data fetching, data transformation, and success-message routing **[evidence]**
- Success-message logic (lines 68-78) couples page to redirect conventions of 4 API routes **[evidence]**

#### Intentionality Verdict: ACCIDENTAL COMPLEXITY

Page created 2026-05-31 (557d72d) as 72-line minimal vehicle detail with 1 query. Grew to 157 lines through 6 additive feature commits, each from a separate `context/changes/` folder:
- May 31: Created (72 lines, 1 query)
- Jun 2: RepairList island (+25 lines), Cost/km (+48 lines, 2 new queries)
- Jun 8: Service reminders (+37 lines, threshold query), Cost trend chart (+28 lines)

No commit or design doc considered cumulative effect. Term "god-page" first appears in this research branch. Each feature treated the page as natural integration point without consolidation plan.

#### Migration Feasibility

- **Incremental path**: Extract `getVehiclePageData(supabase, vehicleId, userId)` facade into `src/lib/services/vehiclePageData.ts`. Moves 3 queries + 6 compute calls out of frontmatter. Page becomes: auth guard → one service call → template. Astro has no built-in data loader pattern — no loader config in `astro.config.mjs` **[evidence]**
- **Blast radius**: Low. Only `[id].astro` changes + 1 new file. No other file imports from this page. Pure lib functions (`costPerKm`, `serviceReminders`) continue to be called from the new service.
- **Existing guards**: 25 unit tests on pure lib functions called by this page. E2E `repair-lifecycle.spec.ts` exercises page end-to-end. CI runs `astro check` + build (catches type errors). No direct unit/integration test on page's orchestration logic.
- **First prerequisite**: Create `src/lib/services/vehiclePageData.ts` with typed return DTO. Move queries + compute calls. Replace frontmatter with single call.
- **Cost**: Small.

---

### K2: `select("*") as Type` — Silent Schema Drift

#### Current Shape

- **4 occurrences** of `select("*")` with `as Type` cast — all in `.astro` page files **[evidence]**:
  - `vehicles/[id].astro:31` — `as Vehicle`
  - `vehicles/[id].astro:43` — `as Repair[]`
  - `vehicles/[id].astro:53` — `as ServiceThreshold[]`
  - `repairs/[id]/edit.astro:15` — `as Repair`
- **No runtime validation** follows any cast — data goes directly from `result.data as Vehicle` to usage **[evidence]**
- **Contrast**: API routes consistently use explicit column lists: `select("id, user_id, car_id, description, category, category_source")` in `repairs/[id].ts:26`, `select("baseline_mileage")` in `repairs/[id].ts:36` **[evidence]**
- **Index page** uses `select("*, repairs(mileage)")` with a join **[evidence]**

#### Intentionality Verdict: ACCIDENTAL COMPLEXITY

All `select("*")` calls introduced across 3 commits (557d72d, 4a44b6a, a6b4ca3) during May 31 – Jun 8. First commit set the pattern, subsequent features cargo-culted it. API endpoints written around the same time used explicit column selection — proving the team knew the proper approach. No commit message discusses query selectivity or type safety.

#### Migration Feasibility

- **Incremental path**: Replace 4 `select("*")` with explicit column lists matching the interfaces. No new abstraction needed — follow existing API route pattern. If K1 (god-page extraction) happens first, all 3 `[id].astro` occurrences move to the service function (1 file instead of 2).
- **Blast radius**: Very low. 2 files, 4 call sites. Each change isolated to the select string argument.
- **Existing guards**: E2E tests cover both pages. `astro check` catches type errors at build. `as Type` casts remain safe because column lists match the interface.
- **First prerequisite**: Replace `select("*")` with explicit column lists in `vehicles/[id].astro` (3 calls) and `repairs/[id]/edit.astro` (1 call).
- **Cost**: Small (~30 min).
- **Dependency**: If K1 proceeds first, K2 becomes even cheaper (3 of 4 call sites move to service function).

---

### K3: `schemas.ts` Import Leak

#### Current Shape

- `schemas.ts:2` imports `REPAIR_CATEGORIES` from `@/lib/classifyRepair` **[evidence]**
- `classifyRepair.ts:1-5` imports `GoogleGenAI` from `@google/genai`, `GEMINI_API_KEY` from `astro:env/server`, and re-exports `REPAIR_CATEGORIES` from `@/lib/repairCategories` **[evidence]**
- `repairCategories.ts` — pure data file, 2 lines, zero external deps **[evidence]**
- Import chain: `schemas.ts → classifyRepair.ts → { @google/genai, astro:env/server }` **[evidence]**
- In SSR mode (no aggressive tree-shaking), `@google/genai` module likely evaluates when any file imports from `schemas.ts` **[inference]**
- `CategorySelect.tsx` already imports from `@/lib/repairCategories` directly — pattern proven **[evidence]**

#### Intentionality Verdict: ACCIDENTAL COMPLEXITY

Classic two-phase extraction. Commit ae74bf8 (Jun 10, phase 3) added `REPAIR_CATEGORIES` import to schemas.ts from `classifyRepair` — the only place it existed then. Same day, commit ab17150 (phase 4) extracted `repairCategories.ts` as canonical source and updated `classifyRepair.ts` to re-export from it. But `schemas.ts` was never updated to point at the new direct source. The re-export "worked" so the stale import was never caught.

#### Migration Feasibility

- **Incremental path**: 1-line change. `schemas.ts:2`: change `"@/lib/classifyRepair"` → `"@/lib/repairCategories"`.
- **Blast radius**: Near zero. Only `schemas.ts` changes. 5 consumers of `schemas.ts` import schema objects, not `REPAIR_CATEGORIES`. The re-export chain in `classifyRepair.ts:5` stays intact for its own consumers.
- **Existing guards**: CI lint + `astro check` + build catch import resolution failures. `categoryOverrideSchema` uses `z.enum(REPAIR_CATEGORIES)` — would fail at import time if path were wrong.
- **First prerequisite**: Change 1 import line.
- **Cost**: Trivial (~5 min).

---

### K4: `schemas.ts` Bottleneck

#### Current Shape

- **6 schemas exported** from 63-line flat file **[evidence: schemas.ts:1-63]**:
  - Repairs: `createRepairSchema`, `updateRepairSchema`, `categoryOverrideSchema`
  - Vehicles: `createVehicleSchema`
  - Service-thresholds: `createServiceThresholdSchema`, `updateServiceThresholdSchema`
- **5 importers** — all API route files, each importing only its own domain's schemas **[evidence]**:
  - `api/repairs.ts` → `createRepairSchema`
  - `api/repairs/[id].ts` → `updateRepairSchema`, `categoryOverrideSchema`
  - `api/service-thresholds.ts` → `createServiceThresholdSchema`
  - `api/service-thresholds/[id].ts` → `updateServiceThresholdSchema`
  - `api/vehicles.ts` → `createVehicleSchema`
- No domain grouping — schemas are flat **[evidence]**
- `createVehicleSchema` and `categoryOverrideSchema` each used by exactly 1 file — extraction candidates **[evidence]**

#### Intentionality Verdict: ACCIDENTAL COMPLEXITY (borderline deliberate for current size)

Created May 26 (7430042) with just `createVehicleSchema` (21 lines). Grew to 63 lines through 6 additive commits. No commit mentions "consolidate" or "extract". At 63 lines, not yet a genuine bottleneck — the merge-conflict risk from repo-map (7 commits in 12 months) is real but mild at current project scale.

#### Migration Feasibility

- **Incremental path**: Split into `src/lib/schemas/repairs.ts`, `src/lib/schemas/vehicles.ts`, `src/lib/schemas/service-thresholds.ts` + barrel `src/lib/schemas/index.ts` for backward compat. With barrel, zero import changes needed in consumers.
- **Blast radius**: Near zero with barrel re-export. Without barrel, 5 import paths need updating — but each maps cleanly to one domain.
- **Existing guards**: CI lint + `astro check` catches import errors. 44 API integration tests exercise all schema validation paths. Build step fails on broken imports.
- **First prerequisite**: Fix K3 first (import leak). Then create `src/lib/schemas/` directory, move schemas into domain files, add barrel `index.ts`.
- **Cost**: Small. But value is low at current file size (63 lines). Becomes high-value only if project continues adding schemas.

---

### K5: Non-Atomic DB Ops in `repairs/[id].ts`

#### Current Shape

- **PUT handler** (lines 8-89) — 6 sequential awaits **[evidence]**:
  1. `supabase.from("repairs").select(...)` — ownership check (line 24)
  2. `supabase.from("cars").select("baseline_mileage")` — validation read (line 34)
  3. `context.request.json()` — parse body (line 46)
  4. Schema validation — synchronous (line 51)
  5. `classifyRepair(description)` — external Gemini API call, conditional (line 75)
  6. `supabase.from("repairs").update(updateData)` — the write (line 82)
- Steps 1-4 are read-only. Risk window: between step 5 (AI call, idempotent) and step 6 (write). If step 6 fails after classification, no data corruption — classification has no side effects **[inference]**
- **RLS provides second layer**: comment on line 81 confirms "belt-and-suspenders" ownership enforcement **[evidence]**
- **DELETE** (lines 91-125) and **PATCH** (lines 127-179) — same read-then-write pattern, no transaction **[evidence]**
- **No transaction, no `.rpc()`, no Postgres function** anywhere in repo **[evidence]**
- All three handlers duplicate auth-check + supabase-init + ownership-verification boilerplate **[evidence]**

#### Intentionality Verdict: ACCIDENTAL COMPLEXITY

Original handler (Jun 2, 2f379ff) was simple validate-and-write — no transaction needed. AI classification call grafted in Jun 10 (ae74bf8) between validation and DB write. Commit message and plan show no consideration of failure modes. Supabase JS client doesn't expose transactions easily — likely contributed to pattern. Zero commits in entire repo mention "transaction" or "atomic".

#### Migration Feasibility

- **Incremental path**: Supabase JS client does NOT support client-side transactions. Proper fix: Postgres function via `supabase.rpc()`. But steps 1-4 are reads and step 5 is idempotent — the real TOCTOU risk is low because RLS is the actual transaction boundary for ownership.
- **Blast radius**: Medium. Requires new migration (Postgres function), changes to PUT handler, API test mock updates.
- **Existing guards**: `repairs-id.test.ts` has comprehensive tests for PUT handler (ownership, validation, classification). E2E `repair-lifecycle.spec.ts` covers edit flow. 44 integration tests total.
- **First prerequisite**: Assess whether risk justifies effort. RLS already prevents unauthorized updates. If proceeding: write migration creating `update_repair_if_owner()` Postgres function.
- **Cost**: Medium. RLS safety net makes this low-priority unless specific race condition is observed.

---

### K6: Client-Side `window.location.reload()`

#### Current Shape

- **2 reload occurrences** **[evidence]**:
  - `RepairList.tsx:30` — `window.location.reload()` after successful DELETE fetch
  - `ServiceThresholdList.tsx:37` — `window.location.reload()` after successful DELETE fetch
- **Contrast**: `CategorySelect.tsx:16-31` — optimistic UI with rollback on error, no reload **[evidence]**
- Both reload components manage their own `fetch()` call inline, no shared mutation hook **[evidence]**
- `RepairList` receives `repairs: Repair[]` as props, manages only `deleteError` state locally **[evidence]**
- `ServiceThresholdList` receives `thresholds: ThresholdWithStatus[]`, same self-contained fetch + reload **[evidence]**
- Reload triggers full SSR page re-render — all 3 Supabase queries re-execute, all compute functions re-run, all React islands re-hydrate **[inference]**
- Also found: `window.location.href = ...` redirects after form submission in EditRepairForm, EditServiceThresholdForm, AddServiceThresholdForm — these are correct Astro pattern (no client-side router) **[evidence]**

#### Intentionality Verdict: ACCIDENTAL COMPLEXITY

RepairList created Jun 2 (d57d48d) with reload as "simplest thing that works." ServiceThresholdList cargo-culted same pattern Jun 8 (a6b4ca3). CategorySelect built Jun 10 (ab17150) with optimistic updates — proving the team had evolved past reload by then. Coexistence of both patterns = textbook accidental complexity from iterative development.

#### Migration Feasibility

- **Incremental path**: Both components are React islands with `client:load` — they cannot share React state with Astro parent. Two options:
  - **(a)** Wrap page content in React parent managing state — large change, defeats islands architecture
  - **(b)** Use local React state within each island: after successful delete, filter the deleted item from local state via `useState`. No page reload needed. ~20 lines per component.
- Option (b) is correct path. `window.location.href` redirects in form components are fine as-is (correct Astro pattern).
- **Blast radius**: Low. 2 components change. No prop interface changes needed — components already have the data in props.
- **Existing guards**: No React component unit tests. E2E tests cover delete flow (catch broken UX). CI build + type checks catch interface changes.
- **First prerequisite**: In `RepairList.tsx`, add `useState` for repairs list, filter deleted item from local state on successful delete. Same for `ServiceThresholdList.tsx`.
- **Cost**: Small (~20 lines per component).

---

### K7: `types.ts ↔ migrations` Manual Sync

#### Current Shape

- **3 interfaces** exported — `Repair` (12 fields), `ServiceThreshold` (10 fields), `Vehicle` (9 fields) — 39 lines total **[evidence: types.ts:1-39]**
- **13 importers** across components, lib, tests, pages, API routes **[evidence]**
- **No codegen script** in `package.json`. No `supabase gen types` command, no `generate` script, no `database.types.ts` **[evidence]**
- Supabase CLI is a devDependency (`supabase` v2.23.4) but used only for local stack management **[evidence]**
- All fields are straightforward column mappings — no computed types, no unions beyond `string | null` and `number | null` **[evidence]**

#### Intentionality Verdict: ACCIDENTAL COMPLEXITY

Modified in 5 commits, always co-committed with migration change. Repo-map explicitly documents: "Ręczny sync — brak codegen. Co-change supabase ↔ types.ts w 5 commitach." Supabase offers `supabase gen types typescript` and the CLI is already installed. Manual sync was path of least resistance during initial development, never replaced.

#### Migration Feasibility

- **Incremental path**: Run `npx supabase gen types typescript --local > src/lib/database.types.ts`. Update `src/types.ts` to derive interfaces from generated types (type aliases), keeping import path stable for all 13 consumers. Option (a) with aliases preserves all import sites unchanged.
- **Blast radius**: High surface area (13 files) but low risk with type aliases approach. Generated types use same field names (match migration column names exactly). Main change: generated types live under `Database` namespace.
- **Existing guards**: `astro check` (full TypeScript) catches any mismatch across all 13 consumers. 44 API integration tests + 25 unit tests exercise typed data paths. Build step is further guard.
- **First prerequisite**: Run `npx supabase gen types typescript --local > src/lib/database.types.ts`. Then update `types.ts` to re-export aliases from generated types.
- **Cost**: Medium. Generation is trivial, but establishing workflow (regenerate on migration) and testing alias approach adds effort.
- **Dependency**: Partially overlaps with K2. If codegen types are in place, `select("*") as Type` can be replaced with typed Supabase client, eliminating K2 entirely.

---

## Refactor Opportunities — Ranked

### Rank 1: K3 — `schemas.ts` Import Leak

| | |
|-|-|
| **Present** | `schemas.ts` → `classifyRepair.ts` → `{ @google/genai, astro:env/server }` |
| **Target** | `schemas.ts` → `repairCategories.ts` (pure data, zero deps) |
| **Why this rank** | Highest signal-to-noise ratio in the entire list. 1 line of code. Eliminates transitive dependency on Gemini SDK for all 5 API route files. Zero blast radius. Enables K4. Known accidental complexity from same-day extraction oversight. |
| **Cost of debt** | Every test importing schemas.ts transitively loads Gemini SDK. Module evaluation side-effects in SSR. Semantic confusion — schemas should not depend on AI classification. |
| **Cost of change** | Trivial: ~5 min. Change 1 import path. |
| **Blast radius** | Near zero. 1 file changes. 5 consumers unaffected (they import schemas, not categories). |
| **Incremental path** | Single commit. Change `schemas.ts:2` from `"@/lib/classifyRepair"` to `"@/lib/repairCategories"`. |
| **First prerequisite** | None. Can execute immediately. |

### Rank 2: K1 — God-Page Service Extraction

| | |
|-|-|
| **Present** | `vehicles/[id].astro` frontmatter: 3 queries + 6 compute calls + auth + success routing — 60 lines of orchestration |
| **Target** | `src/lib/services/vehiclePageData.ts` facade — page becomes auth guard → 1 service call → template |
| **Why this rank** | Highest structural debt. Every lib/ change co-changes this file (6/5 top commits). Three domains mixed in one file. No isolation — threshold bug breaks entire vehicle detail. Extraction is straightforward because compute functions are already pure and extracted. Enables K2 (3 of 4 `select("*")` calls move to service). |
| **Cost of debt** | Merge conflicts on parallel work. Impossible to test orchestration independently. Every feature touching vehicles, repairs, or service-reminders forces edit of this 157-line file. |
| **Cost of change** | Small. 1 file refactored, 1 new file created. Pure extraction — no behavior change. |
| **Blast radius** | Low. Only `[id].astro` changes. No other file imports from this page. |
| **Incremental path** | Create `src/lib/services/vehiclePageData.ts` with typed DTO return. Move queries + compute calls. Replace frontmatter with single call. Existing E2E covers the result. |
| **First prerequisite** | None. Can execute immediately. K3 is independent and can be done before, after, or in parallel. |

### Rank 3: K6 — Replace `window.location.reload()` with Local State

| | |
|-|-|
| **Present** | `RepairList.tsx:30` and `ServiceThresholdList.tsx:37` — full page reload after delete |
| **Target** | Local `useState` filter — remove deleted item from component state, no reload |
| **Why this rank** | UX improvement with small code change. Inconsistent with CategorySelect's optimistic pattern (same module, newer code). Reload triggers full SSR re-render of all 3 queries + 5 islands — disproportionate cost for deleting 1 item. Team already evolved past this pattern. |
| **Cost of debt** | Poor UX (flash of reload on every delete). Wasted server resources (full re-query). Inconsistent interaction patterns within same page. |
| **Cost of change** | Small. ~20 lines per component. No new abstraction needed. |
| **Blast radius** | Low. 2 components change. No prop interface changes. |
| **Incremental path** | Add `useState` initialized from props. On successful delete, filter out deleted item. Keep existing fetch logic. |
| **First prerequisite** | None. Independent of other candidates. |

### Considered and Deferred

| ID | Candidate | Why deferred |
|----|-----------|-------------|
| K2 | `select("*") as Type` | Real problem but best solved as part of K1 (3 of 4 occurrences move to service function) or K7 (typed Supabase client eliminates the pattern entirely). Standalone fix is cheap but duplicates effort if K1 or K7 proceed. **Recommendation**: fold into K1 execution. |
| K4 | `schemas.ts` bottleneck | At 63 lines and 5 importers, this is mild. Merge-conflict risk is real but manageable at current project scale. The import leak (K3) is the actionable part — fix that first. Split only becomes worthwhile if project adds 3+ more schemas. **Recommendation**: monitor, split when file exceeds ~100 lines or a second contributor joins. |
| K5 | Non-atomic DB ops | RLS provides second ownership enforcement layer, making TOCTOU risk low in practice. Steps 1-4 are reads; step 5 (AI call) is idempotent. Supabase JS client doesn't support transactions natively — fix requires Postgres function + migration + test mock updates. **Recommendation**: defer unless specific race condition is observed. The boilerplate duplication across handlers is a stronger argument for extraction (but that's a service-layer concern, partially addressed by K1's pattern). |
| K7 | `types.ts ↔ migrations` sync | Correct long-term fix. Supabase CLI is installed, `gen types` is available. But the effort is medium (establish workflow, update 13 consumers or add alias layer) and the current manual sync works with 5 co-change commits over 12 months. **Recommendation**: execute when next migration is needed — add codegen as part of that change, not as standalone refactor. The `select("*") as Type` pattern (K2) becomes automatically fixable once typed client is in place. |

---

## Code References

- `src/pages/dashboard/vehicles/[id].astro:1-157` — God-page orchestrator
- `src/pages/dashboard/vehicles/index.astro:1-70` — Vehicle list page
- `src/pages/dashboard/repairs/[id]/edit.astro:15` — 4th `select("*")` occurrence
- `src/lib/schemas.ts:2` — Import leak line
- `src/lib/classifyRepair.ts:1-5` — Re-export chain
- `src/lib/repairCategories.ts` — Pure data source (2 lines)
- `src/lib/costPerKm.ts:3-72` — Pure functions (benchmark quality)
- `src/lib/serviceReminders.ts:12-77` — Threshold summary
- `src/pages/api/repairs/[id].ts:8-179` — Non-atomic PUT/DELETE/PATCH
- `src/components/repairs/RepairList.tsx:30` — `window.location.reload()`
- `src/components/service-reminders/ServiceThresholdList.tsx:37` — `window.location.reload()`
- `src/components/repairs/CategorySelect.tsx:16-31` — Optimistic UI (contrast)
- `src/types.ts:1-39` — Manual entity types

## Architecture Insights

- **Astro SSR + React islands pattern works well** for read-heavy pages. Compute logic extraction to `src/lib/` is the project's strongest pattern — `costPerKm.ts` is benchmark quality.
- **The god-page is a consequence of missing service layer**, not a framework limitation. Astro frontmatter is the natural home for data fetching, but nothing prevents extracting a facade function.
- **All 7 candidates are accidental complexity** — none was a deliberate architectural tradeoff. Each grew from iterative feature development without consolidation.
- **K3 → K1 → K6 is the natural execution order**: fix the import leak (unblocks clean K4 if needed later), extract the service layer (reduces god-page, absorbs K2), then fix the reload pattern (UX polish).
- **K5 and K7 are infrastructure changes** — they require new patterns (Postgres functions, codegen workflow) rather than extracting existing code. Higher setup cost, lower urgency given existing safety nets (RLS, manual sync that works).

## Historical Context

- Prior research (commit 3064e06) established the dependency map, blast radius classification, and test coverage gaps. This research builds on those findings — all structural claims verified by sub-agents against current code.
- Repo-map (context/map/repo-map.md) identified `vehicles/[id].astro` as god-page, `schemas.ts` as connector bottleneck, and `types.ts ↔ migrations` manual sync. All confirmed.

## Open Questions

1. Should K1 (service extraction) include the success-message routing logic (lines 68-78), or should that stay in the page as a presentation concern?
2. For K7 (codegen), should generated types replace `types.ts` entirely or live alongside as `database.types.ts` with aliases? The alias approach is safer but adds indirection.
3. K5 (non-atomic ops) — is the RLS safety net sufficient, or has any partial-failure scenario been observed in production/demo?

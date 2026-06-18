---
date: 2026-06-18T12:00:00+02:00
researcher: Claude
git_commit: 3064e060177a60b9bb2f6c3e22a0b92eca8979b1
branch: feature/repo-map
repository: car-repair-tracker
topic: "Vehicle module dependency analysis — god-page structure, test gaps, blast radius"
tags: [research, codebase, vehicles, god-page, dependencies, technical-debt]
status: complete
last_updated: 2026-06-18
last_updated_by: Claude
---

# Research: Vehicle Module Dependency Analysis

**Date**: 2026-06-18  
**Git Commit**: 3064e06  
**Branch**: feature/repo-map

## Research Question

Analiza struktury modułu vehicles z uwzględnieniem: E2E paths, luk w testach, blast radius refactoru. Kontekst: repo-map.md identyfikuje `vehicles/[id].astro` jako god-page. Twierdzenia strukturalne zweryfikowane ast-grep + grep 2026-06-18.

## Summary

God-page `vehicles/[id].astro` to orkiestrator 3 domen (vehicles, repairs, service-reminders) bez warstwy pośredniej. 11 ścieżek użytkownika przepływa przez moduł. Strona ma 9 import statements z 6 modułów źródłowych, wykonuje 3 zapytania Supabase, 6 transformacji danych i renderuje 5 React islands (`client:load`). Najsilniejsze sprzężenia: `types.ts` (13 konsumentów w src/), `costPerKm.ts` (5 funkcji + 3 interfejsy typów → strona + chart), `serviceReminders.ts` (kontrakt `ThresholdWithStatus` → 2 komponenty). Kluczowe luki: zero unit testów na komponentach React, brak testów `vehicles/[id].ts` API, `classifyRepair.ts` zamockowany w całości. Wzorzec `select("*") as Type` występuje 4× w repo (3× god-page + 1× repairs edit).

---

## 1. Feature Overview

### 1.1 E2E User Paths (11 paths)

| # | Path | Entry Point | Key Files |
|---|------|-------------|-----------|
| 1 | Vehicle list | `GET /dashboard/vehicles` | `vehicles/index.astro` → `costPerKm.ts` → `VehicleCard.astro` |
| 2 | Vehicle detail | `GET /dashboard/vehicles/[id]` | `[id].astro` → 3× Supabase query → 6× lib compute → 5× React island |
| 3 | Add vehicle | `GET /vehicles/new` → `POST /api/vehicles` | `AddVehicleForm.tsx` → `createVehicleSchema` → Supabase insert |
| 4 | Add repair | `GET /repairs/new` → `POST /api/repairs` | `AddRepairForm.tsx` → `createRepairSchema` → `classifyRepair()` → Supabase insert |
| 5 | Edit repair | `GET /repairs/[id]/edit` → `PUT /api/repairs/[id]` | `EditRepairForm.tsx` → `updateRepairSchema` → conditional reclassify → Supabase update |
| 6 | Delete repair | `DELETE /api/repairs/[id]` | `RepairList.tsx` → fetch DELETE → `window.location.reload()` |
| 7 | Category override | `PATCH /api/repairs/[id]` | `CategorySelect.tsx` → `categoryOverrideSchema` → Supabase update |
| 8 | Add threshold | `POST /api/service-thresholds` | `AddServiceThresholdForm.tsx` → `createServiceThresholdSchema` → Supabase insert |
| 9 | Edit threshold | `PUT /api/service-thresholds/[id]` | `EditServiceThresholdForm.tsx` → `updateServiceThresholdSchema` → Supabase update |
| 10 | Delete threshold | `DELETE /api/service-thresholds/[id]` | `ServiceThresholdList.tsx` → fetch DELETE |
| 11 | Cost trend charts | Rendered on vehicle detail | `costPerKm.ts` (3 trend functions) → `CostTrendChart.tsx` (Recharts) |

### 1.2 Data Flow Architecture

```
[id].astro (SSR orchestrator)
  │
  ├── Supabase queries ──────────────────────────────────┐
  │   ├─ cars.select("*").eq(id).eq(user_id)             │
  │   ├─ repairs.select("*").eq(car_id)                  │  3 tables
  │   └─ service_thresholds.select("*").eq(car_id)       │
  │                                                       │
  ├── lib/ computations (pure functions) ────────────────┤
  │   ├─ computeCurrentMileage(repairs, baseline)        │
  │   ├─ computeCostPerKm(vehicle, repairs)              │
  │   ├─ computeCostTrendData(vehicle, repairs)          │  6 transforms
  │   ├─ computeTotalCostTrendData(repairs)              │
  │   ├─ computeMileageTrendData(repairs)                │
  │   └─ computeThresholdSummary(thresholds, mileage)   │
  │                                                       │
  └── React islands (client:load) ───────────────────────┘
      ├─ CostTrendChart     (costPerKmData, totalCostData, mileageData)
      ├─ ServiceReminders   (thresholdSummary)
      ├─ ServiceThresholdList (thresholdSummary)
      ├─ AddServiceThresholdForm (carId)
      └─ RepairList          (repairs)
```

### 1.3 Component Inventory

| Component | Type | Client Directive | Domain |
|-----------|------|-----------------|--------|
| `CostTrendChart.tsx` | React | `client:load` | vehicles/charts |
| `RepairList.tsx` | React | `client:load` | repairs |
| `ServiceReminders.tsx` | React | `client:load` | service-reminders |
| `ServiceThresholdList.tsx` | React | `client:load` | service-reminders |
| `AddServiceThresholdForm.tsx` | React | `client:load` | service-reminders |
| `EditServiceThresholdForm.tsx` | React | child of list | service-reminders |
| `CategorySelect.tsx` | React | child of edit form | repairs |
| `CategoryBadge.tsx` | React | child of list | repairs |
| `VehicleCard.astro` | Astro | none (SSR) | vehicles |
| `AddVehicleForm.tsx` | React | `client:load` | vehicles |

### 1.4 Supabase Query Map

God-page executes 3 direct queries. API routes serving the module add 15+ more across CRUD ops on `cars`, `repairs`, `service_thresholds`. All tables enforce RLS with `user_id = auth.uid()`. FK cascade: `repairs.car_id → cars.id ON DELETE CASCADE`, `service_thresholds.car_id → cars.id ON DELETE CASCADE`.

---

## 2. Technical Debt

### 2.1 God-Page Anti-Pattern (`vehicles/[id].astro`)

**Problem**: Single file orchestrates 3 domains (vehicles, repairs, service-reminders) with 9 import statements from 6 source modules, 3 Supabase queries, and 6 data transformations. Every lib/ change forces a change here (6/5 top commits co-changed with lib/).

**Impact**: Merge conflicts on parallel work. No isolation — a bug in threshold computation breaks the entire vehicle detail view. Impossible to test the orchestration logic independently.

**Missing layer**: No service/facade between the page and the raw Supabase client + lib functions. The page handles auth, data fetching, data transformation, and rendering in one frontmatter block.

### 2.2 `select("*") as Type` — Silent Schema Drift

**Problem**: `select("*")` + `as Type` cast used 4× in repo: 3× in `[id].astro` (lines 31, 43, 53 → `as Vehicle`, `as Repair[]`, `as ServiceThreshold[]`) and 1× in `repairs/[id]/edit.astro:15` (`as Repair`). Additionally `vehicles/index.astro:22` uses `as VehicleWithRepairs[]`. No runtime validation in any case. If a migration adds/removes/renames a column, TypeScript won't catch it — the cast silently accepts wrong shapes.

**Evidence**: repo-map.md confirms 5 co-change commits in the `migrations → types.ts` chain, each requiring manual propagation. No codegen, no ORM with types.

**Impact**: Silent runtime bugs. A renamed column returns `undefined` for the old name; the page renders empty data or crashes in a compute function.

### 2.3 Test Coverage Gaps

#### Untested source files

| File | Gap | Risk |
|------|-----|------|
| `vehicles/[id].ts` API | Zero tests (GET, PUT, DELETE) | Vehicle archive/delete untested |
| `classifyRepair.ts` | Fully mocked in all tests | Gemini parsing, timeout, fallback — zero real coverage |
| `ServiceReminders.tsx` | Zero tests | Presentational but filter logic (`overdue`/`approaching`) untested |
| `ServiceThresholdList.tsx` | Zero tests | List rendering + delete integration untested |
| `RepairList.tsx` | E2E only, 0 unit | `fetch()` + `window.reload()` pattern; 6 commits of changes |

#### Coverage by layer

| Layer | Covered | Gap |
|-------|---------|-----|
| Pure lib functions (`costPerKm`, `serviceReminders`) | 25 unit tests | Solid — benchmark quality |
| API routes (repairs, service-thresholds) | 44 integration tests | Missing `vehicles/[id].ts` entirely |
| React components | 0 unit/integration tests | All coverage via E2E only |
| E2E flows | 3 spec files | Repair lifecycle + data isolation + seed. No service-threshold E2E |

### 2.4 Schema Connector Bottleneck (`schemas.ts`)

**Problem**: `schemas.ts` exports 6 schemas consumed by 5 API route files (not "13 areas" — repo-map counted co-change, not import edges). Every feature touching repairs, vehicles, or thresholds modifies this file. 7 commits in 12 months.

**Import leak** (ast-grep confirmed): `schemas.ts:2` imports `REPAIR_CATEGORIES` from `@/lib/classifyRepair`, which re-exports it from `@/lib/repairCategories.ts`. Full chain: `schemas.ts → classifyRepair.ts → { GoogleGenAI from @google/genai, GEMINI_API_KEY from astro:env/server }`. Tests importing schemas transitively pull in Gemini SDK. Fix: change `schemas.ts:2` to `import { REPAIR_CATEGORIES } from "@/lib/repairCategories"` (1-line change).

### 2.5 Non-Atomic DB Operations in `repairs/[id].ts`

**Problem**: PUT handler (lines 8–89) runs 3 sequential Supabase operations (verify repair ownership :24 → verify vehicle ownership :34 → update :82) plus 1 optional `classifyRepair()` AI call (:75) between the last read and the write. Not 4 DB ops — 3 DB + 1 external API. No transaction wrapping. Partial failure leaves inconsistent state.

**Impact**: If reclassification succeeds but the final update fails, the old category persists but the AI call is wasted. If the ownership check passes but the update fails, the user sees a generic error with no rollback.

### 2.6 Client-Side Patterns

- `RepairList.tsx:30` and `ServiceThresholdList.tsx:37` use `window.location.reload()` after delete — full page reload instead of optimistic UI update or selective refetch. These are the only 2 occurrences in the codebase (ast-grep confirmed).
- `CategorySelect.tsx` does optimistic UI with revert on error — inconsistent pattern within the same module.
- No client-side Zod validation of API responses — `fetch()` results parsed with `.json()` and trusted implicitly.

---

## 3. Blast Radius

### 3.1 Dependency Classification

#### HARD (interface change breaks vehicle module)

| File | Consumers | Why |
|------|-----------|-----|
| `types.ts` (Vehicle, Repair, ServiceThreshold) | 13 files in src/ | Every component, lib function, API route depends on these shapes |
| `costPerKm.ts` (5 functions + 3 interfaces) | page + chart + tests | Return types are intermediate contracts (CostTrendPoint etc.) |
| `serviceReminders.ts` (`ThresholdWithStatus`) | page + 2 components + tests | Interface shared between page and islands |
| `supabase.ts` (`createClient`) | 17 files | Signature change breaks every page and API route |
| 5 React components | `[id].astro` | Props interface changes break the page |
| `Layout.astro` | all pages | Slot/props contract |

#### SOFT (data shape change → silent bugs)

| File | Why |
|------|-----|
| `schemas.ts` | Validation drift = data drift between API and page |
| Supabase migrations | `select("*")` + `as` cast masks column changes |
| API response shapes | React islands trust `fetch()` responses without validation |
| `classifyRepair.ts` | Category enum drift → CategoryBadge fallback styling |
| `demo-seed.ts` | Seed shape drift → incorrect demo data rendering |

#### CO-CHANGE (no import link, historically coupled)

| File | Co-change count |
|------|----------------|
| `vehicles/index.astro` | 3/5 commits |
| `VehicleCard.astro` | 2/5 commits |
| `repairs/new.astro` | URL param coupling (`vehicle_id`) |
| `repairs/[id]/edit.astro` | URL pattern coupling |

### 3.2 Highest-Risk Coupling Points (ranked)

1. **`types.ts`** — Hub. Any field rename propagates to 13 files in src/. No runtime guard.
2. **`costPerKm.ts`** — 5 functions + 3 type interfaces tightly coupled to Vehicle/Repair types AND chart props. Change ripples to page + chart + tests.
3. **`serviceReminders.ts`** — `ThresholdWithStatus` intermediate contract shared by page + 2 components.
4. **DB schema via `select("*")`** — No runtime validation. Column changes invisible to TypeScript.
5. **API response shapes** — Three islands do `fetch()` without response validation. Shape change = silent UI failure.
6. **`schemas.ts`** — Indirect coupling. Defines what API accepts → determines what page reads back.
7. **`vehicles/index.astro` + `VehicleCard.astro`** — Co-change pattern; refactoring detail without updating index → inconsistent UX.

---

## Code References

- `src/pages/dashboard/vehicles/[id].astro:1-157` — God-page (orchestrator)
- `src/pages/dashboard/vehicles/index.astro:1-70` — Vehicle list page
- `src/lib/costPerKm.ts:3-72` — 5 functions + 3 type interfaces
- `src/lib/serviceReminders.ts:12-77` — Threshold summary + reminder status
- `src/lib/schemas.ts` — 6 Zod schemas consumed by 5 API route files
- `src/lib/classifyRepair.ts:18-42` — Gemini AI classification
- `src/pages/api/repairs/[id].ts:8-179` — PUT (3 DB ops + 1 AI call) / DELETE / PATCH
- `src/components/repairs/RepairList.tsx:22-117` — Delete with `window.location.reload()`
- `src/components/service-reminders/ServiceThresholdList.tsx:28-169` — List + edit + delete
- `src/types.ts` — Vehicle (9 fields), Repair (12 fields), ServiceThreshold (10 fields)

## Architecture Insights

- **Astro SSR + React islands pattern works well** for read-heavy pages. The server does all data fetching and transformation; React only handles interactivity.
- **The god-page is a consequence of this pattern** — without a service layer, all orchestration lands in the `.astro` frontmatter. Astro doesn't encourage extraction of data-fetching logic the way Next.js server components or Remix loaders do.
- **`costPerKm.ts` is the gold standard** — pure functions, well-typed, fully tested. The rest of `lib/` follows this pattern but `classifyRepair.ts` breaks it (side effects, external API, zero coverage).
- **The three domains (vehicles, repairs, service-reminders) are not independent** — they share `car_id` as the pivot. Any refactor must preserve the fan-in to the vehicle detail page.

## Open Questions

1. Is there a plan to introduce a data-fetching layer (e.g., service functions wrapping Supabase queries) between pages and the raw client?
2. Should `select("*")` be replaced with explicit column lists to catch schema drift at the query level?
3. Is the `window.location.reload()` pattern intentional (simplicity) or a placeholder for proper state management?
4. Should `classifyRepair.ts` have dedicated unit tests with stubbed Gemini responses, or is the full-mock approach in integration tests sufficient?

---

## Appendix: ast-grep / grep Verification (2026-06-18)

Structural claims from initial research verified against codebase. Method: ast-grep pattern matching + classical grep fallback for zero-result cases.

| # | Claim (original) | Tool | Verdict | Correction |
|---|-----------------|------|---------|-----------|
| 1 | "10+ imports from 5 modules and 3 domains" | grep | **Doprecyzowane** | 9 import statements from 6 source modules. 3 domains confirmed (vehicles, repairs, service-reminders) |
| 2 | "3 Supabase queries" | grep `.from(` | **Potwierdzone** | Lines 30, 42, 52 — `cars`, `repairs`, `service_thresholds` |
| 3 | "6 data transformations" | grep `compute` | **Potwierdzone** | Lines 61–66: 6 `compute*()` calls |
| 4 | "5 React islands (client:load)" | grep `client:load` | **Potwierdzone** | Lines 137, 144, 148, 149, 154 |
| 5 | "types.ts — 20+ consumers" | grep `from "@/types"` | **Obalone** | 13 files in `src/` (12 production + 1 test helper). Not 20+ |
| 6 | "costPerKm.ts exports 5 functions" | grep `^export` | **Doprecyzowane** | 5 functions + 3 type/interface exports = 8 total exports |
| 7 | "ThresholdWithStatus → 2 components" | grep `ThresholdWithStatus` | **Potwierdzone** | `ServiceReminders.tsx` + `ServiceThresholdList.tsx` (+ definition in `serviceReminders.ts`) |
| 8 | "createClient imported by 15+ files" | grep `from "@/lib/supabase"` | **Potwierdzone** | 17 files (15 production + 2 test) |
| 9 | "schemas.ts connects 13 areas" | grep `from "@/lib/schemas"` | **Obalone** | 6 exports consumed by 5 API route files. "13" not substantiated — repo-map counted co-change, not import edges |
| 10 | "4 sequential DB ops in PUT" | grep `await supabase` + Read | **Doprecyzowane** | 3 DB ops (lines 24, 34, 82) + 1 optional `classifyRepair()` AI call (line 75). Not 4 DB ops |
| 11 | "window.reload() in RepairList" | ast-grep + grep | **Doprecyzowane** | `window.location.reload()` (not `window.reload()`). Found in 2 files: `RepairList.tsx:30` + `ServiceThresholdList.tsx:37` |
| 12 | "select('*') as Type pattern" | grep `select("\*")` | **Potwierdzone** | 4 occurrences: `[id].astro` (3×, lines 31/43/53), `repairs/[id]/edit.astro:15`. Plus `vehicles/index.astro:22` uses `as VehicleWithRepairs[]` |
| 13 | "schemas.ts → classifyRepair.ts import leak" | grep import chain | **Potwierdzone** | `schemas.ts:2` → `classifyRepair.ts` (re-exports `REPAIR_CATEGORIES`) → `GoogleGenAI` + `astro:env/server`. `repairCategories.ts` exists as direct alternative |
| 14 | "0 unit tests on React components" | grep + find | **Potwierdzone** | Zero test files reference any component name. Zero `@testing-library` imports in project |
| 15 | "vehicles/[id].ts API — zero tests" | find + grep | **Potwierdzone** | `vehicles.test.ts` covers only POST. No `vehicles-id.test.ts` exists |

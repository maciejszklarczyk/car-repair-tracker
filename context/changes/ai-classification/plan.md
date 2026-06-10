# AI Repair Classification Implementation Plan

## Overview

Add AI-powered repair classification using Google Gemini 2.5 Flash-Lite. Each repair gets auto-classified into one of six categories (silnik, hamulce, elektryka, ogumienie, przegląd, inne) on creation. Users can override the category inline. Classification is non-blocking — if Gemini times out (3s), the repair saves with `pending` status and the user picks manually.

## Current State Analysis

- Repairs table has 9 columns — no `category` field exists
- `Repair` interface in `src/types.ts` mirrors the DB schema (no category)
- POST `/api/repairs` inserts directly, no external API calls anywhere in the app
- PUT `/api/repairs/[id]` updates description/cost/mileage — no category handling
- `RepairList.tsx` renders date/cost/mileage/description — no category display
- Env vars use `astro:env/server` pattern (`SUPABASE_URL`, `SUPABASE_KEY`)
- No AI/LLM dependencies in `package.json`
- Business logic pattern: pure functions in `src/lib/` (e.g. `costPerKm.ts`, `serviceReminders.ts`)

### Key Discoveries:

- `src/pages/api/repairs.ts:51-58` — insert object is the integration point for adding category on create
- `src/pages/api/repairs/[id].ts:64-72` — update object needs category fields for edit reclassification
- `src/components/repairs/RepairList.tsx:55-109` — repair card needs category badge + dropdown
- `astro.config.mjs:21-26` — env schema needs `GEMINI_API_KEY` entry
- Vehicle detail page (`src/pages/dashboard/vehicles/[id].astro:49`) casts repairs as `Repair[]` — type must include new fields

## Desired End State

After implementation:
- Every new repair is auto-classified by Gemini within 3s or saved as `pending`
- Each repair displays a colored category badge in the repair list
- Users can change category via inline dropdown (saves immediately)
- Editing a repair's description re-classifies if current category was AI-assigned
- `original_category` column preserves AI's pick when user overrides
- App continues working if Gemini is unreachable (graceful degradation to `pending`)

Verification: add a repair with description "wymiana klocków hamulcowych przód" → see `hamulce` badge appear. Change it to `silnik` via dropdown → `category_source` becomes `manual`, `original_category` stays `hamulce`.

## What We're NOT Doing

- Background job queue or async classification worker
- Retry button for pending classifications
- Category-based filtering or grouping in repair list
- Cost breakdown by category
- Classification accuracy tracking dashboard
- Batch reclassification of existing repairs

## Implementation Approach

Four-phase vertical slice following the established pattern (migration → service → API → UI). Classification happens synchronously in the API POST/PUT handlers with a 3-second AbortSignal timeout. The Gemini call is isolated in a pure function (`src/lib/classifyRepair.ts`) that returns a category string or `null` on failure — the API layer handles the fallback to `pending`.

## Critical Implementation Details

**Timing & lifecycle** — The Gemini call MUST happen after Zod validation and car ownership checks but BEFORE the Supabase insert. This way a single insert carries the category. Do not insert first then update — that creates a window where the repair exists without a category and doubles the DB round-trips.

## Phase 1: Database Migration + Type Updates

### Overview

Add three nullable columns to the repairs table and update the TypeScript interface. Nullable so existing repairs aren't broken and new repairs can be `pending`.

### Changes Required:

#### 1. Migration file

**File**: `supabase/migrations/YYYYMMDDHHMMSS_add_repair_category.sql`

**Intent**: Add `category`, `category_source`, and `original_category` columns to the `repairs` table. All nullable — existing rows get NULL (uncategorized), new rows get values from the classification flow.

**Contract**: 
- `category TEXT` — one of `silnik`, `hamulce`, `elektryka`, `ogumienie`, `przegląd`, `inne`, `pending`, or NULL
- `category_source TEXT` — one of `ai`, `manual`, `pending`, or NULL
- `original_category TEXT` — stores AI's original pick before user override, or NULL
- No CHECK constraint on category values — validation happens in app layer via Zod
- No default values — explicit assignment in API layer

#### 2. TypeScript interface

**File**: `src/types.ts`

**Intent**: Extend `Repair` interface with the three new fields so TypeScript catches missing references.

**Contract**: Add `category: string | null`, `category_source: string | null`, `original_category: string | null` to the `Repair` interface.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db push`
- TypeScript compiles: `npx astro check` (or `npm run build`)
- Existing repair queries still work (select * returns new columns as null)

#### Manual Verification:

- In Supabase Studio, verify repairs table has three new columns
- Existing repairs show NULL for all three new columns

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Classification Service + Environment Setup

### Overview

Create the Gemini classification function and wire the API key into the env schema. This phase is pure logic — no API route changes yet.

### Changes Required:

#### 1. Install Gemini SDK

**Intent**: Add `@google/genai` as a project dependency.

**Contract**: `npm install @google/genai`

#### 2. Environment variable

**File**: `astro.config.mjs`

**Intent**: Register `GEMINI_API_KEY` as a server-only secret alongside existing Supabase vars.

**Contract**: Add `GEMINI_API_KEY: envField.string({ context: "server", access: "secret", optional: true })` to `env.schema`.

#### 3. Classification module

**File**: `src/lib/classifyRepair.ts`

**Intent**: Pure async function that takes a repair description string and returns a category or null. Calls Gemini 2.5 Flash-Lite with a structured prompt constraining output to exactly one of the six categories. Uses AbortSignal with 3-second timeout. Returns `null` on any failure (timeout, API error, unexpected response).

**Contract**: 
```ts
export const REPAIR_CATEGORIES = ["silnik", "hamulce", "elektryka", "ogumienie", "przegląd", "inne"] as const;
export type RepairCategory = (typeof REPAIR_CATEGORIES)[number];

export async function classifyRepair(description: string): Promise<RepairCategory | null>
```

The prompt must instruct the model to return ONLY the category name, no explanation. Parse the response, trim whitespace, lowercase, and validate against `REPAIR_CATEGORIES`. Return `null` if the response doesn't match any category.

Use `AbortSignal.timeout(3000)` passed via `generateContent` config (per-call), not client-level `httpOptions.timeout`.

Import `GEMINI_API_KEY` from `astro:env/server`. If key is undefined, return `null` immediately (graceful degradation when not configured).

#### 4. Update .env.example

**File**: `.env.example`

**Intent**: Document the new env var so other developers know to set it.

**Contract**: Add `GEMINI_API_KEY=` line.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles with new module: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Set `GEMINI_API_KEY` in `.dev.vars`, call `classifyRepair("wymiana klocków hamulcowych przód")` from a test script or REPL — returns `"hamulce"`
- Call with empty string or gibberish — returns `"inne"` or `null`
- Unset `GEMINI_API_KEY` — returns `null` without throwing

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: API Integration

### Overview

Wire classification into the repair create and edit endpoints. On create: classify then insert. On edit: re-classify only if description changed AND current category was AI-assigned.

### Changes Required:

#### 1. Repair create endpoint

**File**: `src/pages/api/repairs.ts`

**Intent**: After validation and before insert, call `classifyRepair(description)`. Set `category` to the result (or `"pending"` if null), `category_source` to `"ai"` (or `"pending"` if classification failed), and `original_category` to same as `category`.

**Contract**: The insert object at line 51 gains three fields: `category`, `category_source`, `original_category`. Import `classifyRepair` from `@/lib/classifyRepair`.

#### 2. Repair edit endpoint

**File**: `src/pages/api/repairs/[id].ts`

**Intent**: In PUT handler, fetch the existing repair's `description`, `category_source`. If description changed AND `category_source === "ai"`, call `classifyRepair` on the new description and update category fields. If `category_source === "manual"`, leave category untouched.

**Contract**: The existing select at line 24 must include `description, category_source` in addition to `id, user_id, car_id`. The update object at line 66 conditionally includes `category`, `category_source`, `original_category` fields.

#### 3. Category override endpoint

**File**: `src/pages/api/repairs/[id].ts`

**Intent**: Add a PATCH handler specifically for category override. Accepts `{ category: string }`, validates against `REPAIR_CATEGORIES`, updates `category` and sets `category_source` to `"manual"`. Preserves `original_category` (doesn't overwrite it — that column only changes on AI classification).

**Contract**: Export `PATCH` as an `APIRoute`. Validates ownership same as PUT/DELETE. Zod schema: `z.object({ category: z.enum(REPAIR_CATEGORIES) })`.

#### 4. Update Zod schemas

**File**: `src/lib/schemas.ts`

**Intent**: Add a `categoryOverrideSchema` for the PATCH endpoint validation.

**Contract**: `export const categoryOverrideSchema = z.object({ category: z.enum(REPAIR_CATEGORIES) })`. Import `REPAIR_CATEGORIES` from `@/lib/classifyRepair`.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- POST a new repair via the app → repair saved with `category` set (not null), `category_source = "ai"`
- POST with Gemini key unset → repair saved with `category = "pending"`, `category_source = null`
- PUT with changed description (AI-sourced category) → category re-classified
- PUT with changed description (manual category) → category unchanged
- PATCH with `{ category: "silnik" }` → category updated, `category_source = "manual"`, `original_category` unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: UI — Category Display + Override

### Overview

Show category badge on each repair in the list. Add inline dropdown for category override. Handle `pending` and null states.

### Changes Required:

#### 1. Category badge component

**File**: `src/components/repairs/CategoryBadge.tsx`

**Intent**: Small colored badge displaying the category name. Different colors per category for visual distinction. Shows "Pending" in muted style for `pending` category, "—" for null.

**Contract**: `export default function CategoryBadge({ category }: { category: string | null }): JSX.Element`. Uses `cn()` for conditional classes. Color mapping is a simple object lookup.

#### 2. Category override dropdown

**File**: `src/components/repairs/CategorySelect.tsx`

**Intent**: Inline select/dropdown showing current category. On change, fires PATCH to `/api/repairs/[id]` and updates local state optimistically. Shows all 6 categories as options.

**Contract**: `export default function CategorySelect({ repairId, currentCategory, onCategoryChange }: Props): JSX.Element`. Uses shadcn `Select` component. Calls PATCH endpoint, reverts on error.

#### 3. Update RepairList

**File**: `src/components/repairs/RepairList.tsx`

**Intent**: Add category badge and override dropdown to each repair card. Badge shows category visually; dropdown appears on interaction (or always visible — implementer decides based on space).

**Contract**: Import `CategoryBadge` and `CategorySelect`. Add to the repair card layout between the metadata row and description. Pass `repair.category` and `repair.id` as props.

#### 4. Update vehicle detail page

**File**: `src/pages/dashboard/vehicles/[id].astro`

**Intent**: No structural changes needed — the page already passes `repairs` array to `RepairList`, and the Repair type now includes category fields. The data flows automatically.

**Contract**: Verify that the `repairs` query (`select("*")` at line 43) returns the new columns. No code change expected — `select("*")` already covers new columns.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Vehicle detail page shows category badge on each repair
- New repair shows AI-assigned category badge after save
- Clicking category opens dropdown with 6 options
- Selecting a different category updates badge immediately
- Pending repairs show muted "Pending" badge with working dropdown
- Old repairs (null category) show "—" badge with working dropdown
- Page reload preserves the overridden category

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `classifyRepair` with mocked Gemini responses → returns correct category
- `classifyRepair` with timeout → returns null
- `classifyRepair` with unexpected response → returns null
- `classifyRepair` with no API key → returns null
- `categoryOverrideSchema` validates correct categories, rejects invalid ones

### Manual Testing Steps:

1. Add repair "wymiana klocków hamulcowych przód" → expect `hamulce`
2. Add repair "wymiana opon letnich" → expect `ogumienie`
3. Add repair "przegląd techniczny" → expect `przegląd`
4. Add repair "something random in English" → expect `inne`
5. Override `hamulce` to `silnik` → verify badge updates, `category_source` is `manual` in DB
6. Edit description of AI-classified repair → verify re-classification
7. Edit description of manually-classified repair → verify category unchanged
8. Unset `GEMINI_API_KEY` → add repair → verify `pending` badge, manual dropdown works
9. Verify old repairs (pre-migration) show null state gracefully

## Performance Considerations

- Gemini call adds ~1-2s to repair creation. Acceptable per FR-011 ("few seconds").
- 3s timeout prevents worst-case hangs.
- No caching needed — each description is unique.
- Free tier: 30 RPM, 1.5K RPD — far exceeds individual user needs.

## Migration Notes

- Migration is additive (nullable columns) — no data migration needed.
- Existing repairs get NULL for all three columns — treated as "uncategorized" in UI.
- No backfill of existing repairs — user can manually categorize via dropdown if desired.

## References

- Roadmap slice: `context/foundation/roadmap.md` → S-05
- PRD requirements: FR-004, FR-005, FR-011
- Gemini SDK docs: `@google/genai` TypeScript package
- Existing API pattern: `src/pages/api/repairs.ts`, `src/pages/api/repairs/[id].ts`
- Existing service pattern: `src/lib/costPerKm.ts`, `src/lib/serviceReminders.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Migration + Type Updates

#### Automated

- [x] 1.1 Migration applies cleanly — d94fcd6
- [x] 1.2 TypeScript compiles — d94fcd6
- [x] 1.3 Existing repair queries still work — d94fcd6

#### Manual

- [x] 1.4 Verify three new columns in Supabase Studio — d94fcd6
- [x] 1.5 Existing repairs show NULL for new columns — d94fcd6

### Phase 2: Classification Service + Environment Setup

#### Automated

- [x] 2.1 TypeScript compiles with new module — 0c26975
- [x] 2.2 Lint passes — 0c26975

#### Manual

- [x] 2.3 classifyRepair returns correct category for Polish repair descriptions — 0c26975
- [x] 2.4 classifyRepair returns null when API key unset — 0c26975
- [x] 2.5 classifyRepair handles gibberish/edge cases gracefully — 0c26975

### Phase 3: API Integration

#### Automated

- [x] 3.1 TypeScript compiles
- [x] 3.2 Lint passes

#### Manual

- [x] 3.3 POST new repair → category assigned by AI
- [x] 3.4 POST without Gemini key → pending fallback
- [x] 3.5 PUT with changed description (AI source) → re-classified
- [x] 3.6 PUT with changed description (manual source) → unchanged
- [x] 3.7 PATCH category override works

### Phase 4: UI — Category Display + Override

#### Automated

- [ ] 4.1 TypeScript compiles
- [ ] 4.2 Lint passes

#### Manual

- [ ] 4.3 Category badge displays on each repair
- [ ] 4.4 Dropdown override works and saves
- [ ] 4.5 Pending/null states handled gracefully
- [ ] 4.6 Page reload preserves overridden category

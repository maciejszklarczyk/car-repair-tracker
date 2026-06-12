# AI Repair Classification — Plan Brief

> Full plan: `context/changes/ai-classification/plan.md`

## What & Why

Add AI-powered repair classification using Google Gemini 2.5 Flash-Lite. Each repair gets auto-classified into one of six categories (silnik, hamulce, elektryka, ogumienie, przegląd, inne) based on the description text. This is the domain rule that distinguishes the product from a spreadsheet (FR-004) — the user doesn't learn taxonomy, the system does it for them.

## Starting Point

Repairs table exists with full CRUD. No `category` column, no external API integrations, no AI dependencies. Business logic lives as pure functions in `src/lib/`. Env vars use `astro:env/server` pattern.

## Desired End State

Every new repair shows a colored category badge auto-assigned by Gemini. Users override via inline dropdown. If Gemini is down or slow (>3s), repair saves as `pending` and user picks manually. Editing a repair's description re-classifies only if the current category was AI-assigned (manual overrides are respected).

## Key Decisions Made

| Decision               | Choice                                                  | Why (1 sentence)                                                                                   |
| ---------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| AI provider            | Gemini 2.5 Flash-Lite                                   | Best multilingual quality (94% vs 78%), generous free tier (1.5K RPD), designed for classification |
| Data model             | 3 columns: category, category_source, original_category | Tracks origin (ai/manual) and preserves AI's pick for future accuracy measurement                  |
| Classification trigger | Synchronous on create, 3s timeout                       | Single request cycle, no background jobs, matches FR-011 "few seconds"                             |
| Audit trail            | Store original_category                                 | Enables accuracy measurement from day one per PRD open question #4                                 |
| Override UX            | Inline dropdown on repair list item                     | Minimal clicks, consistent with existing edit patterns                                             |
| Re-classify on edit    | Yes, only if category_source is 'ai'                    | Keeps AI category fresh without overriding user's conscious choice                                 |
| Pending state UX       | Badge + manual dropdown (no retry)                      | Consistent UX — one pattern for both override and pending resolution                               |
| Testing                | Unit tests with mocked Gemini + manual E2E              | Fast reliable tests; real API quality verified manually                                            |

## Scope

**In scope:** DB migration (3 columns), Gemini classification service, API integration (create + edit + override), category badge + inline dropdown UI, pending/null state handling

**Out of scope:** Background jobs, retry mechanism, category-based filtering/grouping, cost breakdown by category, batch reclassification of existing repairs, accuracy dashboard

## Architecture / Approach

```
[User adds repair] → POST /api/repairs
  → Zod validation → car ownership check
  → classifyRepair(description) — Gemini call, 3s timeout
  → Insert with category (or "pending" on failure)
  → Redirect to vehicle page

[User overrides] → PATCH /api/repairs/[id]
  → Validate category enum → Update category + source=manual
```

New module `src/lib/classifyRepair.ts` — pure async function, same pattern as `costPerKm.ts` and `serviceReminders.ts`. SDK: `@google/genai`.

## Phases at a Glance

| Phase                     | What it delivers                                        | Key risk                                   |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------ |
| 1. DB Migration + Types   | 3 new nullable columns on repairs, updated TS interface | None — additive migration                  |
| 2. Classification Service | `classifyRepair()` function + env setup                 | Gemini Polish quality unknown until tested |
| 3. API Integration        | Classification on create/edit, PATCH override endpoint  | 3s timeout may cause some pending results  |
| 4. UI: Display + Override | Category badge, inline dropdown, pending state          | New UI pattern (inline dropdown)           |

**Prerequisites:** Gemini API key (free tier, no credit card needed)
**Estimated effort:** ~2-3 sessions across 4 phases

## Open Risks & Assumptions

- Gemini 2.5 Flash-Lite quality for Polish repair descriptions is untested — Phase 2 manual testing will validate
- Free tier rate limits (30 RPM, 1.5K RPD) assumed sufficient for single-user MVP
- 3s timeout may be tight for cold-start Gemini calls — monitor pending rate in practice

## Success Criteria (Summary)

- New repair with Polish description gets correct category badge within seconds
- User can override any category via inline dropdown, override persists across sessions
- App works normally when Gemini is unavailable (pending fallback, manual assignment)

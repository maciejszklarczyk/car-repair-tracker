# Repair History — Browse, Edit & Delete — Plan Brief

> Full plan: `context/changes/repair-history/plan.md`

## What & Why

Replace the static "No repairs yet" placeholder on the vehicle detail page with a live repair history list. Add edit and delete operations so the owner has full control over recorded repairs. This is S-03 — the last data-management slice before cost/km analytics (S-04).

## Starting Point

`repairs` table exists with data but no UPDATE/DELETE RLS policies. Vehicle detail page fetches vehicle data only; the repair section is a static placeholder. No edit or delete API routes exist.

## Desired End State

Vehicle detail page shows all repairs date-descending (date, description, cost, mileage per row). Each row has an "Edit" link (separate page, pre-filled form) and a "Delete" button (shadcn AlertDialog confirmation). After delete the page reloads with the row gone. After edit the user lands back on the vehicle detail with a success banner.

## Key Decisions Made

| Decision             | Choice                                             | Why (1 sentence)                                                                 |
| -------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Edit UX              | Separate page `/dashboard/repairs/[id]/edit`       | Matches add-repair pattern exactly — no modal state management needed.           |
| Delete confirmation  | shadcn AlertDialog in React island                 | Consistent with project UI system; cleaner than native `confirm()`.              |
| Post-delete behavior | `fetch()` + `window.location.reload()`             | Keeps list in sync without optimistic state; consistent with SSR-first approach. |
| List item fields     | Date + description (2-line clamp) + cost + mileage | All meaningful data visible without an extra click.                              |
| Edit scope           | All fields (date, description, cost, mileage)      | Full correction capability; `car_id` FK stays immutable.                         |
| PUT/DELETE response  | JSON (not redirect)                                | These handlers are called via `fetch()`, not form POST.                          |

## Scope

**In scope:**

- RLS policies for UPDATE + DELETE on `repairs`
- `PUT /api/repairs/[id]` and `DELETE /api/repairs/[id]` handlers
- `updateRepairSchema` (same as create, without `car_id`)
- `EditRepairForm.tsx` + `/dashboard/repairs/[id]/edit.astro`
- `RepairList.tsx` React island with AlertDialog delete
- Vehicle detail page wired to fetch + render repairs

**Out of scope:** Cost-per-km aggregation, AI classification, pagination, sort controls, mileage cross-validation.

## Architecture / Approach

SSR Astro page fetches repairs server-side and passes them as props to the `RepairList` React island (needed for AlertDialog interactivity). Edit is a separate SSR page with a React form that calls the PUT API via `fetch()`. Delete is called via `fetch()` from the island, then `window.location.reload()` refreshes the SSR page with the updated list.

## Phases at a Glance

| Phase            | What it delivers                             | Key risk                                                             |
| ---------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 1. RLS Migration | UPDATE + DELETE policies on repairs table    | Must apply before API routes are live                                |
| 2. API Routes    | PUT + DELETE handlers at `/api/repairs/[id]` | Ownership check must reject cross-user requests                      |
| 3. Edit UI       | Pre-filled edit form + edit page             | `EditRepairForm` fetches via JSON — different from form-POST pattern |
| 4. List UI       | RepairList island + vehicle detail wired up  | AlertDialog requires shadcn install first                            |

**Prerequisites:** S-02 merged (done). Local Supabase running.  
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- shadcn AlertDialog install (`npx shadcn@latest add alert-dialog`) must succeed — it's a net-new component not yet in the project.
- S-04 (cost/km) will need to re-query repairs after any delete; no aggregate column is stored today so there's no stale state risk in this slice.
- `line-clamp-2` requires Tailwind's `@tailwindcss/line-clamp` plugin or Tailwind v3.3+ (which includes it by default) — verify in build.

## Success Criteria (Summary)

- Repair list renders on vehicle detail page in date-descending order with all 4 fields.
- Edit updates the DB row and returns user to vehicle detail with success feedback.
- Delete with confirmation removes the row and reloads the list.

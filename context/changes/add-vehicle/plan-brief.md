# Add Vehicle — Plan Brief

> Full plan: `context/changes/add-vehicle/plan.md`

## What & Why

Implement S-01 from the roadmap: an authenticated car owner can add a vehicle (make, model, year, current mileage, baseline mileage) and see it listed on a dedicated vehicles page. This is the first vertical slice and the foundation for all downstream features — the `cars` table schema and RLS policies must be designed once and correctly.

## Starting Point

Auth is fully wired (Supabase SSR, middleware, cookie sessions, signin/signup). The dashboard is a placeholder showing only the user's email and a signout button. No business-logic tables, API endpoints, types, or migrations exist yet. UI has only the `button` shadcn component.

## Desired End State

An authenticated owner sees their vehicles listed at `/dashboard/vehicles`. They can add a new vehicle via a form at `/dashboard/vehicles/new`. Each owner sees only their own cars (RLS-enforced). The old `/dashboard` redirects to the vehicle list. Navigation includes a topbar with "My Vehicles" and signout.

## Key Decisions Made

| Decision              | Choice                                          | Why (1 sentence)                                                                              |
| --------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Primary key strategy  | UUID v4 via `gen_random_uuid()`                 | Consistent with `auth.users`, no sequential leaks in multi-tenant app.                        |
| S-01 scope            | Add + list only (no edit/archive)               | Smallest shippable slice per roadmap; schema includes `archived_at` for future.               |
| Current mileage       | Explicit column on `cars`                       | Owner can update mileage independently of repairs; simpler queries for cost/km and reminders. |
| Form location         | Dedicated page `/dashboard/vehicles/new`        | Clean URL, works without JS, follows auth page pattern.                                       |
| Validation            | Light — required + ranges                       | Year 1900–current, mileage ≥ 0, current ≥ baseline. Catches errors without frustration.       |
| Vehicle list location | `/dashboard/vehicles` (separate from dashboard) | Clean separation; dashboard can become an overview in S-04.                                   |
| Form submission       | HTML POST + redirect                            | Matches existing auth form pattern; progressive enhancement.                                  |
| Testing               | Manual CRUD verification                        | Per roadmap risk note; no test framework setup for first slice.                               |

## Scope

**In scope:** `cars` table + RLS, POST API endpoint, zod validation, vehicle list page, add vehicle form, dashboard redirect, topbar navigation

**Out of scope:** Edit vehicle, archive vehicle, delete vehicle, vehicle detail page, repairs, automated tests

## Architecture / Approach

Bottom-up: DB migration → shared types + zod schema → API endpoint → Astro pages + React form island → navigation wiring. Each phase is independently verifiable. The form follows the existing HTML POST + redirect pattern.

## Phases at a Glance

| Phase                       | What it delivers                               | Key risk                            |
| --------------------------- | ---------------------------------------------- | ----------------------------------- |
| 1. Database Migration + RLS | `cars` table with per-owner isolation          | Schema mistake propagates to S-02+  |
| 2. Types + Zod + API        | Vehicle creation endpoint with validation      | Zod ↔ DB column mismatch            |
| 3. Vehicle List Page        | `/dashboard/vehicles` with empty state         | None significant                    |
| 4. Add Vehicle Form         | React form island at `/dashboard/vehicles/new` | Client/server validation divergence |
| 5. Navigation + Polish      | Dashboard redirect, topbar, end-to-end flow    | None significant                    |

**Prerequisites:** Local Supabase running (`npx supabase start`)
**Estimated effort:** ~2 sessions across 5 phases

## Open Risks & Assumptions

- Schema designed for downstream slices (S-02 repairs FK, S-06 reminders) — but not tested against those until they're implemented
- `archived_at` column included but unused in S-01 — must be filtered in list queries from the start
- No zod dependency in `package.json` yet — must be installed in Phase 2

## Success Criteria (Summary)

- Owner can add a vehicle and see it on their list within one session
- A second account cannot see the first owner's vehicles (RLS isolation)
- Full flow works: sign in → vehicle list → add vehicle → see it listed → sign out

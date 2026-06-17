# Demo Data Seeder Implementation Plan

## Overview

Build a one-click demo entry flow where each visitor gets a temporary Supabase account pre-seeded with realistic data (two cars, repairs across all categories, service thresholds with active reminders). Visitors click "Try Demo" on the landing page, land on the dashboard with data ready, and stale accounts are cleaned up daily via GitHub Actions.

## Current State Analysis

- Auth is cookie-based via `@supabase/ssr` — `signInWithPassword()` sets session cookies automatically
- Only anon key exists (`SUPABASE_KEY`); no service_role client in the codebase
- All tables (`cars`, `repairs`, `service_thresholds`) have RLS policies scoped to `auth.uid() = user_id`
- `supabase/seed.sql` has realistic test data structure (1 car, 7 repairs, 2 thresholds) — good reference for seed content
- Landing page (`src/components/Welcome.astro`) has Sign In / Sign Up buttons in a flex row
- CI workflow (`.github/workflows/ci.yml`) already has `SUPABASE_URL`, `SUPABASE_KEY`, and `SUPABASE_PROJECT_REF` secrets

### Key Discoveries:

- Supabase Admin API (`supabase.auth.admin.createUser()`) requires `service_role` key — this is a new env var for the project
- The admin client can create users with `email_confirm: true` (skipping confirmation) and generate a session in one call
- RLS naturally isolates temp user data — no risk of cross-user contamination when seeding via admin client
- `createServerClient` from `@supabase/ssr` needs the anon key for cookie-based sessions; the admin client is a separate `createClient` from `@supabase/supabase-js` (not SSR) used only server-side for user creation

## Desired End State

A "Try Demo" button on the landing page creates a temporary user, seeds two cars with varied repairs and service thresholds, auto-logs the visitor in, and redirects to the dashboard. Each visitor sees a clean, isolated dataset. A daily GitHub Actions workflow deletes temp accounts older than 24 hours. Temp users are identified by email domain `demo.cartracker.local`.

### Verification:

- Click "Try Demo" → land on `/dashboard/vehicles` with 2 cars visible
- Car 1 (Skoda Octavia) has ~8 repairs across all 6 categories, cost/km chart visible, one overdue reminder
- Car 2 (VW Golf) has 0 repairs — shows empty state
- Visitor can interact freely (add/edit/delete)
- Another visitor clicking "Try Demo" simultaneously gets their own isolated data
- GitHub Actions cleanup workflow runs daily and removes accounts older than 24h

## What We're NOT Doing

- Periodic cron reset of a shared demo user (replaced by per-visitor isolation)
- Per-visitor session timeout or auto-logout
- Rate limiting on demo creation (portfolio-scale traffic)
- Supabase Edge Functions (keeping all logic in the Astro app)
- Demo banner or separate demo page — just a third button on existing landing
- Graceful session expiry for demo users — cleanup at 3 AM UTC makes this near-zero risk at portfolio traffic

## Implementation Approach

The demo flow is a single POST endpoint (`/api/demo`) that orchestrates: create temp user via admin API → seed data via admin client (bypasses RLS to insert with the new user's ID) → sign in the visitor via anon client (sets session cookies) → redirect to dashboard. Cleanup is a standalone GitHub Actions workflow using the Supabase Management API.

## Phase 1: Service Role Client + Env Setup

### Overview

Add `SUPABASE_SERVICE_ROLE_KEY` to the Astro env schema and create an admin client helper. This is the foundation for server-side user creation.

### Changes Required:

#### 1. Astro env schema

**File**: `astro.config.mjs`

**Intent**: Add `SUPABASE_SERVICE_ROLE_KEY` as an optional server-only secret, following the existing pattern for `SUPABASE_KEY`.

**Contract**: New entry in `env.schema` — `SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret", optional: true })`.

#### 2. Admin client helper

**File**: `src/lib/supabase-admin.ts` (new)

**Intent**: Create a Supabase admin client using `createClient` from `@supabase/supabase-js` (not the SSR variant) with the service_role key. This client bypasses RLS and can call `auth.admin.*` methods.

**Contract**: Export `createAdminClient()` returning `SupabaseClient | null`. Returns `null` when `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing. Uses `{ auth: { autoRefreshToken: false, persistSession: false } }` options since this is a server-only client with no cookie persistence.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Existing tests pass: `npm run test`
- Build succeeds: `npm run build`

#### Manual Verification:

- Admin client returns non-null when env vars are set locally (verify in dev console or a quick test route)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Demo API Endpoint + Seed Data

### Overview

Create the POST `/api/demo` endpoint that creates a temp user, seeds two cars with repairs and thresholds, signs the visitor in, and redirects to the dashboard.

### Changes Required:

#### 1. Seed data module

**File**: `src/lib/demo-seed.ts` (new)

**Intent**: Define the seed dataset as a function that takes a `userId` and returns structured insert payloads for cars, repairs, and service_thresholds. Keeps seed data co-located and testable.

**Contract**: Export `async function seedDemoData(adminClient: SupabaseClient, userId: string): Promise<void>`. Inserts:

- **Car 1**: Skoda Octavia 2018, baseline 120000 km. ~8 repairs spanning 2024-03 to 2025-08, covering all 6 categories (silnik, hamulce, elektryka, ogumienie, przegląd, inne), one repair with `cost: null` (warranty), categories pre-set with `category_source: "ai"`. Mileages increasing from 120500 to 136200. 2 service thresholds: "Oil Change" (10000 km interval, last at 130500 — approaching) and "Przegląd techniczny" (365 days interval, last performed 13 months ago — overdue).
- **Car 2**: VW Golf VII 2015, baseline 85000 km. Zero repairs, zero thresholds — demonstrates empty state UI.

Uses `gen_random_uuid()` for IDs (via admin client insert, Supabase generates UUIDs server-side). All inserts use the admin client which bypasses RLS — safe because we're inserting with the correct `user_id`.

#### 2. Demo API endpoint

**File**: `src/pages/api/demo.ts` (new)

**Intent**: One-click demo entry. Creates temp user → seeds data → signs in → redirects. Handles errors gracefully (rolls back user on seed failure).

**Contract**: Export `POST` handler. Flow:
1. Get admin client via `createAdminClient()` — return 500 if unavailable
2. Generate temp email: `demo-${Date.now()}@demo.cartracker.local`
3. Generate random password (crypto.randomUUID)
4. Call `adminClient.auth.admin.createUser({ email, password, email_confirm: true })` — creates user without email verification
5. Call `seedDemoData(adminClient, user.id)` — seed both cars with repairs/thresholds
6. Create anon client via `createClient(request.headers, cookies)` — if null, treat as error (delete created user, redirect with error). Call `signInWithPassword({ email, password })` — this sets session cookies on the response
7. Redirect to `/dashboard/vehicles`
8. On any error: if user was created, call `adminClient.auth.admin.deleteUser(user.id)` to clean up, then redirect to `/?error=demo_failed`

`export const prerender = false` at top.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Existing tests pass: `npm run test`
- Build succeeds: `npm run build`

#### Manual Verification:

- POST to `/api/demo` creates a temp user, seeds data, and redirects to dashboard
- Dashboard shows 2 cars: Skoda Octavia with repairs/chart/reminders, VW Golf empty
- Vehicle detail page for Skoda shows cost/km, repair list with all categories, chart with trend
- Service reminders section shows approaching/overdue thresholds
- A second demo click (in incognito) creates a separate user with separate data

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Landing Page "Try Demo" Button

### Overview

Add a "Try Demo" button to the landing page that submits a POST to `/api/demo`.

### Changes Required:

#### 1. Landing page button

**File**: `src/components/Welcome.astro`

**Intent**: Add a third CTA button ("Try Demo") in the existing flex row alongside Sign In and Sign Up. Uses a form with POST action to `/api/demo` (no JS needed — standard form submission triggers the redirect chain).

**Contract**: New `<form method="POST" action="/api/demo">` with a `<button>` styled as an outline variant distinct from Sign In (primary) and Sign Up (outline). Position: after Sign Up in the flex row. Style: green-tinted or distinct accent to differentiate from auth buttons (e.g. `border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10`).

#### 2. Error display on landing page

**File**: `src/pages/index.astro`

**Intent**: Show an error toast/message when redirected back with `?error=demo_failed`, so the visitor knows something went wrong.

**Contract**: Read `Astro.url.searchParams.get("error")` in frontmatter. If `"demo_failed"`, render a dismissible error message above the Welcome component.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Landing page shows three buttons: Sign In, Sign Up, Try Demo
- Clicking "Try Demo" → redirects to dashboard with seeded data
- Buttons are visually distinct and responsive on mobile
- Error state displays when demo creation fails (test by temporarily removing service_role key)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: GitHub Actions Cleanup Workflow

### Overview

Add a scheduled GitHub Actions workflow that deletes demo accounts older than 24 hours using the Supabase Management API.

### Changes Required:

#### 1. Cleanup workflow

**File**: `.github/workflows/demo-cleanup.yml` (new)

**Intent**: Daily cron job that lists all users matching the demo email domain and deletes those created more than 24 hours ago. Deleting the auth user cascades to `cars`, `repairs`, and `service_thresholds` via their `user_id → auth.users(id) ON DELETE CASCADE` FKs.

**Contract**: Workflow with `schedule: cron: '0 3 * * *'` (daily at 3 AM UTC) plus `workflow_dispatch` for manual trigger. Single job using `node:22` that:
1. Installs `@supabase/supabase-js`
2. Creates admin client with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` secrets
3. Lists users via `auth.admin.listUsers()` with pagination
4. Filters by email matching `@demo.cartracker.local` and `created_at` older than 24h
5. Deletes each matching user via `auth.admin.deleteUser(id)` — cascade handles app data
6. Logs count of deleted users

Requires adding `SUPABASE_SERVICE_ROLE_KEY` as a GitHub repository secret.

### Success Criteria:

#### Automated Verification:

- Workflow YAML is valid (check with `actionlint` if available, or `gh workflow list` after push)
- Existing CI workflow unaffected

#### Manual Verification:

- Trigger workflow manually via `gh workflow run demo-cleanup.yml`
- Verify it lists and deletes stale demo accounts (check Supabase dashboard)
- Verify real user accounts are untouched

**Implementation Note**: After completing this phase, the `SUPABASE_SERVICE_ROLE_KEY` secret must be added to the GitHub repository settings and to the production Docker environment before the feature is fully operational.

---

## Testing Strategy

### Unit Tests:

- `seedDemoData` with a mock Supabase client — verify correct insert payloads (2 cars, ~8 repairs, 2+ thresholds, correct user_id)
- Demo email generation follows `demo-{timestamp}@demo.cartracker.local` pattern

### Integration Tests:

- None required — the demo flow is end-to-end by nature; unit tests on seed data + manual verification cover the critical paths

### Manual Testing Steps:

1. Click "Try Demo" on landing page → verify redirect to dashboard with 2 cars
2. Open Skoda Octavia → verify repairs list, cost/km, chart, reminders
3. Open VW Golf → verify empty state
4. Add a repair to demo account → verify it works normally
5. Open incognito → click "Try Demo" again → verify separate isolated data
6. Check Supabase dashboard → verify temp users visible with demo email domain
7. Trigger cleanup workflow → verify stale demo users deleted

## Performance Considerations

- Demo creation involves 1 user create + ~12 DB inserts (2 cars + 8 repairs + 2 thresholds). Expected latency: <2 seconds on Supabase free tier.
- Cleanup workflow paginates user listing to handle growth (default page size 50, loop until exhausted).
- No index changes needed — cascade delete on FK handles cleanup efficiently.

## Migration Notes

No database migrations required. All tables already exist with the correct schema. The demo flow uses existing tables and relies on Supabase's `auth.admin` API for user management.

### Production deployment checklist:

1. Add `SUPABASE_SERVICE_ROLE_KEY` to production `.env` (Docker)
2. Add `SUPABASE_SERVICE_ROLE_KEY` to GitHub repository secrets
3. Rebuild and deploy Docker image
4. Verify "Try Demo" button works on production

## References

- Frame brief: `context/changes/demo-data-seeder/frame.md`
- Existing seed data pattern: `supabase/seed.sql`
- Auth flow: `src/lib/supabase.ts`, `src/middleware.ts`
- Landing page: `src/components/Welcome.astro`
- CI workflow: `.github/workflows/ci.yml`
- Supabase Admin API: `@supabase/supabase-js` — `createClient(url, serviceRoleKey)`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Service Role Client + Env Setup

#### Automated

- [x] 1.1 Type checking passes: `npx astro check` — b8f6eba
- [x] 1.2 Linting passes: `npm run lint` — b8f6eba
- [x] 1.3 Existing tests pass: `npm run test` — b8f6eba
- [x] 1.4 Build succeeds: `npm run build` — b8f6eba

#### Manual

- [x] 1.5 Admin client returns non-null when env vars are set locally — b8f6eba

### Phase 2: Demo API Endpoint + Seed Data

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — 5af169f
- [x] 2.2 Linting passes: `npm run lint` — 5af169f
- [x] 2.3 Existing tests pass: `npm run test` — 5af169f
- [x] 2.4 Build succeeds: `npm run build` — 5af169f

#### Manual

- [x] 2.5 POST to /api/demo creates temp user, seeds data, redirects to dashboard — 5af169f
- [x] 2.6 Dashboard shows 2 cars with correct data — 5af169f
- [x] 2.7 Second demo click creates separate isolated data — 5af169f

### Phase 3: Landing Page "Try Demo" Button

#### Automated

- [x] 3.1 Type checking passes: `npx astro check` — 5d7dec3
- [x] 3.2 Linting passes: `npm run lint` — 5d7dec3
- [x] 3.3 Build succeeds: `npm run build` — 5d7dec3

#### Manual

- [x] 3.4 Landing page shows three distinct buttons — 5d7dec3
- [x] 3.5 Try Demo click → dashboard with seeded data — 5d7dec3
- [x] 3.6 Buttons responsive on mobile — 5d7dec3

### Phase 4: GitHub Actions Cleanup Workflow

#### Automated

- [x] 4.1 Workflow YAML valid — 5139f57
- [x] 4.2 Existing CI unaffected — 5139f57

#### Manual

- [x] 4.3 Manual workflow trigger deletes stale demo accounts — 5139f57
- [x] 4.4 Real user accounts untouched — 5139f57

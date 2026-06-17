# Demo Data Seeder — Plan Brief

> Full plan: `context/changes/demo-data-seeder/plan.md`
> Frame brief: `context/changes/demo-data-seeder/frame.md`

## What & Why

Build a one-click demo entry flow with per-visitor temporary accounts, each seeded with realistic data, providing full isolation between concurrent visitors. The original framing assumed a shared demo user with periodic cron reset — the reframe drops that in favor of event-driven, per-visitor isolation so every visitor sees a clean dataset.

## Starting Point

No demo/guest logic exists in the codebase. Auth is cookie-based via `@supabase/ssr` with anon key only — no service_role client. All tables have RLS scoped to `auth.uid() = user_id`. Existing `seed.sql` has realistic test data (1 car, 7 repairs, 2 thresholds) that serves as a reference for seed content.

## Desired End State

Visitors click "Try Demo" on the landing page → a temp Supabase user is created via admin API, seeded with 2 cars (one with ~8 repairs across all categories + service reminders, one empty), auto-logged in, and redirected to the dashboard. A daily GitHub Actions workflow cleans up temp accounts older than 24 hours.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Reset granularity | Per-visitor on demo click | No dirty windows — every visitor sees clean state | Frame |
| Isolation strategy | Per-visitor temp accounts | Concurrent visitors never interfere; RLS provides natural isolation | Frame |
| User creation mechanism | Server-side API with service_role key | All logic in one request — user lands on dashboard with data ready | Plan |
| Temp user identification | Email domain convention (`@demo.cartracker.local`) | Simple query for cleanup, no schema changes, visible in dashboard | Plan |
| Seed data shape | Two cars, varied edge cases | Covers all UI states: full car with chart/reminders + empty car | Plan |
| Cleanup mechanism | GitHub Actions daily cron | No new infra — CI already set up; runs outside app process | Plan |
| Landing page UX | Third button alongside Sign In / Sign Up | Minimal UI change, visitors see demo option immediately | Plan |

## Scope

**In scope:**
- `SUPABASE_SERVICE_ROLE_KEY` env var + admin client helper
- POST `/api/demo` endpoint (create user → seed → sign in → redirect)
- Seed data: 2 cars, ~8 repairs (all categories, one null cost), 2 service thresholds
- "Try Demo" button on landing page
- GitHub Actions cleanup workflow (daily, deletes accounts >24h old)

**Out of scope:**
- Periodic cron reset of shared demo user
- Rate limiting on demo creation
- Per-visitor session timeout / auto-logout
- Supabase Edge Functions

## Architecture / Approach

Single POST endpoint (`/api/demo`) orchestrates the full flow: admin client creates temp user → seeds data via admin client (bypasses RLS) → anon client signs in (sets session cookies) → redirect. Cleanup is a standalone GitHub Actions workflow using the same admin API. RLS isolates each temp user's data by design.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Service role client + env setup | Admin client helper + env var | New secret to manage across environments |
| 2. Demo API endpoint + seed data | Working demo flow end-to-end | Seed data must cover all UI edge cases without being brittle |
| 3. Landing page button | Visitor-facing "Try Demo" CTA | Three CTAs may dilute sign-up (acceptable for portfolio) |
| 4. GitHub Actions cleanup | Automated stale account removal | Cleanup must never touch non-demo users |

**Prerequisites:** `SUPABASE_SERVICE_ROLE_KEY` available (from Supabase dashboard → Settings → API)
**Estimated effort:** ~2 sessions across 4 phases

## Open Risks & Assumptions

- Service role key in production Docker env must be added manually before deploy
- Cleanup only removes users >24h old — short-lived demo accounts accumulate during high-traffic days (acceptable at portfolio scale)
- `auth.admin.listUsers()` paginates at 50 per page — cleanup must loop for large backlogs

## Success Criteria (Summary)

- Clicking "Try Demo" lands visitor on dashboard with 2 cars and realistic data in <2 seconds
- Concurrent demo visitors see fully isolated data
- Daily cleanup removes stale demo accounts without affecting real users

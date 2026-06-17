# Frame Brief: Demo Data Seeder

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Product needs a way to be showcased with realistic data to a public audience without manual seeding. Visitors interact with the demo and modify/delete data, making it dirty over time.

## Initial Framing (preserved)

- **User's stated cause or approach**: Build a periodic reset mechanism (cron/GitHub Actions/pg_cron) that wipes and re-seeds data for a dedicated demo user on a schedule
- **User's proposed direction**: Implement S-10 as described in roadmap — hardcoded demo user, realistic seed data, periodic reset cycle
- **Pre-dispatch narrowing**: Public demo link where visitors modify/delete data; one-click demo button for access (no manual credential entry)

## Dimension Map

The observation could originate at any of these dimensions:

1. **Reset granularity** — periodic (cron) vs event-driven (on demo login) vs per-visitor isolation
2. **Isolation strategy** — shared demo user on production DB vs per-visitor temp accounts vs separate instance
3. **Safety model** — service_role key bypassing RLS vs anon-scoped operations vs RLS-safe SQL  ← initial framing's risk concern
4. **Seed mechanism** — raw SQL vs API calls vs Supabase Edge Function

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Periodic reset is the right granularity | Roadmap S-10 assumes cron schedule. But public demo with CRUD access means data dirty between resets — visitor at 10am deletes all cars, demo broken until next reset. User confirmed this is "acceptable" but was intrigued by always-clean alternative. | WEAK |
| Event-driven reset (on demo login) is better fit | No demo login mechanism exists yet (middleware.ts:1-29, no guest mode). One-click demo button is the desired UX. Coupling reset to login event means every visitor sees clean state. Concurrent visitor collision unlikely at portfolio scale. | STRONG |
| Safety risk is overstated in original framing | RLS policies on all 3 tables enforce `auth.uid() = user_id` (migrations 20260526, 20260531, 20260608). API routes add belt-and-suspenders ownership checks. The "wrong user_id wipes real data" risk only exists if seed script uses service_role key bypassing RLS. Through anon client, RLS prevents cross-user damage by design. | STRONG |
| Separate instance eliminates all risk | docker-compose.prod.yml:1-34 shows single production deployment on `car-repair-tracker.msolve.it`. No staging env. Standing up a second instance adds infra complexity disproportionate to portfolio project scale. | NONE |

## Narrowing Signals

- User confirmed public demo with visitors who modify/delete data — periodic reset leaves dirty windows
- User chose one-click demo button UX — this is a natural trigger point for reset
- User expressed interest in "always looks good" approach when presented with the tradeoff
- Portfolio-scale project — concurrent demo visitors unlikely, simplifying isolation constraints

## Cross-System Convention

Public demo apps at portfolio scale typically use one of two patterns: (a) shared demo credentials with periodic reset (simple, accepts dirty windows), or (b) reset-on-demo-entry (always clean, slightly more complex). Pattern (b) is standard for product demos where first impression matters. Per-visitor isolation is the production-grade answer but overengineered for this scale.

The leading hypothesis (event-driven reset on demo login) matches convention (b) and fits the user's stated preference for clean state + one-click button UX.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Build a one-click demo entry flow with per-visitor temporary accounts, each seeded with realistic data, providing full isolation between concurrent visitors.

The original framing assumed a shared demo user with periodic cron reset. The reframe has two layers: (1) event-driven over periodic — no dirty windows, no scheduling infrastructure; (2) per-visitor isolation over shared account — concurrent visitors never interfere with each other. Each demo click creates a temporary Supabase user, seeds their data, and logs them in. A cleanup mechanism removes stale temp accounts periodically. RLS naturally isolates each temp user's data.

## Confidence

- **HIGH** — strong evidence that shared-user + cron is the wrong granularity; per-visitor isolation is the production-grade answer and user explicitly chose it despite complexity tradeoff

## What Changes for /10x-plan

Plan should focus on: (1) temp user creation flow (Supabase admin API or Edge Function), (2) one-click demo button on landing page that creates temp user + seeds data + auto-logs in, (3) seed data covering UI edge cases (car without repairs, repair without cost, active reminder), (4) periodic cleanup of stale temp accounts (the only scheduled component), (5) identifying temp users (naming convention, metadata flag, or dedicated email domain). Periodic reset of a single demo user drops out of scope entirely.

## References

- Auth middleware: `src/middleware.ts:1-29`
- RLS policies: `supabase/migrations/20260526120000_create_cars_table.sql:16-22`, `20260531120000_create_repairs_table.sql:15-26`, `20260608120000_create_service_thresholds_table.sql:19-36`
- Existing seed data: `supabase/seed.sql:1-141`
- Landing page: `src/components/Welcome.astro`
- Deployment: `docker-compose.prod.yml:1-34`
- GitHub issue: #37

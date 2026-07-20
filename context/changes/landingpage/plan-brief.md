# Project Landing Page — Plan Brief

> Full plan: `context/changes/landingpage/plan.md`
> Research: `context/changes/landingpage/research.md`

## What & Why

Replace the stock 10x Astro Starter landing page (`Welcome.astro` — generic hero, unrelated feature cards, stale "Astro 5" reference) with a real Car Repair Tracker landing page: a hero with an actual description of the product, working CTAs, and highlights of what the app actually does.

## Starting Point

`/` currently renders `<Welcome />` for logged-out visitors — 100% starter-template content, disconnected from the app. The three CTAs it wires up (Sign In, Sign Up, Try Demo → `POST /api/demo`) are real and functional and must be preserved. Logged-in visitors are already redirected to `/dashboard/vehicles` before render — that logic is untouched.

## Desired End State

Visiting `/` logged out shows a project-branded hero (name, one-sentence description, CTAs), a 4-card feature grid (vehicle & repair tracking, AI classification, cost/km dashboard, service reminders), and a lighter secondary strip (archive-not-delete, demo mode). Copy is English. Logged-in redirect and the `?error=demo_failed` banner still work exactly as before.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Copy language | English | User chose English now; Polish/i18n deferred to a tracked follow-up issue since in-app category labels are already Polish. | Plan |
| Component structure | New dedicated landing components (Hero, FeatureGrid, SecondaryFeatures) | Modular, matches "Astro components for static content" convention; easier to iterate per section. | Plan |
| Header/nav for logged-out visitors | None — CTAs only in hero | Topbar is auth-gated by design; user chose not to extend it or duplicate it, keeping blast radius zero. | Plan |
| Feature depth | 4 headline features + 2 secondary mentions | Keeps page scannable while surfacing the strongest differentiators (AI classification, cost/km). | Plan |
| Sign Up vs Demo prominence | Sign Up primary, Demo secondary | Standard SaaS CTA pattern — drives account creation directly. | Plan |
| Deferred i18n tracking | File a GitHub issue (English body, per lessons.md) | Captures the Polish-copy gap as tracked work instead of silently dropping it. | Plan |

## Scope

**In scope:**
- New `Hero.astro`, `FeatureGrid.astro`, `SecondaryFeatures.astro` under `src/components/landing/`
- Wiring `index.astro` to the new components
- Fixing `Layout.astro`'s stale default `title`
- Removing `Welcome.astro`
- Filing a follow-up GitHub issue for future Polish/i18n landing copy

**Out of scope:**
- Polish or bilingual copy (this pass is English-only)
- Any shared header/nav for logged-out pages
- Changes to `Topbar.astro`, auth pages, dashboard routes, or `/api/demo`
- New brand assets (`banner.svg` not used this pass)
- i18n infrastructure / language switcher

## Architecture / Approach

Three static `.astro` components (no React islands — no interactivity needed), reusing the existing `bg-cosmic` Tailwind utility and glass-card visual language already present in the current starter page, plus the shadcn `Button` component for CTAs instead of hand-rolled markup. Wired into `index.astro` in place of `<Welcome />`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Landing page components | `Hero`, `FeatureGrid`, `SecondaryFeatures` built and self-verified | Feature copy drifting from actual app behavior |
| 2. Wire into index.astro | New components live on `/`, stale `Layout` title fixed | Breaking the redirect or `?error=demo_failed` banner logic |
| 3. Cleanup | `Welcome.astro` removed, full verification pass | Stray references left behind |
| 4. Follow-up issue | GitHub issue tracking future PL/i18n landing copy | None — informational only |

**Prerequisites:** None — no upstream dependencies, no data model changes.
**Estimated effort:** ~1 session, 4 phases (mostly presentational).

## Open Risks & Assumptions

- Assumes `bg-cosmic` + glass-card visual language should carry over unchanged (only copy/content changes, not visual redesign) — flag if a visual refresh was actually wanted.
- Phase 4 performs a GitHub-visible action (`gh issue create`) — requires explicit confirmation before running per this project's action-safety norms.

## Success Criteria (Summary)

- `/` shows real Car Repair Tracker content (not starter boilerplate) to logged-out visitors
- All three CTAs (Sign Up, Sign In, Try Demo) work exactly as before
- Existing redirect and error-banner behavior unchanged
- Build, lint, and test suite stay green throughout

# Project Landing Page Implementation Plan

## Overview

Replace the stock 10x Astro Starter landing page (`src/components/Welcome.astro`, generic hero + 3 unrelated feature cards, stale "Astro 5" reference) with project-specific landing content for Car Repair Tracker: a hero with real description and CTAs, a headline-feature grid, and a secondary-features strip. English copy. File a follow-up GitHub issue for future Polish-language landing copy (deferred, out of scope here).

## Current State Analysis

`src/pages/index.astro` renders `<Layout><Welcome /></Layout>` for logged-out visitors (logged-in visitors are redirected to `/dashboard/vehicles` before render). `Layout.astro` only wraps content in `Topbar` + `bg-cosmic` background when `Astro.locals.user` is set — for logged-out visitors (the landing page's actual audience) `Layout` renders just the bare `<slot />`, so `Welcome.astro` supplies its own `bg-cosmic` wrapper and full page chrome. Any replacement must do the same (no shared header exists for logged-out pages by design — confirmed via user decision below).

`Welcome.astro` (129 lines) is entirely generic: "10x Astro Starter" headline, generic tagline, 3 feature cards about auth/stack/DX (none project-related, one stale — says "Astro 5"), and 3 working CTAs: `Sign In` → `/auth/signin`, `Sign Up` → `/auth/signup`, `Try Demo` → `POST /api/demo` (form submit). These three CTA targets are correct and must be preserved.

## Desired End State

Visiting `/` while logged out shows: a hero with the project name, a one-sentence description of what Car Repair Tracker does, and the three CTAs (Sign Up primary, Sign In + Try Demo secondary) — followed by a 4-card feature grid (vehicle & repair tracking, AI repair classification, cost/km dashboard with trend charts, service reminders) and a lighter secondary strip mentioning archive-not-delete and one-click demo mode. Verify by running `npm run dev` and viewing `/` logged out; `npm run build` and `npm run lint` pass; logged-in redirect and `?error=demo_failed` banner still work.

### Key Discoveries:

- `src/pages/index.astro` — redirect-if-logged-in + `Welcome` render, unaffected by this change
- `src/layouts/Layout.astro:11` — default `title` prop is `"10x Astro Starter"`, should become a project-accurate default
- `src/layouts/Layout.astro` — no header/nav rendered when `Astro.locals.user` is unset; confirmed intentional per user decision (no header, CTAs only in hero/body)
- `src/styles/global.css:113` — `@utility bg-cosmic` defines the dark gradient background Welcome.astro uses; reuse this utility class for the new hero wrapper
- `src/components/ui/button.tsx` — shadcn `Button` component (cva variants: default/outline/secondary/ghost/link, sizes incl. `lg`) available and should be used for CTAs instead of hand-rolled `<a>`/`<button>` markup
- `src/lib/repairCategories.ts`, `src/lib/classifyRepair.ts`, `src/lib/costPerKm.ts`, `src/lib/serviceReminders.ts` — source of truth for feature copy accuracy (see `research.md` for full feature-to-code mapping)

## What We're NOT Doing

- No Polish or bilingual copy (English only this pass) — a GitHub issue tracks this as future work (Phase 4)
- No shared/reusable header or nav component for logged-out pages — CTAs live only in the hero, per user decision
- No changes to `Topbar.astro`, auth pages, or any dashboard route
- No changes to `/api/demo` or any backend logic — CTA targets are reused as-is
- No new brand assets — `banner.svg` is not required for this pass; using text-based hero (revisit later if desired)
- No i18n/language-switch infrastructure

## Implementation Approach

Build three new Astro components matching the "Astro components for static content" convention (CLAUDE.md), each owning one section of the page, using shadcn `Button` for CTAs and `cn()` for any conditional classes. Reuse the existing `bg-cosmic` utility and the visual language (dark gradient, blurred orbs, glass cards) already established in `Welcome.astro` so the page doesn't look like an unrelated redesign — only the copy and feature content change. Wire the new components into `index.astro` in place of `<Welcome />`, delete `Welcome.astro`, fix the stale `Layout.astro` default title, then verify build/lint/typecheck. Finish with a follow-up GitHub issue for the deferred i18n work.

## Phase 1: Landing page components

### Overview

Create the three section components that together form the new landing page body.

### Changes Required:

#### 1. Hero section

**File**: `src/components/landing/Hero.astro`

**Intent**: Project headline, one-sentence description of what Car Repair Tracker does (track repairs, know cost/km, never miss a service), and the three CTAs. Reuses the `bg-cosmic` background + orb/star-field decoration currently in `Welcome.astro` so visual identity carries over.

**Contract**: Renders three CTAs matching existing targets — Sign Up (`href="/auth/signup"`) as primary (`Button` `variant="default"` `size="lg"`), Sign In (`href="/auth/signin"`) as secondary (`Button` `variant="outline"` `asChild`), and Try Demo (`<form method="POST" action="/api/demo">` wrapping a `Button` `variant="ghost"` or `variant="outline"` with `type="submit"`) — Sign Up visually primary, the other two secondary per the confirmed CTA priority.

#### 2. Headline feature grid

**File**: `src/components/landing/FeatureGrid.astro`

**Intent**: 4 feature cards for the differentiating capabilities: vehicle & repair tracking, AI-powered repair classification, cost/km dashboard with trend charts, service reminders. Copy grounded in `research.md`'s feature descriptions (e.g. AI classification: "Repairs are automatically categorized — engine, brakes, electrical, tires, inspection, or other — using Google Gemini, with manual override always available").

**Contract**: A `props`-free static Astro component, 4-item grid (`grid-cols-1 sm:grid-cols-2` matching existing glass-card style: `rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl`), one heading + one description paragraph per card, no icons required (reuse the existing inline-SVG icon pattern only if a natural icon exists per feature — optional, not load-bearing).

#### 3. Secondary features strip

**File**: `src/components/landing/SecondaryFeatures.astro`

**Intent**: Lighter-weight mention of the two secondary features: archive-not-delete (vehicles can be archived instead of permanently deleted) and one-click demo mode (already surfaced as a CTA, so this is a one-line reinforcement, not a duplicate card).

**Contract**: Simple text row/list below `FeatureGrid`, not full cards — visually subordinate to the 4 headline features.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `npx astro check` (or project's `astro check` step in lint)
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- All 3 new components render without console errors in dev mode
- Feature copy is factually accurate against current app behavior (no invented features)

**Implementation Note**: Pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Wire into index.astro and fix stale defaults

### Overview

Swap `Welcome` for the new components on the actual route, and correct the one stale default this change touches.

### Changes Required:

#### 1. Landing route

**File**: `src/pages/index.astro`

**Intent**: Replace the `<Welcome />` import/usage with `<Hero />`, `<FeatureGrid />`, `<SecondaryFeatures />` in sequence, inside the same `<Layout>` wrapper. Existing redirect-if-logged-in and `?error=demo_failed` banner logic stay untouched.

**Contract**: Import paths change from `@/components/Welcome.astro` to the three new `@/components/landing/*.astro` files; render order Hero → FeatureGrid → SecondaryFeatures.

#### 2. Layout default title

**File**: `src/layouts/Layout.astro`

**Intent**: Replace the stale `"10x Astro Starter"` default `title` prop value with a project-accurate default so any page that doesn't pass an explicit `title` (including the new landing page, unless it passes one explicitly) shows correct branding.

**Contract**: Default value of the `title` destructured prop (line 11) changes to a Car Repair Tracker–branded string; `index.astro` may optionally pass an explicit `title` prop to `<Layout>` for landing-page-specific SEO copy.

### Success Criteria:

#### Automated Verification:

- Build succeeds: `npm run build`
- Lint passes: `npm run lint`
- Unit tests still pass: `npm run test`

#### Manual Verification:

- Visiting `/` while logged out shows the new hero + feature grid + secondary strip, not the old starter page
- Visiting `/` while logged in still redirects to `/dashboard/vehicles`
- Visiting `/?error=demo_failed` still shows the error banner above the new hero
- Sign Up, Sign In, and Try Demo buttons navigate/submit to the correct existing targets
- Page `<title>` in browser tab reflects the new default (or explicit landing title)

**Implementation Note**: Pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Cleanup

### Overview

Remove the now-unused starter component and do a final verification pass.

### Changes Required:

#### 1. Remove unused component

**File**: `src/components/Welcome.astro`

**Intent**: Delete the file — it is no longer imported anywhere after Phase 2.

**Contract**: File removal; no other file should reference `@/components/Welcome.astro` after this (verify via grep before deleting).

### Success Criteria:

#### Automated Verification:

- No remaining references: `grep -r "Welcome" src/` returns nothing (excluding unrelated matches, if any)
- Full build passes: `npm run build`
- Full lint passes: `npm run lint`
- Full test suite passes: `npm run test`

#### Manual Verification:

- Final visual pass of `/` in a browser confirms the page looks intentional and complete (no layout gaps, no leftover starter styling artifacts)

**Implementation Note**: Pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: File follow-up issue for Polish-language landing copy

### Overview

Per user decision, this change ships English-only copy; capture the Polish/i18n gap as tracked follow-up work rather than silently dropping it. Per `context/foundation/lessons.md`, GitHub issues are written in English regardless of the issue's subject matter.

### Changes Required:

#### 1. GitHub issue

**Intent**: Open an issue describing the need for Polish-language (or bilingual) landing-page copy in the future, noting that in-app category labels (`silnik`, `hamulce`, `elektryka`, `ogumienie`, `przegląd`, `inne`) are already Polish-first while the landing page (this change) is English-only — flagging the inconsistency as the concrete reason to revisit.

**Contract**: `gh issue create` in this repository, English title and body, no labels assumed to exist (create without `--label` unless the repo's existing label set is confirmed first).

### Success Criteria:

#### Automated Verification:

- Issue created successfully: `gh issue view <number>` returns the issue

#### Manual Verification:

- Issue title and body are in English and clearly describe the deferred i18n scope

**Implementation Note**: This phase performs a GitHub-visible action (issue creation) — confirm with the user before running `gh issue create`.

---

## Testing Strategy

### Unit Tests:

- No new unit-testable logic is introduced (static Astro components, no business logic) — existing `npm run test` suite must remain green as a regression check.

### Integration Tests:

- None required — no API or data-layer changes.

### Manual Testing Steps:

1. `npm run dev`, visit `/` logged out — verify hero, feature grid, secondary strip render with correct copy.
2. Click Sign Up, Sign In, Try Demo — verify each navigates/submits correctly.
3. Sign in, visit `/` — verify redirect to `/dashboard/vehicles` still fires.
4. Visit `/?error=demo_failed` — verify banner still shows above the new hero.
5. Resize viewport (mobile/tablet/desktop) — verify feature grid reflows per existing responsive grid conventions.

## Performance Considerations

None beyond existing SSR behavior — no new data fetching, no new client-side JS (all components stay `.astro`, no React islands needed for static marketing content).

## Migration Notes

Not applicable — no data model or schema changes.

## References

- Research: `context/changes/landingpage/research.md`
- Current starter page: `src/components/Welcome.astro`
- Feature source references: `src/lib/classifyRepair.ts`, `src/lib/repairCategories.ts`, `src/lib/costPerKm.ts`, `src/lib/serviceReminders.ts`, `src/pages/api/demo.ts`
- Lessons: `context/foundation/lessons.md` (GitHub issues in English)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Landing page components

#### Automated

- [x] 1.1 Typecheck passes: `npx astro check` — c6c8126
- [x] 1.2 Lint passes: `npm run lint` — c6c8126
- [x] 1.3 Build succeeds: `npm run build` — c6c8126

#### Manual

- [ ] 1.4 All 3 new components render without console errors in dev mode
- [ ] 1.5 Feature copy is factually accurate against current app behavior

### Phase 2: Wire into index.astro and fix stale defaults

#### Automated

- [x] 2.1 Build succeeds: `npm run build` — 746b04b
- [x] 2.2 Lint passes: `npm run lint` — 746b04b
- [x] 2.3 Unit tests still pass: `npm run test` — 746b04b

#### Manual

- [ ] 2.4 Logged-out `/` shows new hero + feature grid + secondary strip
- [ ] 2.5 Logged-in `/` still redirects to `/dashboard/vehicles`
- [ ] 2.6 `/?error=demo_failed` still shows error banner
- [ ] 2.7 Sign Up, Sign In, Try Demo buttons work correctly
- [ ] 2.8 Page `<title>` reflects new default/explicit title

### Phase 3: Cleanup

#### Automated

- [x] 3.1 No remaining references: `grep -r "Welcome" src/` — f9719d6
- [x] 3.2 Full build passes: `npm run build` — f9719d6
- [x] 3.3 Full lint passes: `npm run lint` — f9719d6
- [x] 3.4 Full test suite passes: `npm run test` — f9719d6

#### Manual

- [ ] 3.5 Final visual pass of `/` confirms intentional, complete page

### Phase 4: File follow-up issue for Polish-language landing copy

#### Automated

- [x] 4.1 Issue created successfully: `gh issue view <number>` — issue #60

#### Manual

- [ ] 4.2 Issue title and body are English and clearly describe deferred i18n scope

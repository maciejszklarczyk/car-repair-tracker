---
date: 2026-07-20T21:07:43+02:00
researcher: Claude
git_commit: 0b2af243c0a4f4b44721b7041e17cf0630129c3a
branch: main
repository: maciejszklarczyk/car-repair-tracker
topic: "Find related features and things which should be mentioned on landingpage"
tags: [research, codebase, landingpage, marketing-copy]
status: complete
last_updated: 2026-07-20
last_updated_by: Claude
---

# Research: Features and content for the landing page

**Date**: 2026-07-20T21:07:43+02:00
**Researcher**: Claude
**Git Commit**: 0b2af243c0a4f4b44721b7041e17cf0630129c3a
**Branch**: main
**Repository**: maciejszklarczyk/car-repair-tracker

## Research Question

Find related features and things which should be mentioned on the landing page.

## Summary

The current `/` route (`src/pages/index.astro`) is 100% stock **10x Astro Starter** boilerplate — generic hero copy, three generic feature cards ("Authentication Ready", "Modern Stack", "Developer Experience"), one card even stale-references "Astro 5" though the project runs Astro 6. None of it mentions cars, repairs, cost/km, or AI classification. The three CTAs (Sign In, Sign Up, Try Demo) are real and reusable as-is.

The app has 6 substantive, demo-able features that should replace the generic cards: **vehicle & repair tracking (CRUD)**, **AI-powered repair classification** (Gemini, 6 Polish categories), **cost/km dashboard with trend charts**, **service reminders / maintenance thresholds**, **one-click demo mode**, and (secondary) **archive rather than delete** for vehicles. README's Features list matches the code accurately; the landing page is simply disconnected from it. No prior landing-page work exists in `context/changes/**` or `context/archive/**` — this is greenfield for this change.

## Detailed Findings

### Current landing page (to be replaced)

- `src/pages/index.astro` — redirects logged-in users to `/dashboard/vehicles`, shows `?error=demo_failed` banner, otherwise renders `<Welcome />` inside `<Layout>`. Full SSR (`output: "server"` in astro.config.mjs), no `prerender` export — needed because it reads `Astro.locals.user`.
- `src/components/Welcome.astro` — generic starter hero ("10x Astro Starter" / "A production-ready starter with authentication, modern tooling, and a cosmic developer experience."), 3 generic feature cards, and the 3 real CTAs: Sign In (`/auth/signin`), Sign Up (`/auth/signup`), Try Demo (`POST /api/demo`). Line 101 stale-references "Astro 5".
- `src/layouts/Layout.astro` — wraps `<slot />`, shows config-missing `Banner.astro`, only renders `Topbar.astro` when `Astro.locals.user` is set (so a public landing page gets no topbar by default — a new page needs its own header or to reuse just the CTA links). `title` prop defaults to `"10x Astro Starter"` — needs updating.
- `src/components/Topbar.astro` — auth-gated nav, not directly reusable for a marketing header.
- `src/components/Banner.astro` — generic alert strip, reusable as-is.
- Brand assets in `public/`: `banner.svg` (README hero image, good landing-page asset candidate), `favicon.png`, `mann.gif` (footer easter egg, not marketing copy), `template.png`.

### Feature 1 — Vehicle & repair tracking (core CRUD)

- Vehicle list ("garage"): `src/pages/dashboard/vehicles/index.astro:12-23` — fetches non-archived cars with repair mileages.
- Add vehicle: `src/pages/dashboard/vehicles/new.astro`, `src/components/vehicles/AddVehicleForm.tsx`.
- Vehicle detail: `src/pages/dashboard/vehicles/[id].astro:1-30` — stats header, charts, repair list, reminders, add-threshold, all in one view.
- Repair CRUD: `src/pages/dashboard/repairs/new.astro`, `src/pages/dashboard/repairs/[id]/edit.astro:1-27` (ownership-checked), `src/components/repairs/AddRepairForm.tsx`, `EditRepairForm.tsx`, `RepairList.tsx`.
- Vehicles are **archived, not hard-deleted**: `archived_at` field, filtered via `.is("archived_at", null)` (`src/pages/dashboard/vehicles/index.astro:18`).

### Feature 2 — AI repair classification (Gemini)

- `src/lib/classifyRepair.ts:1-42` — Gemini `gemini-2.5-flash-lite`, Polish-language prompt, 3s timeout, prompt-injection guard, graceful `null`/"pending" fallback without an API key.
- `src/lib/repairCategories.ts` — 6 categories: **silnik (engine), hamulce (brakes), elektryka (electrical), ogumienie (tires), przegląd (inspection), inne (other)**.
- Auto-classifies on create (`src/pages/api/repairs.ts:70-83`) and re-classifies on description edit unless manually overridden (`src/pages/api/repairs/[id].ts:91-97,179-189`).
- Manual override UI: `src/components/repairs/CategorySelect.tsx:11-30`, optimistic update/rollback.
- Full audit trail in data model: `category_source` (`ai` / `manual` / `pending`) + `original_category` (`src/types.ts:1-13`).

### Feature 3 — Cost/km dashboard & trend charts

- `src/lib/costPerKm.ts:8-14` — cost-per-km = total repair cost ÷ km driven since baseline mileage.
- `src/lib/costPerKm.ts:26-58` — cost/km trend, total-cost trend, mileage-over-time trend series.
- `src/components/vehicles/VehicleStatsHeader.tsx:13-22` — headline PLN/km stat.
- `src/components/vehicles/CostTrendChart.tsx:1-45` — Recharts `AreaChart`, 3 tabs (Cost/km, Total Cost, Mileage), needs ≥2 data points.
- `src/components/vehicles/ReactiveCostTrends.tsx:11-28` — reactive "Cost Trends" section synced to live repair store.

### Feature 4 — Service reminders / maintenance thresholds

- `src/lib/serviceReminders.ts:17-50` — status (`overdue`/`approaching`/`ok`) from km interval (10% margin) and/or days interval (30-day margin).
- `src/components/service-reminders/ServiceReminders.tsx:6-17` — "Service Alerts" surfacing overdue/approaching items with km/days remaining.
- CRUD UI: `AddServiceThresholdForm.tsx`, `EditServiceThresholdForm.tsx`, `ServiceThresholdList.tsx`.
- Endpoints: `src/pages/api/service-thresholds.ts`, `src/pages/api/service-thresholds/[id].ts`.
- Dual-trigger support in data model: `ServiceThreshold` (`src/types.ts:15-25`).

### Feature 5 — One-click demo mode

- `src/pages/api/demo.ts:9-53` — creates a throwaway auto-confirmed Supabase user, seeds data, signs the visitor in, redirects to `/dashboard/vehicles`; cleans up on failure.
- `src/lib/demo-seed.ts` — seeds 2 realistic vehicles (Skoda Octavia, VW Golf VII) with AI-classified repair history.
- `.github/workflows/demo-cleanup.yml` — nightly cron cleans up expired demo accounts (also documented in README § CI).
- This is a strong landing-page CTA: zero-friction "try it now" without signup.

### Auth (secondary, not a headline feature but needed for CTAs)

- `src/pages/auth/signin.astro`, `signup.astro`, `confirm-email.astro:4-16` (dev auto-confirms, prod shows "check your email").

## Code References

- `src/pages/index.astro` — current landing page entry, redirect + Welcome render
- `src/components/Welcome.astro` — generic hero + 3 stale feature cards + CTAs (to replace)
- `src/layouts/Layout.astro:11` — default `title` prop ("10x Astro Starter", needs updating)
- `src/components/Topbar.astro` — auth-gated nav (not reusable as-is for public page)
- `astro.config.mjs:14` — `output: "server"`, `security.allowedDomains` locked to `car-repair-tracker.msolve.it`
- `src/lib/classifyRepair.ts:1-42` — Gemini classification logic
- `src/lib/repairCategories.ts` — 6 category definitions
- `src/lib/costPerKm.ts:8-58` — cost/km + trend calculations
- `src/lib/serviceReminders.ts:17-50` — reminder status logic
- `src/pages/api/demo.ts:9-53` — demo account creation/seed/cleanup
- `src/types.ts:1-35` — `Repair`, `ServiceThreshold`, `Vehicle` entity shapes (audit trail, dual-trigger reminders, archive-not-delete)

## Architecture Insights

- Full SSR everywhere (`output: "server"`); a landing page can stay server-rendered (needed for the logged-in redirect) — no need to fight for static/prerender.
- The CTA wiring (Sign In / Sign Up / Try Demo → `POST /api/demo`) already exists and works; a new landing page should keep these three actions rather than reinvent them.
- Feature card content in `Welcome.astro` is the only thing that's actually generic/wrong — layout structure, auth flow, and demo flow are all sound and reusable.
- Category names and reminder logic are Polish-first in the domain model (`silnik`, `hamulce`, etc.) — landing copy should decide whether to keep Polish category names or translate for marketing.

## Historical Context (from prior changes)

None. `context/changes/landingpage/change.md` (created today, `status: new`) is the only artifact referencing a landing page; no `context/archive/**` history exists for this topic.

## Related Research

None — first research document for this change.

## Open Questions

- Should landing copy be Polish, English, or bilingual? (App domain data is Polish-first — category names — but README/docs are English.)
- Keep `Welcome.astro` as the component name/structure and rewrite its content, or introduce new dedicated landing-page components (hero, feature-grid, CTA section)?
- Does the new landing page need its own header (logo + Sign In/Sign Up links) since `Topbar.astro` is auth-gated and unavailable to logged-out visitors?
- Should `Layout.astro`'s default `title` be updated as part of this change, or left for a separate cleanup?

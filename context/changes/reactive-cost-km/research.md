---
date: 2026-07-02T16:40:23Z
researcher: Claude
git_commit: 76414335b8042ca19d591f91f8d3bd277d15c626
branch: main
repository: car-repair-tracker
topic: "Reactive cost/km update after repair delete (GH #49)"
tags: [research, codebase, vehicle-detail, react-islands, cost-per-km, repairs]
status: complete
last_updated: 2026-07-02
last_updated_by: Claude
---

# Research: Reactive cost/km update after repair delete

**Date**: 2026-07-02T16:40:23Z
**Researcher**: Claude
**Git Commit**: 76414335b8042ca19d591f91f8d3bd277d15c626
**Branch**: main
**Repository**: car-repair-tracker

## Research Question

After deleting a repair via `RepairList`'s local-state delete, the cost/km (and mileage) header on the vehicle detail page stays stale until reload. What's the best fix given current architecture — pull the metric into a React island, or add cross-island signaling?

## Summary

`computeCostPerKm` and `computeCurrentMileage` (`src/lib/costPerKm.ts:3-14`) are already pure, framework-agnostic functions that take `(vehicle, repairs)` and return the derived values — the exact same functions `getVehiclePageData` calls server-side. There is **no cross-island event/signaling pattern anywhere in the codebase** — every other mutation (`EditRepairForm`, `AddServiceThresholdForm`, `EditServiceThresholdForm`) reacts by doing a full `window.location.href` redirect, not local-state updates. `RepairList`'s delete handler (`src/components/repairs/RepairList.tsx:26-39`) is the sole exception, and it's exactly what makes the header go stale.

Given the pure functions already exist and are importable client-side, the natural fix is **Option A from the change notes**: extract the stat header (mileage + cost/km) into a small React island that receives `vehicle` and `repairs` as props and recomputes via `computeCurrentMileage`/`computeCostPerKm`. To keep it reactive to `RepairList`'s delete, the two islands need to share repair state — options are (a) lift `repairs` state up to a shared parent island wrapping both the header stat and `RepairList`, or (b) keep them separate and use a shared client-side store/event since Astro islands don't share React context by default.

## Detailed Findings

### Where the stale value lives

- `src/pages/dashboard/vehicles/[id].astro:67-76` — cost/km is server-rendered directly into the Astro template (`{costPerKm !== null ? ... : ...}`), and mileage similarly at line 66 (`{currentMileage.toLocaleString()} km`). Both come from `getVehiclePageData` at request time (`[id].astro:21,26`).
- `src/components/repairs/RepairList.tsx:26-39` — `handleDelete` calls `DELETE /api/repairs/:id`, then on success does `setRepairs((prev) => prev.filter(...))` — pure local React state, no page reload, no signal sent anywhere else.
- Both the header stat block and `RepairList` are declared as separate `client:load` islands in the same Astro file (`[id].astro:97, 114` for `CostTrendChart`/`RepairList`; the header itself isn't an island at all — it's static Astro markup).

### Reusable pure calculation functions

- `src/lib/costPerKm.ts:3-6` — `computeCurrentMileage(repairs, baselineMileage)`.
- `src/lib/costPerKm.ts:8-14` — `computeCostPerKm(vehicle, repairs)`. Same signature/logic as what the server calls.
- `src/lib/services/vehiclePageData.ts:66-67` — server-side call site, confirming these are the canonical source of truth (no duplicate logic to worry about diverging).
- Both functions have zero server-only dependencies (no Supabase client, no Astro globals) — safe to import into a React component and run client-side.

### No existing cross-island communication pattern

- Searched for `CustomEvent`, `addEventListener`, `dispatchEvent`, `window.*` mutation triggers across `src/components/**/*.tsx`. Only hits are full-navigation redirects:
  - `src/components/repairs/EditRepairForm.tsx:90` — `window.location.href = ".../vehicles/${id}?success=updated"`.
  - `src/components/service-reminders/AddServiceThresholdForm.tsx:48` — `window.location.href = "?success=threshold_added"`.
  - `src/components/service-reminders/EditServiceThresholdForm.tsx:48` — `window.location.href = "?success=threshold_updated"`.
- These all re-fetch the whole page (fresh SSR), which is why they don't hit the staleness bug — only `RepairList`'s delete opts into local-state-only updates for a snappier UX.
- `CostTrendChart` (`src/components/vehicles/CostTrendChart.tsx:8-11`) takes `costPerKmData`/`totalCostData`/`mileageData` as props computed server-side once at load — it does not recompute client-side and would have the same staleness problem if it were affected by delete (it isn't directly targeted by GH #49, but is architecturally identical).

### E2E test currently encodes the stale behavior as expected

- `e2e/repair-lifecycle.spec.ts:110-113` — after delete, the test explicitly does `await page.reload()` before asserting the "no cost data yet" state, with the comment `// Cost/km is server-rendered; reload to get recalculated value`. This test will need updating once the fix removes the need for reload (assert the no-data state directly after delete, without reload).

### Prior decision context

- `context/changes/vehicle-god-page/reviews/impl-review.md` F3 (Safety & Quality, Impact: Medium) is the exact origin of GH #49 — flagged during the `vehicle-god-page` refactor as a deliberate follow-up rather than a quick fix, because it requires moving state across island boundaries.
- `context/changes/reactive-cost-km/change.md` already captures both candidate approaches (pull into React island vs. cross-island event/store) — this research confirms the pure-function reuse makes "pull into island" the lower-friction path since there's no existing store/event infra to build on top of, and building one from scratch for a single interaction would be new architecture, not a reuse.

## Code References

- `src/pages/dashboard/vehicles/[id].astro:64-76` — server-rendered mileage + cost/km header markup
- `src/pages/dashboard/vehicles/[id].astro:112-115` — `RepairList` island mount point
- `src/components/repairs/RepairList.tsx:22-39` — local-state delete handler causing the staleness
- `src/lib/costPerKm.ts:3-14` — `computeCurrentMileage` / `computeCostPerKm` pure functions, reusable client-side
- `src/lib/services/vehiclePageData.ts:66-67` — server-side call site of the same functions
- `src/components/vehicles/CostTrendChart.tsx:8-11` — sibling island with the same "props computed once server-side" shape
- `e2e/repair-lifecycle.spec.ts:110-113` — test currently asserts stale-then-reload behavior; will need updating

## Architecture Insights

- The codebase's default reactivity model for mutations is "redirect and let SSR recompute" — `RepairList` delete is a deliberate UX exception (avoid full reload for delete), which is precisely what breaks the header.
- Business-logic calculations are already isolated in `src/lib/costPerKm.ts` as pure functions independent of Astro/Supabase — this is a strong precedent for "compute client-side using the same function," not a new pattern.
- There is no shared client state/store across islands (no Nanostores, no Zustand, no custom event bus). Introducing one would be new infrastructure; scoping the fix to "wrap header + RepairList in one island (or one parent island with two children)" avoids that.

## Historical Context (from prior changes)

- `context/changes/vehicle-god-page/reviews/impl-review.md` — F3 is the originating finding; explicitly deferred as a separate change rather than fixed inline, consistent with `context/changes/reactive-cost-km/change.md`.

## Related Research

- None found under `context/changes/**/research.md` or `context/archive/**/research.md` for this topic.

## Open Questions

- Should the fix also cover `currentMileage` (also server-rendered, also goes stale on delete if the deleted repair held the max mileage), or should scope stay strictly to cost/km per the issue title? The header markup couples both values in one block, so fixing one without the other is awkward.
- Should `CostTrendChart`'s trend data also become reactive to delete, or is that explicitly out of scope for this change (issue title only mentions the cost/km header stat, not the trend chart)?
- Preferred shape: one merged island (header stats + RepairList combined) vs. two islands sharing state via a minimal store/event? Given no existing store infra, a single combined island is likely simplest — worth confirming during planning.

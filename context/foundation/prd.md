---
project: "Car Repair Tracker"
version: 1
status: draft
created: 2026-05-19
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 7
  hard_deadline: 2026-07-05
  after_hours_only: true
---

# Car Repair Tracker — Product Requirements

## Vision & Problem Statement

Individual car owners have no single place to track repair history, running cost per kilometre, and upcoming service or inspection deadlines. Today they rely on memory: invoices vanish in drawers and inboxes, deadlines slip without warning, and when a mechanic asks "when did you last change X?" the owner cannot answer. The cost is invisible spending and missed maintenance.

The insight: a car owner does not need yet another generic notes app — they need software that automatically classifies each repair into a maintenance category, aggregates spending into a per-km figure they can act on, and surfaces upcoming service events before they are missed. Classification turns free-form repair text into structured history without forcing the owner to learn taxonomy; the per-km figure converts a heap of invoices into a single number that informs the keep-or-sell decision; threshold-based reminders convert "I'll remember" into a guarantee.

## User & Persona

**Primary persona — Individual car owner (hobbyist niche).** Owns one to three personal vehicles. Maintains them with above-average discipline, hates losing money on forgotten service or hidden running costs, and dislikes both paper invoices in drawers and spreadsheets they have to babysit. Not a mechanic, not a fleet manager, not a workshop. The moment they reach for this product is right after a repair (to record it) or right before a long drive / inspection (to check what is coming up).

## Success Criteria

### Primary

- A new owner can, in a single session, register, log in, add a car, add a repair, see the repair classified into a maintenance category, see a cost-per-km figure for that car, and see a reminder for any upcoming service whose threshold is approaching.
- For repairs that contain a recognisable maintenance description, the assigned category matches the owner's expectation often enough that the owner accepts the assignment without override more often than they correct it (measured anecdotally during MVP; full metric defined post-launch).

### Secondary

- The owner can see a visual trend of cost-per-km per car over time.

### Guardrails

- **Data isolation:** an authenticated owner can never observe or modify any other owner's cars, repairs, thresholds, or reminders, even by crafting unexpected requests.
- **Zero-cost AI:** the total monthly cost of classification stays at 0 PLN by remaining within the free tier of the chosen classification provider; the product must continue to function when that tier is exhausted.
- **Classification is never blocking:** if classification cannot complete in a reasonable time or fails, the repair is still saved and aggregations still function — only the category is marked unclassified until the owner triggers reclassification or sets it manually.

## User Stories

### US-01: Primary MVP flow

- **Given** a new visitor with no account,
- **When** they register with email + password, log in, add a car (e.g. marka "Skoda", model "Octavia", rok 2018, aktualny przebieg 145 000, baseline przebieg 142 000), and then add a repair (data 2026-05-15, opis "wymiana klocków hamulcowych przód", koszt 320, przebieg 144 800),
- **Then** the repair is saved, classified as `hamulce` within a few seconds (or saved as `pending` if classification cannot complete), the car's dashboard shows a cost-per-km figure computed from the repair list (excluding any cost-less entries), and any reminder whose threshold falls inside the configured warning margin is visible on the same dashboard.

#### Acceptance Criteria

- The owner does not have to wait for classification to finish before the repair appears in history.
- The cost-per-km figure updates immediately after the new repair is added.
- A repair recorded without a cost value is shown in history but excluded from cost-per-km.

### US-02: AI override

- **Given** a repair whose assigned category does not match what the owner knows it to be (e.g. classified `inne`, actually `silnik`),
- **When** the owner opens the repair and changes the category to `silnik`,
- **Then** the new category is persisted and used in every subsequent view and aggregation; the original assignment is not surfaced to the owner.

#### Acceptance Criteria

- The override persists across sessions.
- Aggregations grouped by category reflect the owner's chosen value, not the original assignment.

### US-03: Reminder triggers

- **Given** a car with current przebieg 144 000 and a threshold "wymiana oleju, interwał 15 000 km, ostatnio @ 130 000 km" plus a user warning margin of 1 000 km,
- **When** the owner loads the dashboard,
- **Then** a reminder is surfaced for "wymiana oleju" indicating the next expected event at 145 000 km, because 144 000 ≥ (130 000 + 15 000 − 1 000).

#### Acceptance Criteria

- The reminder disappears once the owner records a matching service event past the threshold.
- A threshold using a date interval triggers analogously when today is within the margin of the next expected date.

## Functional Requirements

### Authentication

- FR-001: Owner can register and log in with email and password. Priority: must-have
  > Socratic: Counter-argument considered: "a single-tenant local profile would be enough." Resolution: rejected; the product is multi-tenant for the hobbyist niche, and the certification requirement for access control is binding.

### Vehicles

- FR-002: Owner can add, edit, and archive a car (marka, model, rok, aktualny przebieg, baseline przebieg = przebieg at the moment record-keeping began for that car). Archiving hides the car and its repairs/reminders from active listings and from cost-per-km, but the record remains restorable. Priority: must-have
  > Socratic: Counter-argument considered: "deleting a car cascades to repairs and reminders." Resolution: archive instead of destructive removal; cost-per-km respects the archive flag.

### Repairs

- FR-003: Owner can add a repair (data, opis tekstowy, koszt — may be left blank, przebieg w momencie naprawy, pojazd). Repairs without a koszt value (e.g. gwarancja, naprawa darmowa) are recorded but excluded from cost-per-km aggregation. Priority: must-have

  > Socratic: Counter-argument considered: "koszt opcjonalny — czasem naprawa darmowa/gwarancja." Resolution: accepted; koszt may be omitted and such entries are excluded from cost aggregation.

- FR-004: System assigns each repair to exactly one of {silnik, hamulce, elektryka, ogumienie, przegląd, inne} based on the repair's opis text. Priority: must-have

  > Socratic: Counter-argument considered: "a manual dropdown is enough — six categories." Resolution: rejected; automatic classification is the domain rule that distinguishes the product from a spreadsheet (see Business Logic). Manual override is still available (FR-005).

- FR-005: Owner can override the assigned repair category to any of the six categories. The override is persisted and is the value used downstream. Priority: must-have

  > Socratic: Counter-argument considered: "no override — classification should always be right." Resolution: rejected; classification accuracy is not guaranteed for the MVP and the owner must be able to correct mistakes.

- FR-006: Owner can list, edit, and remove repairs for any of their active (non-archived) cars. Removal requires explicit confirmation and the affected car's cost-per-km is recomputed afterwards so totals stay correct. Priority: must-have
  > Socratic: Counter-argument considered: "delete-repair przekręca historyczne koszty/km." Resolution: removal is allowed only with a confirmation step and triggers recalculation so totals are never silently stale.

### Cost analytics

- FR-007: System computes cost-per-km per car as `sum(koszt where koszt is recorded) / max(0, aktualny przebieg − baseline przebieg)` and surfaces it on the car's dashboard. Fuel and insurance are explicitly out of MVP scope (see Non-Goals). Priority: must-have

  > Socratic: Counter-argument considered: "the formula ignores paliwo and ubezpieczenie." Resolution: out of MVP; baseline przebieg makes the formula correct for used cars, and fuel/insurance are deferred to a later phase.

- FR-010: System renders a visual trend of cost-per-km per car over time. Priority: nice-to-have
  > Socratic: Counter-argument considered: "a table is enough — a chart is chrome." Resolution: kept as nice-to-have; ship only if the 7-week budget allows.

### Reminders

- FR-008: Owner can define service thresholds per car (typ serwisu, interwał_km and/or interwał_dni, last_done_date, last_done_przebieg). Priority: must-have

  > Socratic: Counter-argument considered: "preset szablony per typ auta." Resolution: out of MVP; manual entry only. Catalog of standard intervals deferred to Non-Goals.

- FR-009: Owner can configure a personal warning margin (e.g. 1 000 km / 14 days). A reminder is surfaced for a threshold when current przebieg ≥ (last_done_przebieg + interwał_km − margin_km) or today's date ≥ (last_done_date + interwał_dni − margin_dni). Priority: must-have
  > Socratic: Counter-argument considered: "push or email — MVP-too-big — reminder only when the owner opens the app." Resolution: reminders appear only when the owner opens the app; push and email are deferred. Margin is configurable per the explicit pick.

### Classification guardrail

- FR-011: Classification completes within a few seconds; if it does not, the repair is still saved with category `pending` and the owner can retrigger classification or pick a category manually. Priority: must-have
  > Socratic: Counter-argument considered: "background queue by default." Resolution: rejected as MVP-too-big; a short-timeout attempt followed by a `pending` fallback meets the non-blocking guardrail with no extra infrastructure.

## Non-Functional Requirements

- **Authorization integrity:** every access (read or write) of a car, repair, threshold, or reminder is authorized against the owning user; one owner can never observe or mutate another owner's data, even with a tampered or forged request.
- **Classification cost ceiling:** total monthly cost of the classification capability remains at 0 PLN; the product continues to function (with category `pending` if needed) when the chosen provider's free tier is exhausted.
- **Privacy commitment:** no repair text or user data is sent to any third party other than the classification provider; nothing is shared, sold, or used for analytics.
- **Response feel:** outside of the classification attempt, the owner sees acknowledgement of any input within a fraction of a second, and continuous visible progress for any operation that takes longer than two seconds.
- **Browser support:** the product remains usable on the latest two major versions of the four mainstream desktop browsers.

## Business Logic

When the owner records a repair, the app assigns it to a maintenance category, attributes its cost to the car's per-km running cost, and uses past repairs together with user-defined service intervals to surface upcoming service events before they are missed.

**Inputs (user-facing):** the car's identity, marka/model/rok, aktualny przebieg, and baseline przebieg; the repair's data, opis tekstowy, optional koszt, and przebieg w momencie naprawy; per-car service thresholds (typ serwisu, interwał km and/or dni, last done date and przebieg); the owner's personal warning margin (km, dni).

**Outputs (user-visible):** the repair appears in the car's history tagged with a maintenance category (silnik / hamulce / elektryka / ogumienie / przegląd / inne) that the owner may override; the car's dashboard shows an updated cost-per-km figure that excludes cost-less entries; the dashboard surfaces any threshold whose next event falls inside the configured warning margin.

**How the owner encounters it:** a single "add repair" form whose submission causes the new history row, the updated cost-per-km, and any newly-due reminder to appear together — the owner does not have to navigate elsewhere to see the result of a record.

**Failure mode:** when classification cannot complete in the allowed time, the repair persists with category `pending`; cost aggregation and reminders are unaffected, and the owner can retrigger classification or set the category manually.

## Access Control

Multi-user, with email + password authentication. The role model is flat: every authenticated owner sees and manages only their own cars, repairs, thresholds, and reminders. There is no admin role in the MVP. There is no sharing between owners (no co-driver, no fleet, no read-only guest); a future role split may be added once justified by support load. An unauthenticated visitor hitting any gated route is redirected to sign-in.

## Non-Goals

- **Paliwo i ubezpieczenie w koszcie eksploatacji** — cost-per-km in the MVP is computed from repair entries only; fuel and insurance are deferred to a later phase.
- **Push / email notifications** — reminders are visible only when the owner opens the app; push and email channels are out of scope for the MVP.
- **Templates of standard service intervals per car model** — no catalog of standard intervals; the owner defines every threshold manually.
- **Invoice upload / OCR** — classification works only on a written opis; parsing photos or PDFs is out of scope for the MVP.
- **Vehicle sharing between owners** — single-owner-per-car; co-driver / fleet / shared workspace patterns are out of scope.
- **Building a recommendation engine** — the MVP classifies repairs and surfaces deadlines; it does not recommend what service to do next beyond user-defined thresholds.

## Open Questions

1. **Classification provider selection** — Owner: tech-stack-selection step. Two candidates surfaced upstream (free-tier classifier services); the actual pick depends on free-tier limits, latency, and Polish-language quality. Resolution before: start of implementation.
2. **Persistence target** — Owner: tech-stack-selection step. The PRD makes no commitment about how owner data is persisted; the choice (and any cost implications) is owned downstream. Resolution before: start of implementation.
3. **Hosting target** — Owner: tech-stack-selection step. The 0 PLN total-monthly-cost guardrail (Non-Functional Requirements) constrains the hosting choice. Resolution before: start of implementation.
4. **Audit trail for category overrides** — Owner: user. Whether to retain the original auto-assigned category alongside the owner's override (for future quality measurement) is undecided. Resolution before: post-MVP review.
5. **Empirical accuracy threshold for classification** — Owner: user. The Success Criteria mention anecdotal measurement during MVP; a quantitative target (e.g. ≥ 70 % owner acceptance without override) needs to be set after the first weeks of real usage. Resolution before: end of MVP.

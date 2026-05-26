---
project: Car Repair Tracker
context_type: greenfield
updated: 2026-05-19
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 7
  hard_deadline: 2026-07-05
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 11
  quality_check_status: accepted
---

# Shape Notes — Car Repair Tracker

## Vision & Problem Statement

Individual car owners have no single place to track repair history, running cost per km, and upcoming service/inspection deadlines. Today they rely on memory and hope: invoices vanish, deadlines slip, and when the mechanic asks "when did you last change X?" they can't answer. The product gives them one app where every repair is recorded once, classified automatically, costs are aggregated per km, and upcoming deadlines surface as alerts.

**Pain triggers:**

- Missed service/inspection deadline (no alert anywhere).
- Mechanic asks "when was last X?" — owner doesn't remember.
- Owner deciding whether to keep car — no cost/km figure to ground the decision.

**Status quo:** nothing — memory + hope.

## User & Persona

**Primary:** Individual car owner (hobbyist niche). Owns 1–3 personal vehicles. Cares about maintenance discipline, hates losing money on forgotten service or hidden running costs. Not a mechanic; not a fleet manager.

## Access Control

Email + password authentication. Flat role model: every authenticated user sees and manages only their own cars, repairs, and reminders. No admin role in MVP (added later if support load justifies). No data sharing between users.

## Success Criteria

### Primary

End-to-end flow works for a new user in one session: register → log in → add a car (marka, model, rok, aktualny przebieg) → add a repair (date, opis, koszt, przebieg) → AI classifies repair type → dashboard shows koszt/km for that car → reminder appears when a defined service threshold is approached.

### Secondary

Wykres kosztów w czasie — visual trend of cost-per-km per car over time.

### Guardrails

- **Data isolation:** user A must never see user B's cars/repairs/reminders. Authorization enforced server-side on every read/write.
- **AI cost = 0 PLN:** classification stays on free tier (Groq or Gemini Flash). No surprise bill.
- **AI failure is non-blocking:** if classification fails or times out, the repair still saves with type `inne` or `pending`; user can re-classify later.

## Timeline acknowledgment

Acknowledged on 2026-05-19: 7-week after-hours MVP requires sustained dedication over ~7 weeks of evenings/weekends to hit the 2026-07-05 certification deadline; user accepted the cost explicitly.

## Functional Requirements

### Authentication

- FR-001: Owner can register and log in with email + password. Priority: must-have
  > Socrates: Counter-argument considered: "single-tenant local profile would be enough." Resolution: kept; product is multi-tenant hobbyist niche and certification requires access control.

### Vehicles

- FR-002: Owner can add, edit, and soft-delete a car (marka, model, rok, aktualny przebieg, **baseline_przebieg** = przebieg w momencie rozpoczęcia ewidencji). Soft-delete archives the car and its repairs/reminders so they are excluded from cost/km and listings but remain restorable. Priority: must-have
  > Socrates: Counter-argument considered: "delete-car cascades repairs/reminders." Resolution: switched to soft-delete (archive) instead of hard delete; cost/km calculations honor the archive flag.

### Repairs

- FR-003: Owner can add a repair (data, opis tekstowy, **koszt — optional/null allowed**, przebieg w momencie naprawy, pojazd). Repairs with `koszt = null` (e.g., gwarancja, naprawa darmowa) are recorded but excluded from cost/km aggregation. Priority: must-have

  > Socrates: Counter-argument considered: "koszt opcjonalny — czasem naprawa darmowa/gwarancja." Resolution: accepted; koszt is nullable and null entries are excluded from cost aggregation.

- FR-004: System classifies each repair into exactly one of {silnik, hamulce, elektryka, ogumienie, przegląd, inne} via an LLM call against the opis text. Priority: must-have

  > Socrates: Counter-argument considered: "AI tags w hybrydzie — auto + user może zmienić." Resolution: confirmed; AI sets initial type, user override is FR-005. Hybrid behavior preserves AI as the differentiator while protecting UX.

- FR-005: Owner can override the AI-assigned repair type to any of the six categories. The override is persisted and is the value used downstream. Priority: must-have

  > Socrates: Counter-argument considered: "bez override — AI ma być zawsze prawdą." Resolution: rejected; AI accuracy is not guaranteed in MVP and UX must allow correction.

- FR-006: Owner can list, edit, and hard-delete repairs for any of their (non-archived) cars. Hard-delete requires explicit confirmation and triggers recomputation of the affected car's cost/km. Priority: must-have
  > Socrates: Counter-argument considered: "delete-repair przekręca historyczne koszty/km." Resolution: hard-delete is allowed with a confirmation modal and triggers recalculation so totals stay correct after removal.

### Cost analytics

- FR-007: System computes cost-per-km per car as `sum(koszt where koszt is not null) / max(0, aktualny_przebieg − baseline_przebieg)`, surfaced on the car dashboard. Fuel and insurance are explicitly out of MVP scope. Priority: must-have

  > Socrates: Counter-argument considered: "wzór ignoruje paliwo/ubezpieczenie." Resolution: out of MVP; baseline_przebieg added (FR-002) so the formula is correct for used cars. Fuel/insurance recorded as a v2 follow-up in Non-Goals.

- FR-010: System renders a cost-over-time chart per car (cost on Y, repair date on X). Priority: nice-to-have
  > Socrates: Counter-argument considered: "table is enough — chart is chrome." Resolution: kept as nice-to-have; ship only if 7-week budget allows.

### Reminders

- FR-008: Owner can define service thresholds per car (typ serwisu, interwał_km OR interwał_dni OR both, ostatnie_wykonanie_data, ostatnie_wykonanie_przebieg). Priority: must-have

  > Socrates: Counter-argument considered: "preset szablony per typ auta." Resolution: out of MVP; manual entry only. Templates deferred to Non-Goals.

- FR-009: Owner can configure a **per-user warning margin** (e.g., 1000 km / 14 days). A reminder is shown in-app when current_przebieg ≥ (ostatnie_wykonanie_przebieg + interwał_km − margin_km) OR today ≥ (ostatnie_wykonanie_data + interwał_dni − margin_dni). Priority: must-have
  > Socrates: Counter-argument considered: "push/email = MVP-too-big — in-app banner only." Resolution: in-app only; margin is user-configurable per the explicit pick. Push/email deferred.

### AI guardrail

- FR-011: AI classification call is synchronous with a 3-second timeout. On timeout or error, the repair saves with `type = pending`; user can re-trigger classification or pick a type manually. Priority: must-have
  > Socrates: Counter-argument considered: "async by default with background queue." Resolution: rejected as MVP-too-big; synchronous + 3 s timeout is simpler and meets the non-blocking guardrail.

## User Stories

### US-01: Primary MVP flow

**Given** a new visitor with no account,
**when** they register with email+password, log in, add a car (marka "Skoda", model "Octavia", rok 2018, aktualny_przebieg 145000, baseline_przebieg 142000), then add a repair (data 2026-05-15, opis "wymiana klocków hamulcowych przód", koszt 320, przebieg 144800),
**then** the repair is saved, AI classifies it as `hamulce` within 3 seconds (or saves as `pending` if it times out), the car dashboard shows koszt/km computed from the repair list excluding any null-koszt entries, and any reminder whose threshold is within the configured margin is visible on the dashboard.

### US-02: AI override

**Given** a repair that AI classified as `inne` but is actually `silnik`,
**when** the owner opens the repair and changes the type to `silnik`,
**then** the new type is persisted and used in any downstream view/aggregation.

### US-03: Reminder triggers

**Given** a car with current_przebieg 144000 and a threshold "wymiana oleju, interwał 15000 km, ostatnio @ 130000 km" plus a user margin of 1000 km,
**when** the dashboard is loaded,
**then** a reminder banner shows "wymiana oleju — wkrótce próg @ 145000 km" because 144000 ≥ (130000 + 15000 − 1000).

## Business Logic

When the owner records a repair, the app classifies it into a maintenance category, attributes its cost to the car's per-km running cost, and uses past repairs plus user-defined service intervals to surface upcoming service deadlines before they slip.

**Inputs (user-supplied):** the car's identity and baseline przebieg; the repair's date, opis tekstowy, optional koszt, and przebieg w momencie naprawy; the threshold definitions for that car (typ serwisu, interwał km/dni, ostatnie wykonanie); the user's warning margin (km, dni).

**Outputs (user-visible):** the repair appears in the car's history tagged with a maintenance category (silnik / hamulce / elektryka / ogumienie / przegląd / inne — overridable by the owner); the car's dashboard shows an updated cost-per-km figure that excludes null-koszt entries; the dashboard surfaces any threshold whose next event falls inside the configured warning margin.

**Encountered as:** a single "add repair" form whose submission triggers classification, recomputation, and reminder re-evaluation in one user action — the owner sees the new history row, the new cost/km, and any new reminder banner without leaving the dashboard.

**Failure mode:** if classification times out or errors, the repair persists with `type = pending`. Aggregation and reminders are unaffected; the owner can re-trigger classification or set the type manually.

## Non-Functional Requirements

- **Authorization integrity:** every read and write of a car, repair, threshold, or reminder is authorized server-side against the owning user; user A cannot observe or mutate user B's data even with a forged or tampered request.
- **AI cost ceiling:** total monthly AI cost stays at 0 PLN — the app must function within the free tier of the chosen provider (Groq or Gemini Flash); a non-blocking degradation path (FR-011) is mandatory.
- **Privacy commitment:** no repair text or user data is sent to a third party other than the chosen LLM provider for classification; nothing is shared, sold, or used for analytics.

## Open Questions

- AI provider choice (Groq vs Gemini Flash) — defer to tech-stack selection.
- Database choice — defer to tech-stack selection.
- Hosting target — defer to tech-stack selection.
- Whether to store the original AI suggestion alongside the user override (audit trail) — TBD, not blocking MVP.

## Non-Goals

- **Paliwo i ubezpieczenie w koszcie eksploatacji** — koszt/km MVP liczony tylko z napraw; paliwo i polisy dopiero w v2.
- **Push / email notyfikacje** — przypomnienia widoczne wyłącznie w aplikacji (banner na dashboard); push i mail poza MVP.
- **Szablony serwisów per model auta** — brak katalogu standardowych interwałów; user definiuje progi ręcznie.
- **OCR faktur / upload pliku** — AI klasyfikuje wyłącznie z opisu tekstowego; parsowanie zdjęć/PDF poza MVP.
- **Współdzielenie pojazdu między użytkownikami** — single-owner-per-car; brak co-driver / fleet sharing w MVP.

## Forward: tech-stack

User-stated stack hints from seed (NOT decisions — input to `/10x-tech-stack-selector`):

- Backend language family: PHP.
- Frontend: web (framework TBD by selector).
- AI provider candidates: Groq API or Google Gemini Flash (free tier).
- Database: TBD.
- Hosting: TBD.
- Constraint: total monthly cost (hosting + DB + AI) must be 0 PLN.

## Forward: technical-roadmap

Certification requirements that downstream skills must address:

- e2e test of the primary user flow (US-01) — testing strategy TBD.
- CI/CD pipeline — platform TBD.
- Documented artifacts: PRD, technical specification, AI context — owned by `/10x-prd` and subsequent skills.

## Quality cross-check

Run 2026-05-19. All checked elements present:

- Access Control — captured (email+password, flat role).
- Business Logic — captured as a one-sentence domain rule plus I/O and failure mode.
- Project artifacts — `shape-notes.md` with valid frontmatter checkpoint.
- Timeline-cost ack — present; 7-week after-hours commitment acknowledged.
- Non-Goals — 5 entries.
- Preserved behavior — n/a (greenfield).

`quality_check_status: accepted`.

---
project: Car Repair Tracker
version: 1
status: draft
created: 2026-05-25
updated: 2026-05-25
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Car Repair Tracker

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Indywidualni właściciele aut nie mają jednego miejsca do śledzenia historii napraw, kosztu eksploatacji per km i nadchodzących terminów serwisowych. Produkt automatycznie klasyfikuje naprawy w kategorie serwisowe, agreguje koszty w jedną liczbę koszt/km (informującą decyzję „trzymać czy sprzedać") i sygnalizuje nadchodzące przeglądy zanim zostaną przegapione.

## North star

**S-01: Właściciel dodaje auto i naprawę, widzi koszt/km** — gwiazda przewodnia, czyli najmniejszy pionowy przekrój przez wszystkie warstwy, którego dostarczenie udowadnia że rdzeń produktu (zbieranie danych + analityka kosztowa) działa. Umieszczony jako pierwszy, bo bez niego żaden dalszy slice (AI, przypomnienia) nie ma na czym operować.

## At a glance

| ID   | Change ID              | Outcome (user can …)                                                    | Prerequisites | PRD refs                          | Status   |
| ---- | ---------------------- | ------------------------------------------------------------------------ | ------------- | --------------------------------- | -------- |
| S-01 | vehicles-repairs-cost  | dodać auto i naprawę, zobaczyć historię i koszt/km                       | —             | FR-001, FR-002, FR-003, FR-006, FR-007, US-01 | ready    |
| S-02 | ai-classification      | zobaczyć naprawę sklasyfikowaną przez AI i nadpisać kategorię            | S-01          | FR-004, FR-005, FR-011, US-01, US-02          | proposed |
| S-03 | service-reminders      | zdefiniować progi serwisowe i widzieć przypomnienia na dashboardzie      | S-01          | FR-008, FR-009, US-03                         | proposed |
| S-04 | cost-trend-chart       | zobaczyć wykres trendu kosztów/km w czasie                               | S-01          | FR-010                                        | proposed |

## Baseline

Stan codebase na 2026-05-25 (auto-researched + potwierdzone). Slice'y poniżej zakładają że te elementy są obecne i NIE budują ich od nowa.

- **Frontend:** present — Astro 6 + React 19 + Tailwind 4 + shadcn/ui, file-based routing (`src/pages/`)
- **Backend / API:** partial — auth API endpoints only (`src/pages/api/auth/`), brak logiki biznesowej
- **Data:** partial — Supabase client wired for auth (`src/lib/supabase.ts`), brak schematu app, migracji, typów encji
- **Auth:** present — Supabase SSR, cookie sessions, middleware (`src/middleware.ts`), signin/signup/signout
- **Deploy / infra:** present — Dockerfile, docker-compose.prod.yml, CI lint+build+deploy (.github/workflows/ci.yml), Traefik labels
- **Observability:** absent — brak logowania, error tracking, metryk; tylko Docker healthcheck

## Foundations

Brak wymaganych fundamentów. Auth, frontend i deploy są obecne w baseline. Schemat bazy danych budowany pionowo — każdy slice tworzy własne migracje dla potrzebnych tabel.

## Slices

### S-01: Pojazdy, naprawy i koszt/km

- **Outcome:** właściciel może dodać auto (marka, model, rok, aktualny przebieg, baseline przebieg), zarejestrować naprawę (data, opis, koszt, przebieg), przeglądać/edytować/usuwać naprawy i zobaczyć koszt/km na dashboardzie auta
- **Change ID:** vehicles-repairs-cost
- **PRD refs:** FR-001, FR-002, FR-003, FR-006, FR-007, US-01
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Największy slice — obejmuje schemat DB (tabele cars + repairs z RLS), API endpoints, UI i logikę kosztu/km. Jeśli rozrośnie się ponad plan, opóźni wszystkie dalsze slice'y.
- **Status:** ready

### S-02: Klasyfikacja AI i nadpisanie kategorii

- **Outcome:** właściciel widzi naprawę automatycznie sklasyfikowaną do jednej z sześciu kategorii (silnik, hamulce, elektryka, ogumienie, przegląd, inne) i może nadpisać kategorię ręcznie
- **Change ID:** ai-classification
- **PRD refs:** FR-004, FR-005, FR-011, US-01, US-02
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - Który dostawca AI (Groq vs Gemini Flash)? Oba free-tier. Różnią się SDK, limitami, jakością w języku polskim. — Owner: user. Block: no.
- **Risk:** Integracja z zewnętrznym API + obsługa timeout/fallback (3 s per FR-011). Jakość klasyfikacji po polsku nieznana do momentu testów.
- **Status:** proposed

### S-03: Progi serwisowe i przypomnienia

- **Outcome:** właściciel może zdefiniować progi serwisowe per auto (typ serwisu, interwał km/dni, ostatnie wykonanie) i widzi przypomnienia na dashboardzie gdy zbliża się termin
- **Change ID:** service-reminders
- **PRD refs:** FR-008, FR-009, US-03
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Logika marginów (km + dni) wymaga precyzyjnych testów — błąd w formule generuje fałszywe lub brakujące przypomnienia.
- **Status:** proposed

### S-04: Wykres kosztów w czasie

- **Outcome:** właściciel może zobaczyć wizualny trend kosztów/km per auto (koszt na osi Y, data naprawy na osi X)
- **Change ID:** cost-trend-chart
- **PRD refs:** FR-010
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Nice-to-have (PRD priority). Z celem `speed` i ~6 tygodniami budżetu może nie zmieścić się w terminie — pierwsza kandydatura do zaparkowania.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID             | Suggested issue title                              | Ready for `/10x-plan` | Notes                                  |
| ---------- | --------------------- | -------------------------------------------------- | --------------------- | -------------------------------------- |
| S-01       | vehicles-repairs-cost | Pojazdy + naprawy + koszt/km (north star)          | yes                   | Run `/10x-plan vehicles-repairs-cost`  |
| S-02       | ai-classification     | Klasyfikacja AI napraw + nadpisanie kategorii       | no                    | Czeka na S-01; wybór dostawcy AI otwarty |
| S-03       | service-reminders     | Progi serwisowe + przypomnienia na dashboardzie     | no                    | Czeka na S-01                          |
| S-04       | cost-trend-chart      | Wykres trendu kosztów/km w czasie                   | no                    | Czeka na S-01; nice-to-have            |

## Open Roadmap Questions

1. **Wybór dostawcy klasyfikacji AI (Groq vs Gemini Flash)** — Owner: user. Block: S-02. Oba free-tier, różnią się SDK i jakością w języku polskim. Decyzja wymagana przed implementacją S-02.
2. **Strategia testów e2e** — Owner: user. Block: roadmap-wide. Shape-notes wymieniają e2e test US-01 jako wymaganie. Strategia (Playwright? Cypress? manualnie?) nie wybrana.
3. **Audyt trail dla nadpisań kategorii AI** — Owner: user. Block: —. Czy przechowywać oryginalną kategorię AI obok nadpisania użytkownika (do pomiaru jakości). Nie blokuje MVP.
4. **Próg dokładności klasyfikacji** — Owner: user. Block: —. Ilościowy cel (np. ≥ 70% akceptacji bez nadpisania) do ustalenia po pierwszych tygodniach użytkowania.

## Parked

- **Paliwo i ubezpieczenie w koszcie eksploatacji** — Why parked: PRD §Non-Goals; koszt/km MVP liczony tylko z napraw.
- **Push / email notyfikacje** — Why parked: PRD §Non-Goals; przypomnienia widoczne tylko w aplikacji.
- **Szablony serwisów per model auta** — Why parked: PRD §Non-Goals; user definiuje progi ręcznie.
- **OCR faktur / upload pliku** — Why parked: PRD §Non-Goals; klasyfikacja tylko z opisu tekstowego.
- **Współdzielenie pojazdu między użytkownikami** — Why parked: PRD §Non-Goals; single-owner-per-car.
- **Silnik rekomendacji** — Why parked: PRD §Non-Goals; MVP klasyfikuje i sygnalizuje terminy, nie rekomenduje.

## Done

(Empty on first generation. `/10x-archive` appends entries here when a change is archived.)

---
project: Car Repair Tracker
version: 2
status: draft
created: 2026-05-25
updated: 2026-06-02
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

**S-04: Właściciel widzi koszt/km po dodaniu auta i naprawy** — gwiazda przewodnia, czyli najmniejszy kompletny przepływ pionowy (dodaj auto → dodaj naprawę → odczytaj koszt/km), który udowadnia że rdzeń produktu — zbieranie danych + analityka kosztowa — działa. Umieszczona jako cel sekwencji S-01–S-04, bo bez niej żaden dalszy slice (AI, przypomnienia, wykresy) nie ma na czym operować.

> „Gwiazda przewodnia" oznacza tutaj: pierwsza historyjka, która po zaimplementowaniu udowadnia, że rdzeń produktu działa od góry do dołu (dane → logika → UI). Wszystkie pozostałe slice'y mają sens tylko jeśli ten przepływ jest sprawny.

## At a glance

| ID   | Change ID         | Outcome (user can …)                                                  | Prerequisites | PRD refs                             | Status   |
| ---- | ----------------- | --------------------------------------------------------------------- | ------------- | ------------------------------------ | -------- |
| S-01 | add-vehicle       | dodać auto (marka, model, rok, przebieg bazowy) i zobaczyć je na liście | —             | FR-001, FR-002, US-01                | done     |
| S-02 | add-repair        | dodać naprawę (data, opis, koszt, przebieg) do wybranego auta           | S-01          | FR-003, US-01                        | done     |
| S-03 | repair-history    | przeglądać, edytować i usuwać naprawy na liście historii auta           | S-02          | FR-006, US-01                        | done     |
| S-04 | cost-per-km       | zobaczyć liczbę koszt/km na dashboardzie auta po dodaniu naprawy        | S-02          | FR-007, US-01                        | done     |
| S-08 | fix-mileage-tracking    | widzieć poprawny aktualny przebieg (z napraw) i poprawny koszt/km | S-02          | FR-007                               | implemented |
| S-05 | ai-classification | zobaczyć naprawę sklasyfikowaną przez AI i nadpisać kategorię ręcznie | S-02          | FR-004, FR-005, FR-011, US-01, US-02 | proposed |
| S-06 | service-reminders | zdefiniować progi serwisowe i widzieć przypomnienia na dashboardzie   | S-01          | FR-008, FR-009, US-03                | proposed |
| S-07 | cost-trend-chart        | zobaczyć wizualny wykres trendu kosztów/km per auto w czasie          | S-04          | FR-010                               | proposed |

## Streams

Navigation aid — grupuje pozycje ze wspólnym łańcuchem zależności. Kanoniczny porządek żyje w grafie zależności poniżej; ta tabela to proponowany porządek czytania przez równoległe tory.

| Stream | Temat                    | Łańcuch                                    | Uwaga                                                   |
| ------ | ------------------------ | ------------------------------------------ | ------------------------------------------------------- |
| A      | Dane + analityka kosztów | `S-01` → `S-02` → `S-03` / `S-04` / `S-08` → `S-07` | Główny tor; zawiera gwiazdę przewodnią S-04. S-08 naprawia obliczenia.  |
| B      | Przypomnienia serwisowe  | `S-01` → `S-06`                            | Parallel z `S-02`; nie blokuje toru A ani C.            |
| C      | Klasyfikacja AI          | `S-02` → `S-05`                            | Parallel z `S-03`, `S-04`; dołącza do toru A po `S-02`. |

## Baseline

Stan codebase na 2026-05-25 (auto-researched + potwierdzone). Slice'y poniżej zakładają że te elementy są obecne i NIE budują ich od nowa.

- **Frontend:** present — Astro 6 + React 19 + Tailwind 4 + shadcn/ui, file-based routing (`src/pages/`)
- **Backend / API:** partial — auth API endpoints only (`src/pages/api/auth/`), brak logiki biznesowej
- **Data:** partial — Supabase client wired for auth (`src/lib/supabase.ts`), brak schematu aplikacji, migracji, typów encji
- **Auth:** present — Supabase SSR, cookie sessions, middleware (`src/middleware.ts`), signin/signup/signout
- **Deploy / infra:** present — Dockerfile, docker-compose.prod.yml, CI lint+build+deploy (`.github/workflows/ci.yml`), Traefik labels
- **Observability:** absent — brak logowania, error tracking, metryk; tylko Docker healthcheck

## Foundations

Brak wymaganych fundamentów. Auth, frontend i deploy są obecne w baseline. Schemat bazy danych budowany pionowo — każdy slice tworzy własne migracje dla potrzebnych tabel z RLS.

## Slices

### S-01: Dodawanie auta

- **Outcome:** właściciel może dodać auto (marka, model, rok, przebieg bazowy) i zobaczyć je na liście swoich aut
- **Change ID:** add-vehicle
- **PRD refs:** FR-001, FR-002, US-01
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Schemat tabeli `cars` + RLS musi być projektowany z myślą o kolejnych slice'ach — błąd tu propaguje się dalej. Weryfikacja przez ręczne testy CRUD przed przejściem do S-02.
- **Status:** done

### S-02: Dodawanie naprawy

- **Outcome:** właściciel może dodać naprawę (data, opis tekstowy, koszt opcjonalny, przebieg w momencie naprawy) do wybranego auta
- **Change ID:** add-repair
- **PRD refs:** FR-003, US-01
- **Prerequisites:** S-01
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Tabela `repairs` z FK do `cars` + RLS. Koszt opcjonalny (NULL) musi być obsłużony poprawnie — naprawa bez kosztu pojawia się w historii ale nie wchodzi do koszt/km.
- **Status:** done

### S-03: Historia napraw

- **Outcome:** właściciel może przeglądać pełną historię napraw auta, edytować każdą naprawę i usunąć ją z potwierdzeniem
- **Change ID:** repair-history
- **PRD refs:** FR-006, US-01
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Usunięcie naprawy musi wyzwalać przeliczenie koszt/km (S-04). Implementacja S-03 bez S-04 w tej samej sesji może prowadzić do niespójności — dobrze zaplanować kolejność w `/10x-plan`.
- **Status:** done

### S-04: Koszt/km na dashboardzie

- **Outcome:** właściciel widzi liczbę koszt/km dla auta na jego dashboardzie, obliczoną ze wszystkich napraw z kosztem; liczba aktualizuje się natychmiast po dodaniu lub usunięciu naprawy
- **Change ID:** cost-per-km
- **PRD refs:** FR-007, US-01
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Formula `sum(koszt) / (aktualny_przebieg − baseline_przebieg)` wymaga edge-case'ów: baseline = aktualny (dzielenie przez 0), brak napraw z kosztem. Oba muszą być obsłużone w warstwie serwisowej zanim UI to wyświetli.
- **Status:** done

### S-08: Poprawne liczenie przebiegu i kosztu/km

- **Outcome:** aktualny przebieg auta pochodzi z `MAX(repairs.mileage)` a nie z pola `cars.current_mileage`; koszt/km = `sum(koszt) / (MAX(mileage) − baseline_mileage)`; oba widoki (lista aut, dashboard auta) pokazują poprawne wartości
- **Change ID:** fix-mileage-tracking
- **PRD refs:** FR-007
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Brak napraw (pusty `MAX`) musi być obsłużony — fallback na `baseline_mileage` lub null; koszt/km = null gdy km = 0.
- **Status:** implemented

### S-05: Klasyfikacja AI i nadpisanie kategorii

- **Outcome:** właściciel widzi naprawę automatycznie sklasyfikowaną do jednej z sześciu kategorii (silnik, hamulce, elektryka, ogumienie, przegląd, inne) i może nadpisać kategorię ręcznie
- **Change ID:** ai-classification
- **PRD refs:** FR-004, FR-005, FR-011, US-01, US-02
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - Który dostawca AI (Groq vs Gemini Flash)? Oba free-tier. Różnią się SDK, limitami, jakością klasyfikacji w języku polskim. — Owner: user. Block: no.
- **Risk:** Integracja z zewnętrznym API + obsługa timeout/fallback (3 s per FR-011). Jakość klasyfikacji po polsku nieznana do momentu pierwszych testów manualnych.
- **Status:** proposed

### S-06: Progi serwisowe i przypomnienia

- **Outcome:** właściciel może zdefiniować progi serwisowe per auto (typ serwisu, interwał km/dni, ostatnie wykonanie) i widzi przypomnienia na dashboardzie gdy zbliża się termin
- **Change ID:** service-reminders
- **PRD refs:** FR-008, FR-009, US-03
- **Prerequisites:** S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Logika marginów (km + dni) wymaga precyzyjnych testów jednostkowych — błąd w formule generuje fałszywe lub brakujące przypomnienia. Implementacja przed S-04 jest możliwa (zależy tylko od S-01), ale bez napraw trudno zweryfikować manualnie.
- **Status:** proposed

### S-07: Wykres trendu kosztów/km w czasie

- **Outcome:** właściciel może zobaczyć wizualny trend kosztów/km per auto (koszt kumulatywny na osi Y, data naprawy na osi X)
- **Change ID:** cost-trend-chart
- **PRD refs:** FR-010
- **Prerequisites:** S-04
- **Parallel with:** S-05, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Nice-to-have (PRD priority). Z celem `speed` i ~7-tygodniowym budżetem może nie zmieścić się w terminie — pierwsza kandydatura do zaparkowania jeśli S-01–S-06 zajmą więcej czasu niż planowane.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID         | Suggested issue title                                         | Ready for `/10x-plan` | Notes                                    |
| ---------- | ----------------- | ------------------------------------------------------------- | --------------------- | ---------------------------------------- |
| S-01       | add-vehicle           | Dodawanie auta — formularz + lista + migracja DB              | —   | done                                     |
| S-02       | add-repair            | Dodawanie naprawy do auta — formularz + migracja DB           | —   | done                                     |
| S-03       | repair-history        | Historia napraw — lista + edycja + usunięcie z potwierdzeniem | —   | done                                     |
| S-04       | cost-per-km           | Koszt/km na dashboardzie auta                                 | —   | done                                     |
| S-08       | fix-mileage-tracking  | Poprawne liczenie przebiegu i kosztu/km                       | —   | implemented; czeka na merge              |
| S-05       | ai-classification     | Klasyfikacja AI napraw + nadpisanie kategorii                 | yes | Czeka na S-02; wybór dostawcy AI otwarty |
| S-06       | service-reminders     | Progi serwisowe + przypomnienia na dashboardzie               | yes | Czeka na S-01; parallel z S-02           |
| S-07       | cost-trend-chart      | Wykres trendu kosztów/km w czasie                             | no  | Czeka na S-04; nice-to-have              |

## Open Roadmap Questions

1. **Wybór dostawcy klasyfikacji AI (Groq vs Gemini Flash)** — Owner: user. Block: S-05. Oba free-tier, różnią się SDK i jakością w języku polskim. Decyzja wymagana przed implementacją S-05.
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

| ID   | Change ID            | Merged | Notes                                    |
| ---- | -------------------- | ------ | ---------------------------------------- |
| S-01 | add-vehicle          | yes    | PR merged to main                        |
| S-02 | add-repair           | yes    | PR #15 merged to main                    |
| S-03 | repair-history       | yes    | PR #17 merged to main                    |
| S-04 | cost-per-km          | yes    | PR #16 merged to main                    |
| S-08 | fix-mileage-tracking | no     | Implemented on feature branch; not yet merged |

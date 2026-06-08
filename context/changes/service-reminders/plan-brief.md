# Service Reminders — Plan Brief

> Full plan: `context/changes/service-reminders/plan.md`

## What & Why

Użytkownicy definiują progi serwisowe per pojazd (nazwa, interwał km/dni, ostatnie wykonanie). Aplikacja kalkuluje status (overdue/approaching/ok) i wyświetla przypomnienia na dashboardzie pojazdu — rozwiązując core problem produktu: "nie przegap terminu serwisu".

## Starting Point

Codebase ma kompletne warstwy dla pojazdów i napraw (DB, API, UI). Brak jakiejkolwiek logiki przypomnień — feature budujemy od zera na sprawdzonym wzorcu: migracja + RLS → Zod + API → lib utility → React islands.

## Desired End State

Użytkownik wchodzi na dashboard pojazdu i widzi banner z czerwonymi/żółtymi kartami dla serwisów wymagających uwagi. Poniżej statystyk — sekcja "Service Thresholds" z pełnym CRUDem. Serwisy bez last_performed natychmiast pokazują się jako overdue.

## Key Decisions Made

| Decision            | Choice                                 | Why (1 sentence)                                    | Source |
| ------------------- | -------------------------------------- | --------------------------------------------------- | ------ |
| Typ serwisu         | Free-text nazwa                        | Elastyczność — obsługuje dowolny typ serwisu        | Plan   |
| Interwały           | Km LUB dni (co nastąpi pierwsze)       | Zgodne z realną mechaniką serwisową                 | Plan   |
| Punkt startowy      | Data + przebieg przy ostatnim serwisie | Wymagane do kalkulacji obu typów interwałów         | Plan   |
| Alert margin        | 10% interwału km lub 30 dni            | Prosty, przewidywalny, bez konfiguracji usera       | Plan   |
| UX zarządzania      | Sekcja na dashboardzie pojazdu         | Wszystko w jednym miejscu, zero nowej nawigacji     | Plan   |
| CRUD scope          | Pełny CRUD (Create+Read+Update+Delete) | Edycja jest częstą operacją przy korygowaniu progów | Plan   |
| Alert UX            | Banner/karta nad listą napraw          | Nie można przeoczyć, naturalny flow strony          | Plan   |
| Brak last_performed | Status = overdue natychmiast           | Motywuje uzupełnienie historii serwisowej           | Plan   |

## Scope

**In scope:**

- Tabela `service_thresholds` z RLS
- POST/PUT/DELETE API endpoints
- `computeReminderStatus()` utility
- Banner przypomnień na dashboardzie pojazdu
- CRUD UI: AddServiceThresholdForm, EditServiceThresholdForm, ServiceThresholdList

**Out of scope:**

- Push/email notyfikacje
- Szablony progów per model auta
- Historia wykonania serwisów
- Automatyczna aktualizacja `last_performed` po dodaniu naprawy
- Badge na karcie pojazdu na liście pojazdów

## Architecture / Approach

Nowa tabela `service_thresholds` (FK → cars, FK → auth.users, RLS). Kalkulacja statusu w `src/lib/serviceReminders.ts` (pure TS, bez side-effects). UI w `src/components/service-reminders/`. Dashboard Astro (`[id].astro`) fetche progi SSR, liczy statusy, przekazuje do komponentów React jako props.

## Phases at a Glance

| Phase             | What it delivers                                        | Key risk                                                   |
| ----------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| 1. DB + Types     | Tabela, RLS, interface TS                               | Constraint CHECK musi być aktywny przed insertem przez API |
| 2. API Endpoints  | POST/PUT/DELETE z walidacją Zod                         | Sprawdzenie car ownership przy create                      |
| 3. Reminder Logic | `computeReminderStatus()` + `computeThresholdSummary()` | Edge case: jeden interwał null, drugi set                  |
| 4. UI + Dashboard | Pełny UI + integracja na dashboardzie                   | Brak regresji w istniejących sekcjach                      |

**Prerequisites:** Działający lokalny Supabase lub cloud project  
**Estimated effort:** ~2-3 sesje, 4 fazy

## Open Risks & Assumptions

- `computeCurrentMileage()` może zwrócić `baseline_mileage` gdy brak napraw — logika km działa poprawnie (last_performed_mileage może być > currentMileage jeśli naprawy nie były dodane)
- Brak automatycznego testu jednostkowego dla `computeReminderStatus` — weryfikacja manualna

## Success Criteria (Summary)

- Banner pokazuje czerwone karty dla overdue i żółte dla approaching
- Pełny CRUD progów działa bez regresji w historii napraw i koszt/km
- Progi izolowane per user przez RLS

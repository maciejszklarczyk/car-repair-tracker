---
title: "Car Repair Tracker — Domain Distillation"
created: 2026-06-28
type: domain-distillation
---

# Car Repair Tracker — Mapa Domeny

## KROK 0 — Kontekst projektu

### Źródła

| Źródło | Ścieżka | Status |
|--------|---------|--------|
| PRD | `context/foundation/prd.md` | Pełny dokument — główne źródło domenowe |
| Shape Notes | `context/foundation/shape-notes.md` | Dostępne, cytaty PRD pokrywają zakres |
| README | `README.md` | Techniczny opis stosu i komend |
| Typy | `src/types.ts` | Trzy główne encje |
| Logika biznesowa | `src/lib/costPerKm.ts`, `src/lib/serviceReminders.ts`, `src/lib/repairCategories.ts`, `src/lib/classifyRepair.ts` | Cała logika obliczeniowa |
| API | `src/pages/api/repairs.ts`, `src/pages/api/repairs/[id].ts` | Walidacja + orkiestracja |
| Migracje DB | `supabase/migrations/` — 7 plików | Schemat i RLS policies |

### Stack i struktura

- **Rendering:** Astro 6 SSR + React 19 islands (pełne SSR, bez SPA)
- **Persystencja:** Supabase Postgres z Row Level Security
- **Klasyfikacja AI:** Google Gemini 2.5 Flash-Lite (3 s timeout, tryb degraded → `pending`)
- **Warstwy kodu:**
  - `src/lib/` — logika obliczeniowa (bez zależności od frameworka)
  - `src/pages/api/` — HTTP endpoints (walidacja Zod + orkiestracja Supabase)
  - `src/types.ts` — współdzielone typy encji
  - `supabase/migrations/` — schemat + polityki bezpieczeństwa
- **Brak warstwy domeny jako osobnej abstrakcji** — logika rozrzucona między `src/lib/` a `src/pages/api/`

---

## KROK 1 — Ubiquitous Language

### Glossary

| Termin | Definicja | Cytat ze źródła | Kod (plik:linia) |
|--------|-----------|-----------------|------------------|
| **Pojazd** (`Vehicle`) | Samochód osobisty właściciela, punkt skupienia historii napraw i kosztów | PRD § FR-002: „Owner can add, edit, and archive a car (marka, model, rok, aktualny przebieg, baseline przebieg)" | `src/types.ts:29` — `interface Vehicle` |
| **Naprawa** (`Repair`) | Zdarzenie serwisowe powiązane z pojazdem; ma datę, opis, opcjonalny koszt i przebieg w momencie zdarzenia | PRD § FR-003: „Owner can add a repair (data, opis tekstowy, koszt — may be left blank, przebieg w momencie naprawy, pojazd)" | `src/types.ts:1` — `interface Repair` |
| **Przebieg bazowy** (`baseline_mileage`) | Przebieg auta w momencie, gdy właściciel zaczął prowadzić rejestr — punkt zerowy do obliczania kosztu/km | PRD § FR-002: „baseline przebieg = przebieg at the moment record-keeping began for that car" | `src/types.ts:36`, `supabase/migrations/20260526120000_create_cars_table.sql:8` |
| **Przebieg bieżący** (`current_mileage`) | Najwyższy przebieg odnotowany wśród napraw, nigdy poniżej bazowego | PRD § US-01: „aktualny przebieg 145 000"; PRD § FR-002: „aktualny przebieg" jako pole auta | `src/lib/costPerKm.ts:3-6` — `computeCurrentMileage()` (obliczany, nie przechowywany) |
| **Koszt-za-kilometr** (`cost_per_km`) | Suma kosztów napraw z podanym kosztem podzielona przez kilometry przejechane od przebiegу bazowego | PRD § FR-007: `sum(koszt where koszt is recorded) / max(0, aktualny przebieg − baseline przebieg)` | `src/lib/costPerKm.ts:8-14` — `computeCostPerKm()` |
| **Kategoria naprawy** (`RepairCategory`) | Jedna z sześciu klas: `silnik`, `hamulce`, `elektryka`, `ogumienie`, `przegląd`, `inne` — system ją przypisuje, właściciel może zmienić | PRD § FR-004: „System assigns each repair to exactly one of {silnik, hamulce, elektryka, ogumienie, przegląd, inne}" | `src/lib/repairCategories.ts:1-2` |
| **Klasyfikacja AI** | Automatyczne przypisanie kategorii przez Gemini na podstawie opisu naprawy; nie może blokować zapisu | PRD § FR-004, FR-011: „Classification completes within a few seconds; if it does not, the repair is still saved with category `pending`" | `src/lib/classifyRepair.ts:18-42` — `classifyRepair()`, timeout 3 s |
| **Stan kategorii** (`category_source`) | Wewnętrzna flaga źródła kategorii: `"ai"` / `"manual"` / `"pending"` | PRD Open Question #4 (przechowywanie oryginału), nie nazwana explicite w PRD | `src/types.ts:10` — `category_source`, `src/pages/api/repairs/[id].ts:170` |
| **Oryginalna kategoria** (`original_category`) | Kategoria przypisana przez AI przed ewentualnym nadpisaniem przez właściciela | PRD Open Question #4: „Whether to retain the original auto-assigned category alongside the owner's override" | `src/types.ts:11`, `supabase/migrations/20260610120000_add_repair_category.sql:4` |
| **Nadpisanie kategorii** (Category Override) | Jawna zmiana kategorii przez właściciela; ustawia `category_source = "manual"`, nadpisuje `category` | PRD § FR-005: „Owner can override the assigned repair category to any of the six categories. The override is persisted and is the value used downstream." | `src/pages/api/repairs/[id].ts:160-178` — PATCH endpoint |
| **Próg serwisowy** (`ServiceThreshold`) | Reguła przypomnienia per pojazd: interwał km i/lub dni, data i przebieg ostatniego wykonania | PRD § FR-008: „Owner can define service thresholds per car (typ serwisu, interwał_km and/or interwał_dni, last_done_date, last_done_przebieg)" | `src/types.ts:16-27`, `supabase/migrations/20260608120000_create_service_thresholds_table.sql` |
| **Status przypomnienia** (`ReminderStatus`) | Stan progu: `"overdue"` (minął), `"approaching"` (zbliża się), `"ok"` (bezpieczny) | PRD § FR-009: „A reminder is surfaced for a threshold when current przebieg ≥ (last_done_przebieg + interwał_km − margin_km)" | `src/lib/serviceReminders.ts:3-4` — `type ReminderStatus` |
| **Margines ostrzeżenia** (Warning Margin) | Wyprzedzenie, przy którym próg serwisowy zmienia status z `ok` na `approaching` | PRD § FR-009: „Owner can configure a personal warning margin (e.g. 1 000 km / 14 days)" | **BRAK w kodzie** — hardcoded 10% km (`serviceReminders.ts:36`) i 30 dni (`serviceReminders.ts:46`) |
| **Archiwizacja pojazdu** (`archived_at`) | Ukrycie auta i jego danych z aktywnych widoków bez trwałego usunięcia; restorable | PRD § FR-002: „Archiving hides the car and its repairs/reminders from active listings and from cost-per-km, but the record remains restorable." | `src/types.ts:35` — pole `archived_at`; przywracanie **BRAK w kodzie** |
| **Stan `pending`** | Tymczasowa wartość `category`, gdy klasyfikacja AI nie zdążyła lub nie powiodła się | PRD § FR-011: „the repair is still saved with category `pending`" | `src/pages/api/repairs.ts:53` — `category = classified ?? "pending"` |
| **Właściciel** (`Owner`) | Jedyna rola w systemie; widzi wyłącznie swoje pojazdy, naprawy i progi | PRD § Access Control: „The role model is flat: every authenticated owner sees and manages only their own cars, repairs, thresholds, and reminders." | `supabase/migrations/` — polityki RLS: `auth.uid() = user_id` |

---

## KROK 2 — Subdomeny: Core / Supporting / Generic

| Obszar | Klasyfikacja | Uzasadnienie |
|--------|-------------|--------------|
| **Koszt-za-km i trendy kosztowe** | **Core** | To właśnie stanowi przewagę — PRD Vision: „converts a heap of invoices into a single number that informs the keep-or-sell decision". Success Criteria primary. |
| **Automatyczna klasyfikacja napraw** | **Core** | PRD § FR-004 Socratic: „automatic classification is the domain rule that distinguishes the product from a spreadsheet". Bez niej to tylko notatnik. |
| **Progi serwisowe i przypomnienia** | **Core** | PRD Vision: „surfaces upcoming service events before they are missed". Success Criteria primary: „see a reminder for any upcoming service". |
| **Historia napraw** | **Core** | Fundament dla wszystkich obliczeń — bez napraw nie ma kosztu/km ani przypomnień. FR-003, FR-006. |
| **Zarządzanie pojazdami** | **Supporting** | Enabling enabler dla Core — pojazd to kontener, nie wartość sama w sobie. Archiwizacja to operacja zarządcza, nie domenowa. |
| **Nadpisanie kategorii** | **Supporting** | Korekta błędów AI — Supporting, bo działa wyłącznie gdy Core (klasyfikacja) zawiedzie lub jest niedokładna. FR-005. |
| **Autentykacja i autoryzacja** | **Generic** | Email + password, multi-tenant izolacja przez RLS. Standardowy wzorzec, zaimplementowany przez Supabase. PRD non-goal: „no admin role". |
| **Demo Mode / Seed** | **Generic** | `src/lib/demo-seed.ts` — infrastruktura demonstracyjna, zero wartości domenowej. |
| **Sentry / Error tracking** | **Generic** | Zewnętrzny narzędzie, nie dziedzina biznesowa. |

---

## KROK 3 — Kandydaci na agregaty i ich niezmienniki

### Agregat: `Vehicle` (Pojazd)

**Niezmiennik 1 — Przebieg naprawy ≥ przebieg bazowy**
> PRD § US-01: „aktualny przebieg 145 000, baseline przebieg 142 000" implikuje, że naprawa przy 144 800 jest poprawna. Implicite: żadna naprawa nie może mieć przebiegu niższego niż baseline.

- **Kod egzekwuje:** `src/pages/api/repairs.ts:46-50` — check aplikacyjny przed zapisem
- **Baza danych:** brak DB constraint — sprawdzenie tylko w warstwie API

**Niezmiennik 2 — Próg serwisowy wymaga co najmniej jednego interwału**
> PRD § FR-008: „interwał_km and/or interwał_dni" — przynajmniej jedno musi być podane

- **Kod egzekwuje:** `supabase/migrations/20260608120000_create_service_thresholds_table.sql:13` — `constraint at_least_one_interval check (km_interval is not null or days_interval is not null)`
- **Kod egzekwuje:** `src/lib/schemas.ts:34-37` — zod refine

**Niezmiennik 3 — Pojazd można archiwizować, nie usuwać (jeśli istnieją naprawy)**
> PRD § FR-002: „archive instead of destructive removal; cost-per-km respects the archive flag"

- **Kod deklaruje:** `archived_at` timestamptz (pole nullable), filtr `is("archived_at", null)` w `vehiclePageData.ts:43`
- **Kod ignoruje:** brak operacji `restore` — FR-002 mówi „the record remains restorable" ale kod nie implementuje przywracania

### Agregat: `Repair` (Naprawa)

**Niezmiennik 4 — Kategoria jest zawsze obecna (choćby jako `pending`)**
> PRD § FR-011: „the repair is still saved with category `pending`" — kategoria nigdy nie może być NULL po zapisie

- **Kod egzekwuje częściowo:** `src/pages/api/repairs.ts:53` — `category = classified ?? "pending"` przy tworzeniu
- **Baza ignoruje:** kolumna `category text` (nullable) w DB — `supabase/migrations/20260610120000_add_repair_category.sql:2`; brak NOT NULL constraint
- **Rozbieżność:** istniejące naprawy (przed migracją) mogą mieć `category IS NULL`; kod obsługuje to tylko przez `category == null` check w `[id].ts:72`

**Niezmiennik 5 — Nadpisanie kategorii zachowuje oryginalną klasyfikację AI**
> PRD Open Question #4 rozstrzygnięty w kodzie: `original_category` przechowuje wartość przed nadpisaniem

- **Kod egzekwuje:** `src/pages/api/repairs/[id].ts:166-170` — PATCH ustawia `category` i `category_source: "manual"`, ale **NIE aktualizuje** `original_category`
- **Kod przy tworzeniu:** `src/pages/api/repairs.ts:63` — `original_category: category` (wartość AI lub "pending")

**Niezmiennik 6 — Naprawa bez kosztu jest wykluczona z cost-per-km**
> PRD § FR-003: „Repairs without a koszt value (e.g. gwarancja, naprawa darmowa) are recorded but excluded from cost-per-km aggregation."

- **Kod egzekwuje:** `src/lib/costPerKm.ts:11` — `r.cost ?? 0` w reduce (koszty null traktowane jako 0)
- **Uwaga:** formuła nie wyklucza ich z mianownika (km) — tylko z licznika; zgodnie z PRD FR-007

### Agregat: `ServiceThreshold` (Próg serwisowy)

**Niezmiennik 7 — Margines ostrzeżenia jest zdefiniowany i konfigurowalny**
> PRD § FR-009: „Owner can configure a personal warning margin (e.g. 1 000 km / 14 days)"

- **Baza ignoruje:** brak tabeli/kolumny dla margin w DB
- **Kod ignoruje:** `src/lib/serviceReminders.ts:36` — `km_remaining <= km_interval * 0.1` (hardcoded 10%), `src/lib/serviceReminders.ts:46` — `days_remaining <= 30` (hardcoded 30 dni)
- **Status: KRYTYCZNA ROZBIEŻNOŚĆ** — FR-009 to `must-have`, brak implementacji

---

## KROK 4 — Rozjazdy MODEL vs KOD

| # | Dokument mówi | Kod robi | Dowód (plik:linia) | Waga |
|---|---------------|----------|-------------------|------|
| **R1** | FR-009: „Owner can configure a personal warning margin" (must-have) | Margines hardcoded: 10% km_interval i 30 dni | `src/lib/serviceReminders.ts:36` — `km_interval * 0.1`; `serviceReminders.ts:46` — `days_remaining <= 30` | **KRYTYCZNA** — niespełniony must-have FR |
| **R2** | FR-002: „aktualny przebieg" jako pole pojazdu (US-01 wylicza 145 000 jako atrybut auta) | Przebieg bieżący obliczany z napraw (`computeCurrentMileage`); kolumna `current_mileage` usunięta | `supabase/migrations/20260602140000_drop_cars_current_mileage.sql:1`; `src/lib/costPerKm.ts:3-6` | Średnia — skutek zgodny z PRD, ale kontrakt pojazdu się zmienił |
| **R3** | FR-002: archiwizacja jest „restorable" | Brak endpoint/akcji przywracania pojazdu; tylko ukrywanie przez filtr `is(archived_at, null)` | `src/lib/services/vehiclePageData.ts:43`; brak `PATCH /api/vehicles/[id]` przywracającego `archived_at = null` w żadnym pliku | Wysoka — half-baked feature |
| **R4** | FR-004: kategorie to {silnik, hamulce, elektryka, ogumienie, przegląd, inne} (zamknięty enum) | Wartość `"pending"` zapisywana do kolumny `category` jako quasi-kategoria | `src/pages/api/repairs.ts:53`; `REPAIR_CATEGORIES` w `repairCategories.ts:1` nie zawiera `"pending"`; kolumna `category text` bez CHECK constraint | Niska-średnia — semantyczne zanieczyszczenie enum |
| **R5** | Niezmiennik: naprawa musi mieć przebieg ≥ baseline_mileage | Walidacja tylko w warstwie API; brak DB constraint | `src/pages/api/repairs.ts:46-50` (app check); `supabase/migrations/20260531120000_create_repairs_table.sql` — brak CHECK | Niska — aplikacja chroni, ale DB nie |
| **R6** | Kategoria nigdy nie powinna być NULL po zapisie (FR-011: zawsze `pending` gdy AI zawiedzie) | Kolumna `category` w DB jest nullable; nie-NULL tylko z gwarancji kodu | `supabase/migrations/20260610120000_add_repair_category.sql:2` — `ADD COLUMN category text` (nullable) | Niska — historyczne rekordy mogą mieć NULL |
| **R7** | PRD § US-02: „the original assignment is not surfaced to the owner" (po override) | `original_category` przechowywane i dostępne przez API; TypeScript type eksponuje pole | `src/types.ts:11` — `original_category: string \| null`; brak ukrywania w odpowiedziach API | Informacyjna — nie buguje UX, ale leakuje szczegóły impl. |

---

## KROK 5 — Ranking refaktoru

### Tabela priorytetyzacji

| Rank | Kandydat | Rdzeniowość | Jakość egzekucji dziś | Score |
|------|----------|-------------|----------------------|-------|
| **#1** | `ServiceReminder.warningMargin` — konfigurowalny margines | Core (FR-009 must-have) | Hardcoded constant, brak encji | KRYTYCZNY |
| **#2** | `Vehicle.archived_at` — przywracanie z archiwum | Supporting (FR-002 must-have) | Połowiczna impl., brak restore | WYSOKI |
| **#3** | `Repair.category` — NOT NULL na poziomie DB + CHECK constraint | Core (FR-011 guardrail) | Tylko gwarancja aplikacyjna | ŚREDNI |
| **#4** | `Repair.mileage >= baseline_mileage` — DB constraint | Core invariant | Tylko walidacja API | NISKI |
| **#5** | `"pending"` jako quasi-kategoria poza enum | Core (czystość modelu) | Semantyczne, nie funkcjonalne | NISKI |

### Rekomendacja #1: Konfigurowalny margines ostrzeżenia

**Dlaczego #1:** FR-009 to `must-have` — brak implementacji konfigurowalnego marginesu to niespełniony wymóg produktowy, nie opcja. Jednocześnie `ServiceThreshold` to serce subdeny Core (progi serwisowe). Dziś każdy użytkownik ma identyczny, arbitralny margines (10%/30d), co oznacza, że PRD's success criterion „see a reminder for any upcoming service whose threshold is approaching" działa, ale nie tak jak właściciel zdefiniował.

**Zakres refaktoru:**
1. Dodać kolumnę `warning_km` i/lub `warning_days` do `service_thresholds` LUB kolumnę `warning_km` / `warning_days` na poziomie profilu użytkownika (per PRD: „personal warning margin")
2. Przekazać wartości do `computeReminderStatus()` zamiast stałych (`serviceReminders.ts:36,46`)
3. Zaktualizować `createServiceThresholdSchema` / `updateServiceThresholdSchema` lub dodać endpoint profilu

**Obecny impact na niezmiennik:** `src/lib/serviceReminders.ts:36-37` — reguła `km_remaining <= km_interval * 0.1` i `days_remaining <= 30` zastępuje konfigurowalny margines właściciela stałą. PRD US-03 podaje przykład marginesu 1 000 km; kod by go zignorował.

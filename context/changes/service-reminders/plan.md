# Service Reminders Implementation Plan

## Overview

Implementujemy progi serwisowe per pojazd: użytkownik definiuje nazwę serwisu, interwał w km i/lub dniach oraz dane ostatniego wykonania. Aplikacja kalkuluje status (overdue/approaching/ok) i wyświetla przypomnienia jako banner na dashboardzie pojazdu. Sekcja zarządzania progami pojawia się na tym samym dashboardzie.

## Current State Analysis

Brak jakiejkolwiek logiki przypomnień. Codebase dostarcza:
- Tabele `cars` i `repairs` z RLS (wzorzec do powielenia)
- `computeCurrentMileage()` w `src/lib/costPerKm.ts` — aktualne km z `MAX(repairs.mileage)`
- Dashboard pojazdu: `src/pages/dashboard/vehicles/[id].astro` — punkt integracji
- Zod schemas w `src/lib/schemas.ts` (wzorzec walidacji API)
- React islands dla interaktywnych komponentów (`RepairList`, `AddRepairForm`)

## Desired End State

Użytkownik wchodzi na dashboard pojazdu (`/dashboard/vehicles/[id]`) i widzi:
1. Banner z czerwonymi/żółtymi kartami dla serwisów wymagających uwagi (nad historią napraw)
2. Sekcję "Service Thresholds" z listą progów + przycisk dodania nowego
3. Pełny CRUD progów (dodaj, edytuj, usuń z potwierdzeniem)

### Key Discoveries

- Aktualny przebieg: `src/lib/costPerKm.ts:computeCurrentMileage()` — wymagany do kalkulacji km do serwisu
- RLS wzorzec (repairs): `user_id = auth.uid()` dla select/update/delete, `car_id IN (SELECT id FROM cars WHERE user_id = auth.uid())` dla insert — powielić
- API wzorzec: `src/pages/api/repairs.ts` + `src/pages/api/repairs/[id].ts` — ten sam kształt dla service-thresholds
- Brak `current_mileage` na tabeli `cars` — przebieg pochodzi wyłącznie z napraw

## What We're NOT Doing

- Push/email notyfikacje — tylko widok in-app
- Szablony progów per model auta — user definiuje ręcznie
- Historia wykonania serwisów — tylko ostatnie wykonanie
- Filtrowanie/sortowanie progów
- Automatyczna aktualizacja `last_performed` po dodaniu naprawy

## Implementation Approach

Pionowo przez warstwy: DB → API → logika → UI. Każda faza jest self-contained i weryfikowalna przed przejściem dalej. Logika kalkulacji żyje w dedykowanym module `src/lib/serviceReminders.ts` (oddzielona od UI, testowalana izolowanie). Komponenty UI w nowym folderze `src/components/service-reminders/`.

## Critical Implementation Details

- **Alert margin (km):** 10% interwału km. Dla `km_interval = null` — pomiń kalkulację km.
- **Alert margin (dni):** stałe 30 dni. Dla `days_interval = null` — pomiń kalkulację dni.
- **Brak last_performed (oba pola null):** status = `overdue` natychmiast — traktuj jako "nigdy niewykonany".
- **Priorytet statusu:** `overdue` > `approaching` > `ok`. Jeśli km mówi `ok` ale dni mówi `approaching` → `approaching`.
- **Constraint DB:** `CHECK (km_interval IS NOT NULL OR days_interval IS NOT NULL)` — co najmniej jeden interwał musi być podany.

---

## Phase 1: DB + Types

### Overview

Tworzy tabelę `service_thresholds` z RLS i dodaje `ServiceThreshold` interface do typów.

### Changes Required

#### 1. Migration: create service_thresholds table

**File:** `supabase/migrations/20260608120000_create_service_thresholds_table.sql`

**Intent:** Nowa tabela przechowująca progi serwisowe per pojazd z RLS identycznym jak tabela `repairs`.

**Contract:**
```sql
CREATE TABLE public.service_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  km_interval integer,
  days_interval integer,
  last_performed_date date,
  last_performed_mileage integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT at_least_one_interval CHECK (
    km_interval IS NOT NULL OR days_interval IS NOT NULL
  )
);
```
RLS policies (4) — wzorzec z `20260531120000_create_repairs_table.sql:20-26`:
```sql
-- select_own
create policy service_thresholds_select_own on public.service_thresholds
  for select using (auth.uid() = user_id);

-- insert_own (dual check: user_id + car ownership)
create policy service_thresholds_insert_own on public.service_thresholds
  for insert with check (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.cars WHERE id = car_id AND user_id = auth.uid()
    )
  );

-- update_own
create policy service_thresholds_update_own on public.service_thresholds
  for update using (auth.uid() = user_id);

-- delete_own
create policy service_thresholds_delete_own on public.service_thresholds
  for delete using (auth.uid() = user_id);
```

#### 2. TypeScript interface

**File:** `src/types.ts`

**Intent:** Dodać `ServiceThreshold` interface równoległy do `Vehicle` i `Repair`.

**Contract:**
```typescript
export interface ServiceThreshold {
  id: string;
  car_id: string;
  user_id: string;
  name: string;
  km_interval: number | null;
  days_interval: number | null;
  last_performed_date: string | null;  // ISO date string
  last_performed_mileage: number | null;
  created_at: string;
  updated_at: string;
}
```

### Success Criteria

#### Automated Verification

- Migration aplikuje się czysto: `npx supabase db reset` (lokalnie)
- TypeScript nie zgłasza błędów: `npm run build`

#### Manual Verification

- Tabela `service_thresholds` widoczna w Supabase Studio
- RLS blokuje dostęp między różnymi użytkownikami (weryfikacja ręczna lub SQL)
- Constraint `at_least_one_interval` odrzuca rekord z `km_interval=null, days_interval=null`

**Pauza po fazie 1 i manualnej weryfikacji DB.**

---

## Phase 2: API Endpoints

### Overview

Nowe endpointy CRUD dla progów serwisowych: POST create, PUT update, DELETE delete. Read odbywa się przez stronę Astro (SSR).

### Changes Required

#### 1. Zod schemas

**File:** `src/lib/schemas.ts`

**Intent:** Dodać `createServiceThresholdSchema` i `updateServiceThresholdSchema` do istniejącego pliku.

**Contract:**
- `createServiceThresholdSchema`: pola `car_id` (uuid), `name` (string, min 1), `km_interval` (int positive, optional), `days_interval` (int positive, optional), `last_performed_date` (ISO date string, optional), `last_performed_mileage` (int non-negative, optional). Refinement: co najmniej jedno z `km_interval`/`days_interval` musi być podane.
- `updateServiceThresholdSchema`: te same pola co create, wszystkie optional (partial update).

#### 2. POST endpoint — create

**File:** `src/pages/api/service-thresholds.ts`

**Intent:** Tworzy nowy próg serwisowy dla pojazdu należącego do zalogowanego użytkownika.

**Contract:** `export const prerender = false` (konwencja projektu — zgodnie z `src/pages/api/repairs.ts:5`). `export const POST` — walidacja Zod, sprawdzenie własności pojazdu (`car_id` należy do `user.id`), insert do `service_thresholds`, zwraca 201 z nowym rekordem. Wzorzec identyczny z `src/pages/api/repairs.ts`.

#### 3. PUT + DELETE endpoint — update + delete

**File:** `src/pages/api/service-thresholds/[id].ts`

**Intent:** Aktualizuje lub usuwa próg serwisowy. Weryfikacja własności przez RLS (user_id = auth.uid() w WHERE).

**Contract:** `export const prerender = false` (konwencja projektu — zgodnie z `src/pages/api/repairs/[id].ts:5`). `export const PUT` — walidacja `updateServiceThresholdSchema` (partial update). Buduj update object tylko z pól present w validated body: filtruj klucze gdzie wartość !== undefined przed przekazaniem do `.update()` — nie używaj full-replace pattern z repairs (gdzie wszystkie pola są wymagane), bo optional pola zostałyby zapisane jako null. `export const DELETE` — delete gdzie `id = params.id AND user_id = user.id`.

### Success Criteria

#### Automated Verification

- `npm run build` bez błędów TypeScript/ESLint
- POST `/api/service-thresholds` z valid body → 201
- POST z `km_interval=null, days_interval=null` → 400
- PUT `/api/service-thresholds/[id]` z obcym `id` → 404 lub 0 rows affected
- DELETE `/api/service-thresholds/[id]` → 204

#### Manual Verification

- Tworzenie progu przez Insomnia/curl z tokenem auth
- Edycja istniejącego progu
- Próba usunięcia cudzego progu → błąd

**Pauza po fazie 2.**

---

## Phase 3: Reminder Calculation Logic

### Overview

Moduł kalkulujący status przypomnienia dla pojedynczego progu. Czysty TypeScript bez zależności od UI.

### Changes Required

#### 1. Reminder status module

**File:** `src/lib/serviceReminders.ts`

**Intent:** Eksportować `computeReminderStatus()` i `computeThresholdSummary()` — logika decydująca kiedy wyświetlić alert.

**Contract:**

```typescript
export type ReminderStatus = 'overdue' | 'approaching' | 'ok';

export interface ThresholdWithStatus {
  threshold: ServiceThreshold;
  status: ReminderStatus;
  km_remaining: number | null;   // null gdy brak danych km
  days_remaining: number | null; // null gdy brak danych dni
}

export function computeReminderStatus(
  threshold: ServiceThreshold,
  currentMileage: number,
  today: Date
): ReminderStatus

export function computeThresholdSummary(
  thresholds: ServiceThreshold[],
  currentMileage: number
): ThresholdWithStatus[]
```

Logika `computeReminderStatus`:
1. Brak `last_performed_date` I brak `last_performed_mileage` → `'overdue'`
2. Kalkulacja km (gdy `km_interval` i `last_performed_mileage` niepuste): `km_remaining = (last_performed_mileage + km_interval) - currentMileage`; jeśli ≤ 0 → overdue; jeśli ≤ `km_interval * 0.10` → approaching
3. Kalkulacja dni (gdy `days_interval` i `last_performed_date` niepuste): `days_remaining = days_interval - daysBetween(last_performed_date, today)`; jeśli ≤ 0 → overdue; jeśli ≤ 30 → approaching
4. Priorytet: `overdue` > `approaching` > `ok`

### Success Criteria

#### Automated Verification

- `npm run build` bez błędów TypeScript

> Note: ta faza weryfikowana głównie manualnie — `computeReminderStatus` jest pure function, ale projekt nie ma test runnera na MVP. Edge case'y poniżej.

#### Manual Verification

- `computeReminderStatus` z `last_performed_mileage=null, last_performed_date=null` → `'overdue'`
- Próg km z `km_remaining = -100` → `'overdue'`
- Próg km z `km_remaining = 500`, `km_interval = 10000` → `'ok'` (500 > 1000 threshold)
- Próg km z `km_remaining = 900`, `km_interval = 10000` → `'approaching'` (900 < 1000)
- Próg dni z `days_remaining = 15` → `'approaching'`

**Pauza po fazie 3.**

---

## Phase 4: UI Components + Dashboard Integration

### Overview

Cztery komponenty React + aktualizacja strony Astro dashboardu. Banner przypomnień pojawia się tylko gdy są overdue/approaching. Sekcja zarządzania progami poniżej statystyk.

### Changes Required

#### 1. AddServiceThresholdForm

**File:** `src/components/service-reminders/AddServiceThresholdForm.tsx`

**Intent:** Formularz dodawania nowego progu — POST do `/api/service-thresholds`, po sukcesie reload strony z `?success=threshold_added`.

**Contract:** Props: `carId: string`. Pola: `name` (text), `km_interval` (number, optional), `days_interval` (number, optional), `last_performed_date` (date input, optional), `last_performed_mileage` (number, optional). Client-side walidacja: co najmniej jedno z km/days wymagane. Wzorzec jak `AddRepairForm.tsx`.

#### 2. EditServiceThresholdForm

**File:** `src/components/service-reminders/EditServiceThresholdForm.tsx`

**Intent:** Formularz edycji progu — PUT do `/api/service-thresholds/[id]`, po sukcesie reload z `?success=threshold_updated`. Pre-populate z istniejących wartości.

**Contract:** Props: `threshold: ServiceThreshold`. Ta sama struktura co AddServiceThresholdForm.

#### 3. ServiceThresholdList

**File:** `src/components/service-reminders/ServiceThresholdList.tsx`

**Intent:** Lista progów z statusem, przyciskami Edit (inline form toggle) i Delete (z confirmation dialog). Wzorzec jak `RepairList.tsx`.

**Contract:** Props: `thresholds: ThresholdWithStatus[]`. Każda pozycja: nazwa, interwał (km i/lub dni), last performed, status badge (zielony/żółty/czerwony), przyciski Edit/Delete. Delete z `AlertDialog` (pattern z `ui/alert-dialog.tsx`).

#### 4. ServiceReminders (banner)

**File:** `src/components/service-reminders/ServiceReminders.tsx`

**Intent:** Banner wyświetlający tylko progi ze statusem `overdue` lub `approaching`. Ukryty gdy wszystko `ok`.

**Contract:** Props: `thresholds: ThresholdWithStatus[]`. Renderuje kolorowe karty: czerwone dla `overdue`, żółte dla `approaching`. Każda karta: nazwa serwisu, ile km/dni pozostało (lub przekroczono). Brak alertów → komponent nie renderuje nic (`return null`).

#### 5. Dashboard page integration

**File:** `src/pages/dashboard/vehicles/[id].astro`

**Intent:** Dociągnąć `service_thresholds` dla pojazdu, skalkulować statusy, przekazać do bannerowego i listowego komponentu.

**Contract:**
- W sekcji fetch danych (obok zapytań o `cars` i `repairs`): dodać query `SELECT * FROM service_thresholds WHERE car_id = vehicleId ORDER BY created_at ASC`
- Kalkulacja: `const thresholdSummary = computeThresholdSummary(thresholds, currentMileage)` (import z `@/lib/serviceReminders`)
- Layout:
  1. Statystyki (bez zmian)
  2. `<ServiceReminders thresholds={thresholdSummary} client:load />` — przed historią napraw
  3. Nowa sekcja "Service Thresholds": `<ServiceThresholdList thresholds={thresholdSummary} client:load />` + `<AddServiceThresholdForm carId={vehicle.id} client:load />`
  4. Repair History (bez zmian)

### Success Criteria

#### Automated Verification

- `npm run build` bez błędów TypeScript/lint
- Brak błędów hydration w konsoli przeglądarki

#### Manual Verification

- Dodanie progu z tylko `km_interval` → pojawia się na liście
- Dodanie progu z tylko `days_interval` → pojawia się na liście
- Próg bez `last_performed` → czerwona karta w bannerze
- Próg bliski limitu → żółta karta w bannerze
- Próg daleki od limitu → brak na bannerze, zielony badge na liście
- Edycja progu → dane zaktualizowane
- Usunięcie progu z confirmation → znika z listy
- Dashboard bez progów → baner niewidoczny, lista pusta z call-to-action
- Brak regresji w historii napraw i koszt/km

**Pauza po fazie 4 i pełnej weryfikacji manualnej.**

---

## Testing Strategy

### Manual Testing Steps

1. Utwórz pojazd, dodaj naprawy (aktualny przebieg ≠ baseline)
2. Dodaj próg serwisowy: `Wymiana oleju`, km_interval=10000, last_performed_mileage=bliski aktualnego
3. Sprawdź banner: czy pojawia się żółty/czerwony alert
4. Edytuj próg: zmień last_performed_mileage na daleki → banner znika
5. Dodaj próg bez last_performed → natychmiast czerwony
6. Usuń próg → znika z listy i bannerze
7. Sprawdź izolację: drugi user nie widzi progów pierwszego

## References

- Roadmap: S-06 `context/foundation/roadmap.md`
- Repair API pattern: `src/pages/api/repairs.ts`, `src/pages/api/repairs/[id].ts`
- RepairList pattern: `src/components/repairs/RepairList.tsx`
- Cost/km logic: `src/lib/costPerKm.ts`
- Vehicle dashboard: `src/pages/dashboard/vehicles/[id].astro`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: DB + Types

#### Automated

- [x] 1.1 Migration applies cleanly (`npx supabase db reset`) — de2bc2f
- [x] 1.2 `npm run build` without TypeScript errors — de2bc2f

#### Manual

- [x] 1.3 Table `service_thresholds` visible in Supabase Studio — de2bc2f
- [x] 1.4 RLS blocks cross-user access — de2bc2f
- [x] 1.5 Constraint rejects both-null interval — de2bc2f

### Phase 2: API Endpoints

#### Automated

- [x] 2.1 `npm run build` without errors
- [x] 2.2 POST valid body → 201
- [x] 2.3 POST with both intervals null → 400
- [x] 2.4 PUT/DELETE with foreign id → no rows affected

#### Manual

- [x] 2.5 Create threshold via curl/Insomnia
- [x] 2.6 Edit existing threshold
- [x] 2.7 Delete foreign threshold fails

### Phase 3: Reminder Calculation Logic

#### Automated

- [ ] 3.1 `npm run build` without errors

#### Manual

- [ ] 3.2 `computeReminderStatus` with null last_performed → `'overdue'`
- [ ] 3.3 km_remaining negative → `'overdue'`
- [ ] 3.4 km_remaining within 10% margin → `'approaching'`
- [ ] 3.5 days_remaining < 30 → `'approaching'`

### Phase 4: UI Components + Dashboard Integration

#### Automated

- [ ] 4.1 `npm run build` without errors
- [ ] 4.2 No hydration errors in browser console

#### Manual

- [ ] 4.3 Add threshold (km only) → appears in list
- [ ] 4.4 Add threshold (days only) → appears in list
- [ ] 4.5 Threshold without last_performed → red banner card
- [ ] 4.6 Threshold near limit → yellow banner card
- [ ] 4.7 Threshold far from limit → no banner, green badge on list
- [ ] 4.8 Edit threshold → data updated
- [ ] 4.9 Delete with confirmation → removed from list and banner
- [ ] 4.10 Dashboard without thresholds → banner hidden
- [ ] 4.11 No regressions in repair history and cost/km

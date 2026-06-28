---
title: "DDD Invariant Aggregate Refactor — Repair.mileage ≥ Vehicle.baseline_mileage"
created: 2026-06-28
type: refactor-plan
---

# DDD Invariant Aggregate Refactor

## KROK 0 — Kontekst

**Stack:** Astro 6 SSR + React 19 islands, Supabase (Postgres + RLS), TypeScript. Brak warstwy domenowej — logika biznesowa rozsiana po API routes (`src/pages/api/`), funkcjach lib (`src/lib/`), schematach Zod (`src/lib/schemas.ts`) i migracjach DB (`supabase/migrations/`).

**Warstwy żyjące logiki biznesowej:**
- `src/lib/costPerKm.ts` — formuła cost-per-km i pochodne trendy
- `src/lib/serviceReminders.ts` — logika progów serwisowych
- `src/lib/classifyRepair.ts` — klasyfikacja AI z fallbackiem
- `src/pages/api/repairs.ts` + `src/pages/api/repairs/[id].ts` — walidacja i zapis napraw
- `src/components/repairs/AddRepairForm.tsx` — walidacja po stronie klienta (React)
- `supabase/migrations/` — RLS policies, ograniczenia DB

---

## KROK 1 — Zidentyfikowane niezmienniki biznesowe

| # | Niezmiennik | Źródło |
|---|---|---|
| INV-1 | `Repair.mileage ≥ Vehicle.baseline_mileage` | PRD FR-007: "sum(koszt) / max(0, aktualny przebieg − baseline przebieg)"; FR-003: "przebieg w momencie naprawy" |
| INV-2 | Kategoria naprawy ∈ {silnik, hamulce, elektryka, ogumienie, przegląd, inne, pending} | PRD FR-004: "exactly one of {…}"; `src/lib/repairCategories.ts:1` |
| INV-3 | Naprawa należy do pojazdu własności właściciela | PRD NFR – Authorization integrity; RLS policies `repairs_insert_own` |
| INV-4 | Naprawa może być dodana tylko do aktywnego (nie zarchiwizowanego) pojazdu | PRD FR-002: "active (non-archived) cars"; FR-006: "active (non-archived) cars" |
| INV-5 | `cost > 0` jeśli podany; `null` jeśli bezpłatna naprawa | PRD FR-003: "koszt may be omitted"; `src/lib/schemas.ts:13` |
| INV-6 | ServiceThreshold musi mieć ≥1 interwał (km lub days) | PRD FR-008; DB `constraint at_least_one_interval` |
| INV-7 | Klasyfikacja nie może blokować zapisu (fallback `pending`) | PRD FR-011: "classification is never blocking" |
| INV-8 | Aktualny przebieg jest derywowany z napraw, nie persystowany | PRD FR-007; `src/lib/costPerKm.ts:3-6`; migration `20260602140000_drop_cars_current_mileage.sql` |

---

## KROK 2 — Klasyfikacja i wybór #1

### Macierz oceny

| # | (a) Rdzeniowość dla produktu | (b) Rozsmarowanie | (c) Egzekucja |
|---|---|---|---|
| INV-1 | **Krytyczna** — fundament głównej metryki (cost-per-km, "number that informs the keep-or-sell decision", PRD Vision) | Średnie: 3 warstwy — UI client, API POST, API PUT | **Niespójna**: UI + 2 API routes, **zero DB CHECK constraint** |
| INV-2 | Wysoka — klasyfikacja "distinguishes the product from a spreadsheet" (PRD) | Średnie: Zod PATCH, programatyczne POST/PUT | Niespójna: PATCH ma enum guard, INSERT/UPDATE nie; brak DB CHECK |
| INV-3 | Najwyższa — bezpieczeństwo | Szerokie: app-layer + RLS | **Dobra** (podwójna warstwa: app + RLS) |
| INV-4 | Wysoka — kontrakt archiwizacji | Rozsiane: read-path filtruje, write-path nie | **Słaba**: POST /api/repairs nie sprawdza `archived_at` |
| INV-5 | Niska | Zod only | Częściowa (brak DB CHECK) |
| INV-6 | Średnia | Zod + DB | **Dobra** |
| INV-7 | Wysoka | Zlokalizowana | **Dobra** |
| INV-8 | Wysoka | Zlokalizowana | **Dobra** |

### Wybrany niezmiennik: INV-1 — `Repair.mileage ≥ Vehicle.baseline_mileage`

**Uzasadnienie:** Jest jednocześnie **najbardziej rdzeniowy** (bez niego cost-per-km — jedyna metryka decyzyjna produktu — może dać `null` lub nonsensowny wynik gdy `max_mileage ≤ baseline`) i **najsłabiej egzekwowany** (3 niespójne punkty egzekucji, zero DB constraint). Naturalnie projektuje **Vehicle jako aggregate root**: naprawa zawsze istnieje w kontekście pojazdu i jej poprawność jest nierozerwalnie związana z właściwościami pojazdu (baseline). Każdy nowy endpoint lub bezpośrednie zapytanie do Supabase API omija obecną ochronę.

---

## KROK 3 — Diagnoza wybranego niezmiennika

### Mapa obecnej egzekucji

```
UI (client)           API layer             DB layer
─────────────────     ──────────────────    ──────────────────
AddRepairForm.tsx:52  repairs.ts:46-49      BRAK CHECK constraint
  validate() guard    repairs/[id].ts:57    mileage integer not null
  (klient, omijalne   (PUT handler)         (dowolna liczba ≥ 0)
   przez JS off)
                      BRAK w PATCH [id]     RLS UPDATE nie sprawdza
                      (kategoria override)  mileage vs baseline
```

### Cytaty — gdzie reguła żyje

**1. Klient (jedyny guardian dla UX, omijalne):**
```
src/components/repairs/AddRepairForm.tsx:52-53
  else if (mileageNum < baselineMileage)
    next.mileage = `Mileage must be at or above baseline mileage (${baselineMileage} km)`;
```
→ Jedyne miejsce walidujące `mileageNum < baselineMileage` po stronie klienta. Wywołanie `fetch('/api/repairs', { method: 'POST', body })` z JS disabled lub z poziomu curl/Postman omija tę warstwę.

**2. API POST (naprawa: insert):**
```
src/pages/api/repairs.ts:22-29 — query na car: SELECT id, user_id, baseline_mileage
src/pages/api/repairs.ts:46-49
  if (result.data.mileage < car.baseline_mileage) {
    return context.redirect(
      `/dashboard/repairs/new?vehicle_id=${carId}&error=${...Mileage must be at or above baseline mileage (${car.baseline_mileage} km)...}`
    );
  }
```
→ Reguła egzekwowana; wymaga dodatkowego DB roundtrip (select na car).

**3. API PUT (edycja naprawy):**
```
src/pages/api/repairs/[id].ts:33-39 — osobny query na car: SELECT baseline_mileage
src/pages/api/repairs/[id].ts:57-60
  if (result.data.mileage < car.baseline_mileage) {
    return Response.json(
      { error: `Mileage must be at or above baseline mileage (${car.baseline_mileage} km)` },
      { status: 400 }
    );
  }
```
→ Reguła zduplikowana (copy-paste guard). Wymaga osobnego DB roundtrip.

**4. PATCH (category override) — brak sprawdzenia mileage:**
```
src/pages/api/repairs/[id].ts:127-179
  — sprawdza ownership repair, ale nie ładuje Vehicle ani nie sprawdza mileage
```
→ PATCH nie dotyka mileage, więc nie jest problemem — ale to pokazuje wzorzec: każda operacja ładuje repair osobno, ownershipcheck oddzielnie, vehicle oddzielnie.

**5. DB — brak ochrony:**
```
supabase/migrations/20260531120000_create_repairs_table.sql
  mileage integer not null  ← dowolna liczba ≥ 0, brak CHECK
  
supabase/migrations/20260602120000_add_repairs_update_delete_policies.sql
  create policy "repairs_update_own"
    on public.repairs for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);  ← brak warunku na mileage vs baseline
```
→ Supabase JS/REST API z poprawnym tokenem może zapisać mileage < baseline_mileage.

### Warstwy bez egzekucji

| Warstwa | Status |
|---|---|
| DB CHECK constraint | **BRAK** — naruszenie możliwe przez Supabase API |
| RLS UPDATE with check | **BRAK warunku mileage** — sprawdza tylko user_id |
| PATCH handler | **NIEISTOTNY** (nie zmienia mileage), ale wzorzec izolacji brakuje |
| `computeCurrentMileage` | Defensywna: `Math.max(baseline, ...)` — maskuje naruszenie zamiast je zatrzymać |
| `computeCostTrendData` | Defensywna: `if (kmDriven <= 0) continue` — cicho pomija błędne dane |

### Ukryty koszt: maskowanie zamiast fail-fast

```
src/lib/costPerKm.ts:4-5
  if (repairs.length === 0) return baselineMileage;
  return Math.max(baselineMileage, ...repairs.map((r) => r.mileage));
```
→ Jeśli repair.mileage < baseline, `Math.max` zwróci baseline — naprawa jest "ukryta" w metryce currentMileage, ale jej koszt nadal wchodzi do `totalCost`. Wynik: przebieg prawidłowy, ale koszt zawyżony w stosunku do km. Przekłamana metryka cost-per-km.

```
src/lib/costPerKm.ts:35-37
  const kmDriven = repair.mileage - vehicle.baseline_mileage;
  if (kmDriven <= 0) continue;  ← punkt danych usunięty z trendu bez błędu
```
→ Naprawa z mileage < baseline znika z wykresu trendów bez komunikatu. Silent data loss.

---

## KROK 4 — Projekt agregatu-strażnika

### Aggregate Root: `Vehicle`

Vehicle jest naturalnym aggregate root, bo:
- `Repair` istnieje **tylko** w kontekście `Vehicle`
- Niezmiennik `mileage ≥ baseline_mileage` jest **właściwością Vehicle** (baseline należy do Vehicle)
- Wszystkie operacje na Repair wymagają Vehicle do weryfikacji

### Schemat agregatu

```typescript
// src/domain/vehicle/Vehicle.ts

import { RepairMileageBelowBaselineError } from "./errors";

export class Vehicle {
  readonly id: string;
  readonly userId: string;
  readonly baselineMileage: number;
  readonly archivedAt: string | null;

  private constructor(props: {
    id: string;
    userId: string;
    baselineMileage: number;
    archivedAt: string | null;
  }) {
    this.id = props.id;
    this.userId = props.userId;
    this.baselineMileage = props.baselineMileage;
    this.archivedAt = props.archivedAt;
  }

  static reconstitute(row: {
    id: string;
    user_id: string;
    baseline_mileage: number;
    archived_at: string | null;
  }): Vehicle {
    return new Vehicle({
      id: row.id,
      userId: row.user_id,
      baselineMileage: row.baseline_mileage,
      archivedAt: row.archived_at,
    });
  }

  // Metoda domenowa — preconditions egzekwowane tu, nie w handlerze
  assertRepairMileageValid(mileage: number): void {
    if (mileage < this.baselineMileage) {
      throw new RepairMileageBelowBaselineError(mileage, this.baselineMileage);
    }
  }
}
```

### Błąd domenowy (named, nie string)

```typescript
// src/domain/vehicle/errors.ts

export class RepairMileageBelowBaselineError extends Error {
  readonly mileage: number;
  readonly baselineMileage: number;

  constructor(mileage: number, baselineMileage: number) {
    super(`Repair mileage ${mileage} km is below vehicle baseline ${baselineMileage} km`);
    this.name = "RepairMileageBelowBaselineError";
    this.mileage = mileage;
    this.baselineMileage = baselineMileage;
  }
}
```

### Repozytorium

```typescript
// src/domain/vehicle/VehicleRepository.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import { Vehicle } from "./Vehicle";

export async function loadVehicleForUser(
  supabase: SupabaseClient,
  vehicleId: string,
  userId: string,
): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from("cars")
    .select("id, user_id, baseline_mileage, archived_at")
    .eq("id", vehicleId)
    .eq("user_id", userId)  // ownership enforced at load time
    .single();

  if (error || !data) return null;
  return Vehicle.reconstitute(data);
}
```

### Cienkie API handlers (after)

```typescript
// POST /api/repairs — po refaktorze

const vehicle = await loadVehicleForUser(supabase, carId, user.id);
if (!vehicle) {
  return context.redirect(`/dashboard/vehicles?error=${encodeURIComponent("Vehicle not found")}`);
}

// Jedyne miejsce egzekucji — agregat
try {
  vehicle.assertRepairMileageValid(result.data.mileage);
} catch (e) {
  if (e instanceof RepairMileageBelowBaselineError) {
    return context.redirect(
      `/dashboard/repairs/new?vehicle_id=${carId}&error=${encodeURIComponent(e.message)}`
    );
  }
  throw e;
}

// Zapis — nie ma drugiego roundtrip na baseline_mileage
const { error } = await supabase.from("repairs").insert({ ... });
```

```typescript
// PUT /api/repairs/[id] — po refaktorze

// Zamiast dwóch osobnych query (repair + car.baseline_mileage):
const { data: repairRow } = await supabase
  .from("repairs")
  .select("id, user_id, car_id, description, category, category_source")
  .eq("id", repairId)
  .single();

if (!repairRow || repairRow.user_id !== user.id) { ... }

// Ładujemy agregat — daje nam baseline + ownership w jednym
const vehicle = await loadVehicleForUser(supabase, repairRow.car_id, user.id);
if (!vehicle) return Response.json({ error: "Vehicle not found" }, { status: 404 });

try {
  vehicle.assertRepairMileageValid(result.data.mileage);
} catch (e) {
  if (e instanceof RepairMileageBelowBaselineError) {
    return Response.json({ error: e.message }, { status: 400 });
  }
  throw e;
}
```

### Migracja DB — dodanie CHECK constraint (fail-safe)

```sql
-- Nowa migracja: YYYYMMDDHHmmss_add_repair_mileage_check.sql
-- Dodaje DB-level guard jako ostatnia linia obrony

ALTER TABLE public.repairs
  ADD CONSTRAINT repairs_mileage_gte_baseline
  CHECK (
    mileage >= (
      SELECT baseline_mileage
      FROM public.cars
      WHERE id = car_id
    )
  );
```

> **Uwaga implementacyjna:** Postgres wspiera subquery w CHECK od v12. Supabase używa PG14+. Alternatywnie: trigger BEFORE INSERT OR UPDATE, który wykonuje tę samą weryfikację. Trigger daje lepszy error message.

---

## KROK 5 — Before/After, plan faz, testy

### Before/After per warstwa

| Warstwa | Before | After |
|---|---|---|
| `AddRepairForm.tsx:52-53` | Client-side guard: `if (mileageNum < baselineMileage) next.mileage = ...` | Bez zmian — pozostaje jako UX guard (instant feedback), nie jako jedyna ochrona |
| `src/pages/api/repairs.ts:46-49` | `if (result.data.mileage < car.baseline_mileage) { redirect(...) }` — inline check | `vehicle.assertRepairMileageValid(mileage)` + catch `RepairMileageBelowBaselineError` |
| `src/pages/api/repairs.ts:22-29` | Osobny query: `SELECT id, user_id, baseline_mileage` | `loadVehicleForUser(supabase, carId, user.id)` — ownership + baseline w jednym |
| `src/pages/api/repairs/[id].ts:33-39` | Osobny query: `SELECT baseline_mileage` | Usunięty — `loadVehicleForUser` zastępuje oba query |
| `src/pages/api/repairs/[id].ts:57-60` | `if (result.data.mileage < car.baseline_mileage) { ... }` — copy-paste guard | `vehicle.assertRepairMileageValid(mileage)` + catch |
| `supabase/migrations/` | Brak CHECK constraint | Nowa migracja: CHECK lub trigger BEFORE INSERT/UPDATE |
| `src/lib/costPerKm.ts:4-5` | `Math.max(baselineMileage, ...)` — defensywne maskowanie | Bez zmian — defensywność OK jako ostatnia warstwa, nie jedyna |

### Plan faz refaktoru

#### Faza 1 — Domenowy błąd i Value Object (brak zmian w DB, brak regresji)

- Utwórz `src/domain/vehicle/errors.ts` z `RepairMileageBelowBaselineError`
- Utwórz `src/domain/vehicle/Vehicle.ts` z metodą `assertRepairMileageValid`
- Utwórz `src/domain/vehicle/VehicleRepository.ts` z `loadVehicleForUser`
- **Testy jednostkowe** (Vitest, test-first):
  - `Vehicle.assertRepairMileageValid(mileage < baseline)` → throws `RepairMileageBelowBaselineError`
  - `Vehicle.assertRepairMileageValid(mileage === baseline)` → no throw (granica legalna)
  - `Vehicle.assertRepairMileageValid(mileage > baseline)` → no throw
  - `Vehicle.reconstitute(row)` → poprawne mapowanie pól

#### Faza 2 — Refaktor POST /api/repairs

- Zamień inline guard + osobny SELECT na `loadVehicleForUser` + `assertRepairMileageValid`
- **Testy integracyjne** (`src/pages/api/__tests__/repairs.test.ts`):
  - POST z mileage < baseline → redirect z błędem
  - POST z mileage === baseline → sukces (naprawa zapisana)
  - POST z mileage > baseline → sukces
  - POST na nieistniejący car_id → redirect z "Vehicle not found"

#### Faza 3 — Refaktor PUT /api/repairs/[id]

- Usuń osobny SELECT baseline_mileage; załaduj Vehicle przez `loadVehicleForUser`
- Zamień inline guard na `assertRepairMileageValid`
- **Testy integracyjne** (`src/pages/api/__tests__/repairs-id.test.ts`):
  - PUT z mileage < baseline → 400 z domenowym komunikatem
  - PUT z mileage === baseline → 200
  - PUT description zmiana (bez zmiany mileage) → mileage nie jest re-walidowane powtórnie (OK)

#### Faza 4 — Migracja DB (fail-safe constraint)

- Napisz migrację z CHECK lub trigger BEFORE INSERT OR UPDATE
- **Weryfikacja:** direct Supabase JS insert z mileage < baseline → error z DB
- Sprawdź, czy istniejące dane nie naruszają nowego constrainta (pre-migration check):
  ```sql
  SELECT r.id, r.mileage, c.baseline_mileage
  FROM repairs r JOIN cars c ON c.id = r.car_id
  WHERE r.mileage < c.baseline_mileage;
  ```

### Przypadki testowe (legalne i nielegalne)

| Scenariusz | Klasa wejścia | Oczekiwany wynik |
|---|---|---|
| mileage = baseline_mileage | Granica legalna | OK — naprawa zapisana |
| mileage = baseline_mileage + 1 | Legalna | OK |
| mileage = baseline_mileage - 1 | Nielegalna | `RepairMileageBelowBaselineError` → 400/redirect |
| mileage = 0, baseline = 0 | Legalna (edge) | OK — baseline 0 jest dopuszczalne |
| mileage = 0, baseline = 1000 | Nielegalna | `RepairMileageBelowBaselineError` |
| PUT aktualizuje tylko opis (mileage bez zmian) | Reguła musi nadal przejść | OK — mileage niezmieniony ale walidowany |

### Nowe load-bearing nazwy (do rejestru kontraktów)

Jeśli projekt prowadzi `docs/reference/contract-surfaces.md`:

| Nazwa | Typ | Plik |
|---|---|---|
| `Vehicle` | Aggregate Root | `src/domain/vehicle/Vehicle.ts` |
| `RepairMileageBelowBaselineError` | Domain Error | `src/domain/vehicle/errors.ts` |
| `loadVehicleForUser` | Repository fn | `src/domain/vehicle/VehicleRepository.ts` |
| `assertRepairMileageValid` | Domain method | `src/domain/vehicle/Vehicle.ts` |
| `repairs_mileage_gte_baseline` | DB constraint | migration |

---

## Podsumowanie

Niezmiennik `Repair.mileage ≥ Vehicle.baseline_mileage` jest fundamentem głównej metryki produktu (cost-per-km), ale egzekwowany dziś w trzech niespójnych punktach (UI client, POST handler, PUT handler) bez żadnej ochrony na poziomie bazy danych — bezpośredni zapis przez Supabase API omija wszystkie guardy. Wybrano go jako #1 bo jest jednocześnie najbardziej rdzeniowy i najsłabiej egzekwowany. Projekt wprowadza `Vehicle` jako aggregate root z metodą domenową `assertRepairMileageValid`, która rzuca nazwany błąd `RepairMileageBelowBaselineError` zamiast cichego maskowania. `loadVehicleForUser` zastępuje dwa rozsiane SELECT-y (ownership + baseline) jednym ładowaniem agregatu, eliminując copy-paste guard. Faza 4 dodaje DB-level CHECK constraint jako ostatnią linię obrony — fail-fast zamiast silent data corruption w trendach. Cztery fazy refaktoru są możliwe test-first od Fazy 1.

---
title: "Car Repair Tracker — Anti-Corruption Layer: Plan Refaktoru"
created: 2026-06-28
type: refactor-plan
---

# Anti-Corruption Layer — Plan Refaktoru

## KROK 0 — Kontekst projektu

### Stack i deklaracje

- **Runtime:** Astro 6 SSR + Node.js adapter
- **Persystencja:** `@supabase/supabase-js` ^2.99.1 + `@supabase/ssr` ^0.10.3
- **AI:** `@google/genai` ^2.8.0
- **Walidacja:** `zod` ^4.4.3

### Deklaracje wymienialności w dokumentach

`context/foundation/tech-stack.md` NIE deklaruje wprost wymienialności Supabase.  
`README.md` opisuje Supabase jako "auth + Postgres database with RLS" — decyzja technologiczna,  
nie interfejs wymagany do wymiany.

Brak jawnej deklaracji *nie znosi* problemu — naruszenie granicy warstw jest obiektywne:  
**serwis aplikacyjny powinien zależeć od portu (interfejsu), nie od konkretnej biblioteki infrastruktury.**

---

## KROK 1 — Identyfikacja przeciekających zależności

### Zależność A: `@supabase/supabase-js` — `SupabaseClient` w sygnaturach serwisowych

Pliki, które "znają" typ `SupabaseClient` z pakietu infrastrukturalnego:

| Plik | Linia | Kontekst |
|------|-------|---------|
| `src/lib/services/vehiclePageData.ts` | 1 | `import type { SupabaseClient }` |
| `src/lib/services/vehiclePageData.ts` | 33 | `supabase: SupabaseClient` — parametr serwisu |
| `src/lib/demo-seed.ts` | 1 | `import type { SupabaseClient }` |
| `src/lib/demo-seed.ts` | 3 | `adminClient: SupabaseClient` — parametr serwisu |

### Zależność B: `@supabase/supabase-js`.User w typie App.Locals

| Plik | Linia | Kontekst |
|------|-------|---------|
| `src/env.d.ts` | 3 | `user: import("@supabase/supabase-js").User \| null` — w deklaracji `App.Locals` |

Skutek: każda strona Astro odwołująca się do `Astro.locals.user` pośrednio zna pakiet `@supabase/supabase-js`. Łańcuch: `env.d.ts` → `middleware.ts` → każda page i API route.

### Zależność C: Raw `supabase.from()` w API routes (szeroka, ale spójna warstwa)

| Plik | Linia | Operacja |
|------|-------|---------|
| `src/pages/api/repairs.ts` | 22–29 | `supabase.from("cars").select(...)` (ownership check) |
| `src/pages/api/repairs.ts` | 56 | `supabase.from("repairs").insert(...)` |
| `src/pages/api/repairs/[id].ts` | 25–32 | `supabase.from("repairs").select(...)` |
| `src/pages/api/repairs/[id].ts` | 34–40 | `supabase.from("cars").select(...)` |
| `src/pages/api/repairs/[id].ts` | 82 | `supabase.from("repairs").update(...)` |
| `src/pages/api/repairs/[id].ts` | 118 | `supabase.from("repairs").delete(...)` |
| `src/pages/api/repairs/[id].ts` | 144–151 | `supabase.from("repairs").select(...)` |
| `src/pages/api/repairs/[id].ts` | 167 | `supabase.from("repairs").update(...)` |
| `src/pages/api/vehicles.ts` | 30 | `supabase.from("cars").insert(...)` |
| `src/pages/api/vehicles/[id].ts` | 24–30 | `supabase.from("cars").select(...)` |
| `src/pages/api/vehicles/[id].ts` | 32 | `supabase.from("cars").delete(...)` |
| `src/pages/api/service-thresholds.ts` | 32–39 | `supabase.from("cars").select(...)` |
| `src/pages/api/service-thresholds.ts` | 43–55 | `supabase.from("service_thresholds").insert(...)` |
| `src/pages/api/service-thresholds/[id].ts` | 31–37 | `supabase.from("service_thresholds").select(...)` |
| `src/pages/api/service-thresholds/[id].ts` | 60–66 | `supabase.from("service_thresholds").update(...)` |
| `src/pages/api/service-thresholds/[id].ts` | 91–97 | `supabase.from("service_thresholds").select(...)` |
| `src/pages/api/service-thresholds/[id].ts` | 106 | `supabase.from("service_thresholds").delete(...)` |
| `src/pages/dashboard/vehicles/index.astro` | 15–22 | `supabase.from("cars").select(...)` |
| `src/pages/dashboard/repairs/[id]/edit.astro` | 15 | `supabase.from("repairs").select("*")` |

Nazwy tabel (`"cars"`, `"repairs"`, `"service_thresholds"`) jako surowe stringi — rozproszone w 19 miejscach.

---

## KROK 2 — Klasyfikacja i wybór #1

### Matryca oceny

| Zależność | Warstwy dotknięte | Ryzyko wymiany bez ACL | Rozjazd intencja-vs-kod |
|-----------|-------------------|------------------------|-------------------------|
| **A: SupabaseClient w serwisach** | lib/services + lib/demo-seed (serwisy app.) | Wysoki — zmiana DB wymaga zmiany sygnatur serwisów i ich testów | Tak — serwisy powinny zależeć od portów |
| **B: User w App.Locals** | env.d.ts → middleware → każda page (wirusowy) | Średni — zmiana auth provider = zmiana kształtu User wszędzie | Tak — typ infrastructury w kontrakcie frameworka |
| **C: from() w API routes** | 19 plików w warstwie HTTP | Wysoki ilościowo, ale warstwy są spójne (API routes = warstwa aplikacji) | Nie — API routes to właściwe miejsce dla orkiestracji infrastruktury w obecnej architekturze |

### Wybór #1: Zależność A — `SupabaseClient` jako parametr serwisów domenowych

**Uzasadnienie:**

`src/lib/services/vehiclePageData.ts` jest najważniejszym serwisem w projekcie — orchestruje
pobieranie danych z trzech tabel i uruchamia obliczenia biznesowe (`computeCostPerKm`,
`computeThresholdSummary`). Mimo że nominalnie siedzi w `src/lib/`, zna nazwy tabel Supabase
(`"cars"`, `"repairs"`, `"service_thresholds"`), buduje zapytania SQL przez Supabase Query Builder
i pobiera surowe wyniki jako typy domenowe przez rzutowanie (`vehicleResult.data as Vehicle`).

Naruszenie granicy warstw jest tu maksymalne:
- **Serwis aplikacyjny bezpośrednio woła infrastrukturę** zamiast korzystać z portu
- **Testy jednostkowe serwisu wymagają mockowania `SupabaseClient`** — ciężkiego API 
- **Rozszerzenie o dowolną nową operację DB** wymaga znajomości Supabase API w kodzie serwisowym
- `src/lib/demo-seed.ts` ma identyczny problem — serwis seedowania zna `SupabaseClient`

Zależność B (User w App.Locals) jest wirusowa, ale jej refaktor jest prostszy i zależny od decyzji
o własnym typie domenowym użytkownika — naturalny efekt uboczny fazy 1 planu.

---

## KROK 3 — Diagnoza

### Główny przeciek: `SupabaseClient` w sygnaturze serwisu

```
// src/lib/services/vehiclePageData.ts:1-3
import type { SupabaseClient } from "@supabase/supabase-js";  // ← @supabase/supabase-js w serwisie
import type { Vehicle, Repair, ServiceThreshold } from "@/types";
...

// src/lib/services/vehiclePageData.ts:32-33
export async function getVehiclePageData(
  supabase: SupabaseClient,   // ← kontrakt serwisu wymaga obiektu Supabase
  vehicleId: string,
  userId: string,
): Promise<VehiclePageData | null> {

// src/lib/services/vehiclePageData.ts:37-43
  const vehicleResult = await supabase     // ← serwis buduje zapytanie SQL
    .from("cars")                          // ← zna nazwę tabeli
    .select(VEHICLE_COLUMNS)               // ← zna kolumny
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .single();
```

```
// src/lib/demo-seed.ts:1,3
import type { SupabaseClient } from "@supabase/supabase-js";  // ← identyczny problem

export async function seedDemoData(adminClient: SupabaseClient, userId: string): Promise<void> {
```

### Leak: Supabase User w kontrakcie frameworkowym

```
// src/env.d.ts:1-5
declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;  // ← infrastruktura w sygnaturze frameworka
  }
}
```

Skutek: `middleware.ts:12` wstawia `supabase.auth.getUser()` bezpośrednio do `context.locals.user`.
Każda strona, która sprawdza `Astro.locals.user`, pośrednio zna kształt obiektu `@supabase/supabase-js`.User
(właściwości `id`, `email`, `user_metadata` itp.). Zmiana auth providera = zmiana kształtu obiektu
dostępnego w każdej page i każdym API route.

### Duplikacja: casting surowych wyników do typów domenowych

Wzorzec pojawia się w czterech miejscach:

```
// src/lib/services/vehiclePageData.ts:44-45
  const vehicle: Vehicle = vehicleResult.data;   // ← rzutowanie bez walidacji kształtu

// src/lib/services/vehiclePageData.ts:62
  const repairs: Repair[] = repairsResult.data;

// src/lib/services/vehiclePageData.ts:64
  const thresholds: ServiceThreshold[] = thresholdsResult.data;
```

Każde z tych miejsc zakłada, że Supabase zwróci dokładnie ten kształt, który opisuje typ domenowy.
ACL powinien enkapsulować to mapowanie — weryfikować kształt i tłumaczyć na typ domenowy w jednym miejscu.

---

## KROK 4 — Projekt ACL

### Domenowy typ użytkownika

```typescript
// src/lib/domain/AuthenticatedUser.ts

/** Domenowy użytkownik uwierzytelniony — niezależny od providera auth */
export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
}
```

Zastępuje `import("@supabase/supabase-js").User` w `env.d.ts`.  
Adapter w `middleware.ts` mapuje `supabase.auth.getUser().data.user` → `AuthenticatedUser`.

---

### Port: IVehicleRepository

```typescript
// src/lib/ports/IVehicleRepository.ts

import type { Vehicle } from "@/types";

export interface VehicleWithRepairMileages extends Vehicle {
  repairs: { mileage: number }[];
}

export interface CreateVehicleInput {
  userId: string;
  make: string;
  model: string;
  year: number;
  baselineMileage: number;
}

export interface IVehicleRepository {
  /** Pobiera pojazd po id i userId (ownership check). Null jeśli nie istnieje lub nie należy do użytkownika. */
  findById(vehicleId: string, userId: string): Promise<Vehicle | null>;

  /** Pobiera wszystkie aktywne pojazdy użytkownika z przebiegami napraw (dla listy pojazdów). */
  findAllByUserWithMileages(userId: string): Promise<VehicleWithRepairMileages[]>;

  /** Tworzy nowy pojazd. Rzuca błąd przy naruszeniu ograniczeń. */
  create(input: CreateVehicleInput): Promise<void>;

  /** Usuwa pojazd. Zwraca false jeśli wiersz nie istnieje lub nie należy do użytkownika. */
  delete(vehicleId: string, userId: string): Promise<boolean>;
}
```

---

### Port: IRepairRepository

```typescript
// src/lib/ports/IRepairRepository.ts

import type { Repair } from "@/types";
import type { RepairCategory } from "@/lib/repairCategories";

export interface CreateRepairInput {
  carId: string;
  userId: string;
  repairDate: string;
  description: string;
  cost: number | null;
  mileage: number;
  category: RepairCategory | "pending";
  categorySource: "ai" | "pending";
  originalCategory: RepairCategory | "pending";
}

export interface UpdateRepairInput {
  repairDate: string;
  description: string;
  cost: number | null;
  mileage: number;
  category?: RepairCategory | "pending";
  categorySource?: "ai" | "pending" | "manual";
  originalCategory?: RepairCategory | "pending";
}

export interface OverrideCategoryInput {
  category: RepairCategory;
}

export interface IRepairRepository {
  /** Pobiera naprawę po id z ownership check. */
  findById(repairId: string, userId: string): Promise<Repair | null>;

  /** Pobiera wszystkie naprawy pojazdu posortowane malejąco po dacie. */
  findByVehicle(vehicleId: string, userId: string): Promise<Repair[]>;

  /** Tworzy nową naprawę. */
  create(input: CreateRepairInput): Promise<void>;

  /** Aktualizuje naprawę. Zwraca false jeśli nie istnieje lub nie należy do użytkownika. */
  update(repairId: string, userId: string, input: UpdateRepairInput): Promise<boolean>;

  /** Nadpisuje kategorię ręcznie (category_source = "manual"). */
  overrideCategory(repairId: string, userId: string, input: OverrideCategoryInput): Promise<boolean>;

  /** Usuwa naprawę. Zwraca false jeśli nie istnieje lub nie należy do użytkownika. */
  delete(repairId: string, userId: string): Promise<boolean>;
}
```

---

### Port: IServiceThresholdRepository

```typescript
// src/lib/ports/IServiceThresholdRepository.ts

import type { ServiceThreshold } from "@/types";

export interface CreateServiceThresholdInput {
  carId: string;
  userId: string;
  name: string;
  kmInterval: number | null;
  daysInterval: number | null;
  lastPerformedDate: string | null;
  lastPerformedMileage: number | null;
}

export interface UpdateServiceThresholdInput {
  name?: string;
  kmInterval?: number | null;
  daysInterval?: number | null;
  lastPerformedDate?: string | null;
  lastPerformedMileage?: number | null;
}

export interface IServiceThresholdRepository {
  /** Pobiera threshold po id z ownership check. */
  findById(thresholdId: string, userId: string): Promise<ServiceThreshold | null>;

  /** Pobiera wszystkie thresholdy pojazdu posortowane rosnąco po created_at. */
  findByVehicle(vehicleId: string, userId: string): Promise<ServiceThreshold[]>;

  /** Tworzy threshold i zwraca utworzony rekord. */
  create(input: CreateServiceThresholdInput): Promise<ServiceThreshold>;

  /** Aktualizuje threshold i zwraca zaktualizowany rekord. Null jeśli nie istnieje/nie należy. */
  update(thresholdId: string, userId: string, input: UpdateServiceThresholdInput): Promise<ServiceThreshold | null>;

  /** Usuwa threshold. Zwraca false jeśli nie istnieje lub nie należy do użytkownika. */
  delete(thresholdId: string, userId: string): Promise<boolean>;
}
```

---

### Adapter Supabase: SupabaseVehicleRepository

```typescript
// src/lib/infrastructure/supabase/SupabaseVehicleRepository.ts

import type { SupabaseClient } from "@supabase/supabase-js";           // ← Supabase TYLKO tutaj
import type { IVehicleRepository, VehicleWithRepairMileages, CreateVehicleInput } from "@/lib/ports/IVehicleRepository";
import type { Vehicle } from "@/types";

export class SupabaseVehicleRepository implements IVehicleRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(vehicleId: string, userId: string): Promise<Vehicle | null> {
    const { data, error } = await this.client
      .from("cars")
      .select("id, user_id, make, model, year, baseline_mileage, archived_at, created_at, updated_at")
      .eq("id", vehicleId)
      .eq("user_id", userId)
      .is("archived_at", null)
      .single();
    if (error || !data) return null;
    return this.#toVehicle(data);   // ← mapowanie + walidacja kształtu w jednym miejscu
  }

  async findAllByUserWithMileages(userId: string): Promise<VehicleWithRepairMileages[]> {
    const { data, error } = await this.client
      .from("cars")
      .select("*, repairs(mileage)")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map((row) => ({ ...this.#toVehicle(row), repairs: row.repairs ?? [] }));
  }

  async create(input: CreateVehicleInput): Promise<void> {
    const { error } = await this.client.from("cars").insert({
      user_id: input.userId,
      make: input.make,
      model: input.model,
      year: input.year,
      baseline_mileage: input.baselineMileage,
    });
    if (error) throw new Error(error.message);
  }

  async delete(vehicleId: string, userId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from("cars")
      .delete({ count: "exact" })
      .eq("id", vehicleId)
      .eq("user_id", userId);
    return !error && (count ?? 0) > 0;
  }

  #toVehicle(row: Record<string, unknown>): Vehicle {
    // Enkapsulowane mapowanie kolumn DB → typ domenowy
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      make: row.make as string,
      model: row.model as string,
      year: row.year as number,
      baseline_mileage: row.baseline_mileage as number,
      archived_at: (row.archived_at as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}
```

Analogicznie: `SupabaseRepairRepository` i `SupabaseServiceThresholdRepository`  
(implementują odpowiednie porty — identyczna struktura, inne nazwy tabel i kolumny).

---

### Przepisany serwis: getVehiclePageData (po refaktorze)

```typescript
// src/lib/services/vehiclePageData.ts — po refaktorze

// BRAK importu z @supabase/supabase-js
import type { IVehicleRepository } from "@/lib/ports/IVehicleRepository";
import type { IRepairRepository } from "@/lib/ports/IRepairRepository";
import type { IServiceThresholdRepository } from "@/lib/ports/IServiceThresholdRepository";
import { computeCostPerKm, ... } from "@/lib/costPerKm";
import { computeThresholdSummary } from "@/lib/serviceReminders";

export async function getVehiclePageData(
  vehicleRepo: IVehicleRepository,           // ← port, nie SupabaseClient
  repairRepo: IRepairRepository,
  thresholdRepo: IServiceThresholdRepository,
  vehicleId: string,
  userId: string,
): Promise<VehiclePageData | null> {
  const vehicle = await vehicleRepo.findById(vehicleId, userId);
  if (!vehicle) return null;

  const [repairs, thresholds] = await Promise.all([
    repairRepo.findByVehicle(vehicleId, userId),
    thresholdRepo.findByVehicle(vehicleId, userId),
  ]);

  const currentMileage = computeCurrentMileage(repairs, vehicle.baseline_mileage);
  // ... reszta bez zmian
}
```

Wywołanie z `src/pages/dashboard/vehicles/[id].astro` po refaktorze:

```typescript
// src/pages/dashboard/vehicles/[id].astro — po refaktorze
const client = createClient(Astro.request.headers, Astro.cookies);
const vehicleRepo = new SupabaseVehicleRepository(client);
const repairRepo  = new SupabaseRepairRepository(client);
const thresholdRepo = new SupabaseServiceThresholdRepository(client);

const data = await getVehiclePageData(vehicleRepo, repairRepo, thresholdRepo, id, user.id);
```

Tylko strona (warstwa HTTP) tworzy adapter z Supabase clientem. Serwis widzi tylko porty.

---

## KROK 5 — Dowód izolacji + before/after

### Kryterium wymiany biblioteki

**Dziś** — wymiana Supabase na inną bazę danych wymaga zmian w:
- `src/lib/services/vehiclePageData.ts` (sygnatury + zapytania)
- `src/lib/demo-seed.ts` (sygnatury + zapytania)
- 19 plików API routes i pages (zapytania)
- `src/env.d.ts` (typ User)
- `src/lib/supabase.ts` + `src/lib/supabase-admin.ts` (fabryki klientów)

**Po refaktorze** — wymiana Supabase wymaga zmian tylko w:
- `src/lib/infrastructure/supabase/SupabaseVehicleRepository.ts`
- `src/lib/infrastructure/supabase/SupabaseRepairRepository.ts`
- `src/lib/infrastructure/supabase/SupabaseServiceThresholdRepository.ts`
- `src/lib/supabase.ts` + `src/lib/supabase-admin.ts` (fabryki klientów)
- `src/lib/domain/AuthenticatedUser.ts` — mapowanie User → AuthenticatedUser

Serwisy, pages, API routes — bez zmian.

### Before/after: vehiclePageData.ts

| Aspekt | Przed | Po |
|--------|-------|-----|
| Import SDK | `import type { SupabaseClient } from "@supabase/supabase-js"` | brak |
| Parametr serwisu | `supabase: SupabaseClient` | `vehicleRepo: IVehicleRepository, repairRepo: IRepairRepository, thresholdRepo: IServiceThresholdRepository` |
| Nazwy tabel | `"cars"`, `"repairs"`, `"service_thresholds"` — stringi w serwisie | brak — wyłącznie w adapterach |
| Mapowanie do typów | `vehicleResult.data as Vehicle` (rzutowanie) | `vehicleRepo.findById()` zwraca `Vehicle` (walidowane w adapterze) |
| Testowalność | wymaga mock `SupabaseClient` | wymaga mock `IVehicleRepository` — prosty in-memory stub |

### Before/after: env.d.ts

| Aspekt | Przed | Po |
|--------|-------|-----|
| Typ użytkownika | `import("@supabase/supabase-js").User \| null` | `import("@/lib/domain/AuthenticatedUser").AuthenticatedUser \| null` |
| Zależność frameworka od SDK | tak | nie |

### Warstwy UI: gotowe dane domenowe, nie surowy obiekt Supabase

Przed: `Astro.locals.user` to `@supabase/supabase-js`.User z `app_metadata`, `user_metadata`, `aud` i innymi polami Supabase.  
Po: `Astro.locals.user` to `AuthenticatedUser { id, email }` — każda page dostaje minimalny kontrakt domenowy.

---

## KROK 6 — Weryfikacja i plan

### Kryterium sukcesu

```bash
grep -r "@supabase/supabase-js" src/
```

**Przed:** 5 trafień (env.d.ts, supabase-admin.ts, demo-seed.ts, vehiclePageData.ts ×2)

**Po:** tylko pliki w katalogu `src/lib/infrastructure/supabase/` + `src/lib/supabase-admin.ts`

```bash
grep -r "@supabase/ssr" src/
```

**Przed i po:** wyłącznie `src/lib/supabase.ts` — ta zależność jest poprawna (fabryka SSR klienta).

### Mapa: które pliki znają Supabase dziś vs. po refaktorze

| Plik | Dziś zna Supabase | Po refaktorze |
|------|-------------------|---------------|
| `src/env.d.ts` | TAK (`User`) | NIE (`AuthenticatedUser`) |
| `src/lib/supabase.ts` | TAK (fabryka SSR) | TAK (fabryka SSR — poprawne) |
| `src/lib/supabase-admin.ts` | TAK (fabryka admin) | TAK (fabryka admin — poprawne) |
| `src/lib/services/vehiclePageData.ts` | TAK | NIE |
| `src/lib/demo-seed.ts` | TAK | NIE (otrzymuje `IVehicleRepository`, `IRepairRepository`) |
| `src/pages/api/repairs.ts` | TAK (`supabase.from`) | TAK — API route tworzy adapter; akceptowalne |
| `src/pages/api/*/[id].ts` (4 pliki) | TAK | TAK — API route tworzy adapter; akceptowalne |
| `src/pages/dashboard/*.astro` (3 pliki) | TAK | TAK — page tworzy adapter; akceptowalne |
| `src/lib/infrastructure/supabase/` (3 pliki) | NIE (nowe) | TAK — jedyna odpowiedzialność |

> **Uwaga:** API routes i pages nadal tworzą adaptery Supabase — to akceptowalne, bo są to wejścia aplikacji (warstwa HTTP). Porty ACL ograniczają przeciek do serwisów i typów kontraktowych; nie eliminują Supabase z warstwy HTTP.

---

### Plan faz

Zgodny z konwencją projektu: `context/changes/<change-id>/`.

#### Faza 1 — Typ domenowy `AuthenticatedUser` + aktualizacja env.d.ts i middleware

**Pliki do zmiany:**
- `src/lib/domain/AuthenticatedUser.ts` — nowy plik (interfejs `AuthenticatedUser`)
- `src/env.d.ts:3` — zastąpić `import("@supabase/supabase-js").User` przez `import("@/lib/domain/AuthenticatedUser").AuthenticatedUser`
- `src/middleware.ts` — mapowanie `supabase.auth.getUser().data.user` → `AuthenticatedUser { id, email }`

**Weryfikacja fazy 1:** `grep "@supabase/supabase-js" src/env.d.ts` — brak wyników.

---

#### Faza 2 — Definicja portów (interfejsów repozytoriów)

**Pliki do zmiany:**
- `src/lib/ports/IVehicleRepository.ts` — nowy plik
- `src/lib/ports/IRepairRepository.ts` — nowy plik
- `src/lib/ports/IServiceThresholdRepository.ts` — nowy plik

Tylko definicje interfejsów i typów wejściowych — zero importów z `@supabase/*`.

**Weryfikacja fazy 2:** `grep "@supabase" src/lib/ports/` — brak wyników.

---

#### Faza 3 — Adaptery Supabase implementujące porty

**Pliki do zmiany:**
- `src/lib/infrastructure/supabase/SupabaseVehicleRepository.ts` — nowy plik
- `src/lib/infrastructure/supabase/SupabaseRepairRepository.ts` — nowy plik
- `src/lib/infrastructure/supabase/SupabaseServiceThresholdRepository.ts` — nowy plik

Przeniesienie wszystkich `supabase.from("cars"|"repairs"|"service_thresholds")` z API routes
i serwisów do adapterów. Każdy adapter enkapsuluje mapowanie DB row → typ domenowy.

**Weryfikacja fazy 3:** Każdy adapter kompiluje się z `tsc --noEmit`; testy jednostkowe
adapterów (in-memory lub z real Supabase) przechodzą.

---

#### Faza 4 — Refaktor `vehiclePageData.ts`

**Pliki do zmiany:**
- `src/lib/services/vehiclePageData.ts` — zmiana sygnatury (3 porty zamiast `SupabaseClient`)
- `src/pages/dashboard/vehicles/[id].astro` — tworzenie adapterów i przekazanie do serwisu

**Weryfikacja fazy 4:** `grep "SupabaseClient" src/lib/services/vehiclePageData.ts` — brak;
`vitest run` — wszystkie testy serwisu przechodzą.

---

#### Faza 5 — Refaktor `demo-seed.ts`

**Pliki do zmiany:**
- `src/lib/demo-seed.ts` — zmiana sygnatury (przyjmuje `IVehicleRepository + IRepairRepository + IServiceThresholdRepository` zamiast `SupabaseClient`)
- `src/pages/api/demo.ts` — tworzenie adapterów admin-client i przekazanie do `seedDemoData`

**Weryfikacja fazy 5:** `grep "@supabase/supabase-js" src/lib/demo-seed.ts` — brak;
demo flow E2E przechodzi.

---

#### Faza 6 (opcjonalna) — Migracja API routes do adapterów

API routes mogą stopniowo delegować operacje przez adaptery zamiast wołać `supabase.from()`
bezpośrednio. Zakres: `src/pages/api/repairs.ts`, `repairs/[id].ts`, `vehicles.ts`,
`vehicles/[id].ts`, `service-thresholds.ts`, `service-thresholds/[id].ts`.

Faza opcjonalna — główny cel ACL (ochrona serwisów i typów kontraktowych) jest osiągnięty
po fazach 1–5. Faza 6 zwiększa spójność i testowalność API routes, ale nie jest blokująca.

---

## Podsumowanie

Główny przeciek zidentyfikowany w projekcie to `SupabaseClient` jako bezpośredni parametr serwisów aplikacyjnych (`vehiclePageData.ts` i `demo-seed.ts`), co narusza zasadę odwrócenia zależności — serwisy znają infrastrukturę zamiast zależeć od portów. Dodatkowym, wirusowym przeciekiem jest typ `@supabase/supabase-js`.User w `env.d.ts`, który propaguje zależność SDK do każdej strony aplikacji przez `Astro.locals.user`. Plan definiuje trzy porty repozytoriów (`IVehicleRepository`, `IRepairRepository`, `IServiceThresholdRepository`) i domenowy typ `AuthenticatedUser`, a następnie przenosi całą wiedzę o Supabase do katalogu `src/lib/infrastructure/supabase/`. Po refaktorze grep po `@supabase/supabase-js` poza katalogiem infrastruktury zwraca wyłącznie poprawne fabryki klientów. Serwis `vehiclePageData.ts` staje się testowalny przez proste in-memory stuby bez mockowania całego SDK. Plan jest podzielony na 5 obowiązkowych faz i 1 opcjonalną, każda z kryterium weryfikacji grep/tsc/vitest.

# Artifact 1 — Territory (historia zmian i aktywne obszary)

> Źródło: git log ostatnie 12 miesięcy (od 2025-06-18). Odfiltrowano lockfile'y, snapshoty, generowane pliki, configi.
> Data analizy: 2026-06-18

## TOP 10 folderów / modułów

| # | Folder | Commits | Charakter |
|---|--------|:---:|-----------|
| 1 | `src/pages/api/repairs` + `repairs.ts` | 13 | API CRUD napraw — najgorętszy endpoint |
| 2 | `src/components/repairs/` | 13 | UI napraw (lista, formularze, kategorie) |
| 3 | `src/lib/` (schemas, costPerKm, classify) | 14 | Logika biznesowa — walidacja, koszt/km, AI |
| 4 | `src/pages/dashboard/vehicles/` | 7+ | Widok szczegółów pojazdu |
| 5 | `src/pages/api/__tests__/` | 17 | Testy API — dużo churn |
| 6 | `src/lib/__tests__/` | 8 | Testy jednostkowe logiki |
| 7 | `supabase/` | 16 | Migracje + seed |
| 8 | `src/components/vehicles/` | 8 | Karty pojazdów, wykresy kosztów |
| 9 | `e2e/` | 12 | Testy E2E |
| 10 | `src/pages/api/auth/` | 3 | Auth endpoints (stabilne, mało zmian) |

## TOP 10 plików

| # | Plik | Commits | Co się dzieje |
|---|------|:---:|---------------|
| 1 | `src/pages/dashboard/vehicles/[id].astro` | 7 | Główny widok detali — agreguje naprawy, wykresy, przypomnienia |
| 2 | `src/pages/api/repairs/[id].ts` | 7 | PATCH/DELETE naprawy |
| 3 | `src/lib/schemas.ts` | 7 | Schematy zod — ewoluują z każdą nową walidacją |
| 4 | `src/pages/api/repairs.ts` | 6 | GET/POST naprawy |
| 5 | `src/components/repairs/RepairList.tsx` | 6 | Lista napraw — edycja, usuwanie, kategorie |
| 6 | `src/types.ts` | 5 | Shared entity types |
| 7 | `src/lib/costPerKm.ts` | 4 | Kalkulacja koszt/km |
| 8 | `src/lib/__tests__/costPerKm.test.ts` | 5 | Testy kalkulacji |
| 9 | `e2e/data-isolation.spec.ts` | 4 | E2E izolacja danych |
| 10 | `src/components/repairs/EditRepairForm.tsx` | 3 | Formularz edycji naprawy |

## Sprzężenia — pary i trójki katalogów w tych samych commitach

### TOP pary (co-change)

| # | Para | Commits razem |
|---|------|:---:|
| 1 | `lib` ↔ `pages/vehicles` | **6** |
| 2 | `supabase` ↔ `types.ts` | 5 |
| 3 | `lib` ↔ `supabase` | 5 |
| 4 | `components/vehicles` ↔ `lib` | 4 |
| 4 | `components/repairs` ↔ `lib` | 4 |
| 4 | `api/repairs` ↔ `lib` | 4 |
| 4 | `components/vehicles` ↔ `pages/vehicles` | 4 |
| 4 | `pages/vehicles` ↔ `supabase` | 4 |

### TOP trójki

| Trójka | Commits |
|--------|:---:|
| `lib` ↔ `pages/vehicles` ↔ `supabase` | **4** |
| `components/vehicles` ↔ `lib` ↔ `pages/vehicles` | 3 |
| `lib` ↔ `pages/vehicles` ↔ `types.ts` | 3 |
| `lib` ↔ `supabase` ↔ `types.ts` | 3 |

### Wnioski dla TOP 3

1. **`api/repairs` + `components/repairs` + `lib`** — klasyczny trójkąt feature'u. `lib/schemas.ts` jest spoiwem (walidacja zod dzielona między API i UI). Sprzężenie uzasadnione (wspólny kontrakt), ale schemas.ts to potencjalny bottleneck przy równoległej pracy.

2. **`supabase` ↔ `types.ts` ↔ `lib`** — łańcuch propagacji schematu: migracja SQL → aktualizacja typu TS → aktualizacja logiki. 5 commitów razem = prawie każda migracja wymaga zmian w obu. Ręczny sync — brak codegen z bazy.

3. **`lib` ↔ `pages/vehicles/[id]`** — najsilniejsza para (6 commitów). `[id].astro` to "god page" — importuje `costPerKm`, `serviceReminders`, `schemas` bezpośrednio. Każda zmiana w logice biznesowej wymusza zmianę widoku. Brak warstwy pośredniej między lib a page.

## Pliki cross-cutting ("wspólne mianowniki")

| Plik | Commits | Obszarów | Rola |
|------|:---:|:---:|------|
| **`src/lib/schemas.ts`** | 7 | 13 | #1 connector — zod schematy dzielone przez API, UI, service-reminders, vehicles |
| **`src/types.ts`** | 5 | 12 | #2 connector — entity types, łańcuch: migracja SQL → types.ts → reszta repo |
| **`supabase/seed.sql`** | 5 | 11 | #3 connector — seed data rośnie z każdym nowym feature |

`vehicles/[id].astro` (7 commitów, 10 obszarów) to nie connector, lecz **konsument** — god page importująca z wielu miejsc, ale nie importowana przez inne.

`Welcome.astro`, `Layout.astro`, `Topbar.astro` — wysoki wynik (14 obszarów) to artefakt dużych commitów bootstrapowych (2-3 commity), nie regularna aktywność.

## Weryfikacja istnienia plików

**27/28 plików z analizy nadal istnieje w repo.**

| Plik | Status | Uwaga |
|------|--------|-------|
| `src/pages/dashboard.astro` | USUNIĘTY | Zastąpiony przez `dashboard/vehicles/index.astro` w commicie `7430042`. Redirect logic przeniesiona do middleware. |

Reszta analizy opiera się na żywych plikach.

# Raport Architektoniczny — Moduł 4

> Data: 2026-06-28. Artefakty: L2 (repo-map), L3 (research), L4 (plan), L5 (domain/*.md).

---

## 1. Opisane projekty

| Repo | Stack | Skala | Artefakty |
|------|-------|-------|-----------|
| **car-repair-tracker** | Astro 6 SSR + React 19 islands, Supabase (Postgres + RLS), Tailwind 4, Google Gemini 2.5 Flash-Lite | ~136 commitów, 1 kontrybutor, ~20 plików TS | L2, L3, L4, L5 |

Wszystkie artefakty modułu 4 pochodzą z tego samego repo.

---

## 2. Mapa projektu (z L2)

**1. God-page jako centrum ciężkości.** `vehicles/[id].astro` — 10+ importów, 3 domeny, 6 commitów co-change z `lib/`. Każda zmiana logiki biznesowej wymusza edycję tego pliku. Najsilniejsza para co-change w repo.

**2. `schemas.ts` — merge-conflict bottleneck.** Łączy 13 obszarów. Odkryty import leak: `schemas.ts → classifyRepair.ts → @google/genai` — każdy test walidacji ładuje Gemini SDK tranzytywnie.

**3. Łańcuch propagacji schematu jest ręczny.** `supabase/migrations/*.sql → src/types.ts → lib/ + components/ + pages/` — brak codegen. Widoczny w 5 co-change commitach. Każda migracja wymaga ręcznej aktualizacji typów.

**4. Warstwia `.astro` niewidoczna dla grafu.** Dependency-cruiser nie parsuje `.astro` — warstwa stron znana tylko z grepa. Graf zależności transytywnych jest niekompletny.

**5. Projekt single-contributor.** 136 commitów — jedna osoba. Cała wiedza domenowa w jednej głowie; brak mechanizmu dzielenia wiedzy poza `CLAUDE.md`.

---

## 3. Analiza ficzera (z L3)

**Badany przepływ:** `vehicles/[id].astro` — strona szczegółów pojazdu. Naturalna ofiara strefy ryzyka #3 z mapy (god-page, 6 co-change z lib/).

**Feature overview:** Strona pobiera z Supabase 3 zapytania (pojazd, naprawy, progi serwisowe), wywołuje 6 funkcji obliczeniowych (`computeCostPerKm`, `computeThresholdSummary` + 4 trend), a wynik renderuje przez 5 wysp React (`client:load`). Cały 60-linijkowy blok orkiestracji siedzi w frontmatter strony. Sukces-message routing dowiązuje stronę do konwencji redirectów 4 endpointów API.

**Technical debt (wszystkie potwierdzone kodem):**

- **K3 — import leak `schemas.ts → classifyRepair.ts → @google/genai`** [potwierdzony: `src/lib/schemas.ts:2` — `from "@/lib/classifyRepair"`; ścieżka prosta: `repairCategories.ts` istnieje jako czyste źródło; `CategorySelect.tsx` już importuje stamtąd bezpośrednio]. Efekt: 5 API routes ciągnie Gemini SDK tranzytywnie przy imporcie schematów.

- **K1 — brak warstwy serwisowej** [potwierdzony: `src/lib/services/` nie istnieje w dacie badania; 3 `select("*") as Type` casts w `[id].astro:31,43,53` — wzorzec odwrotny do API routes, które używają explicitnych kolumn]. Blast radius każdej zmiany lib/ = edycja god-page.

- **K6 — `window.location.reload()` po delete** [potwierdzony: `RepairList.tsx:30`, `ServiceThresholdList.tsx:37`; wzorzec niezgodny z `CategorySelect.tsx:16-31`, który używa local state — oba pliki z tego samego modułu]. Reload = 3 zapytania Supabase + 5 wysp React przy usunięciu 1 rekordu.

---

## 4. Plan refaktoryzacji (z L4)

**Wybrana opcja:** czysta ekstrakcja — K3 → K1+K2 → testy serwisu → K6. Brak zmian kontraktu API, schematu DB, ani zachowania.

**Czego świadomie NIE robimy:** K4 (podział `schemas.ts` — 63 linie, nie bottleneck), K5 (nieatomowe operacje DB — RLS jako safety net, brak transakcji w Supabase JS), K7 (codegen typów — defer do kolejnej migracji), 4. `select("*")` w `repairs/[id]/edit.astro` (poza zakresem).

**Fazy:**

| Faza | Zakres | Weryfikacja |
|------|--------|-------------|
| P1: Fix import leak (K3) | 1 linia: `schemas.ts:2` | auto: astro check + build + lint + test |
| P2: Extract vehiclePageData service (K1+K2) | nowy `src/lib/services/vehiclePageData.ts`, refaktor `[id].astro` | auto: jw. + E2E; ręcznie: strona ładuje wszystkie sekcje |
| P3: Testy serwisu | nowy `src/lib/services/__tests__/vehiclePageData.test.ts` | auto: vitest |
| P4: Replace reload z local state (K6) + testy komponentów | `RepairList.tsx`, `ServiceThresholdList.tsx`, 2 pliki testów, E2E adjust | auto: jw.; ręcznie: delete bez page flash |

**Status Progress (z planu):** P1, P3, P4 — wszystkie checkboxy `[x]`. P2 — automated `[x]`, manual `[ ]` (2.6–2.8 bez potwierdzenia człowieka).

---

## 5. Domena wg DDD (z L5)

**Ubiquitous language — kluczowe pojęcia:**

| Termin | Źródło | Rozjazd model-vs-kod |
|--------|--------|----------------------|
| `baseline_mileage` | PRD FR-002; `types.ts:36` | Spójny |
| `cost_per_km` | PRD FR-007; `costPerKm.ts:8-14` | Spójny (obliczany, nie persystowany) |
| `warning_margin` | PRD FR-009: "Owner can configure" | **BRAK w kodzie** — hardcoded 10% km i 30 dni (`serviceReminders.ts:36,46`) |
| `archived_at` | PRD FR-002: "restorable" | Połowiczna impl. — `is("archived_at", null)` istnieje; brak endpoint restore |
| `pending` | PRD FR-011 | Quasi-kategoria poza enum — zapisywana do `category text` (nullable) |

**Niezmiennik #1: `Repair.mileage ≥ Vehicle.baseline_mileage`**  
Fundament metryki `cost_per_km` (PRD Vision: "number that informs the keep-or-sell decision"). Agregat: **`Vehicle`** jako aggregate root — naprawa istnieje tylko w kontekście pojazdu i jej poprawność zależy od `baseline_mileage` pojazdu.

Egzekucja dziś: UI client (`AddRepairForm.tsx:52`), POST handler (`repairs.ts:46-49`), PUT handler (`repairs/[id].ts:57-60`). **Zero DB CHECK constraint** — bezpośredni zapis przez Supabase API omija wszystkie guardy. `costPerKm.ts:4-5` maskuje naruszenie (`Math.max`) zamiast fail-fast.

**Anti-Corruption Layer — przeciek:**  
`SupabaseClient` jako parametr `getVehiclePageData(supabase: SupabaseClient, ...)` w `src/lib/services/vehiclePageData.ts:33` — serwis aplikacyjny bezpośrednio zna infrastrukturę. Propagacja: `@supabase/supabase-js`.User w `src/env.d.ts:3` → każda strona i API route przez `Astro.locals.user`. Łącznie 5 plików poza warstwą HTTP zna `@supabase/supabase-js` [potwierdzono: `grep "@supabase/supabase-js" src/`]. Plan ACL definiuje 3 porty (`IVehicleRepository`, `IRepairRepository`, `IServiceThresholdRepository`) + `AuthenticatedUser` — po refaktorze grep poza `src/lib/infrastructure/supabase/` = 0 wyników.

---

## 6. Decyzje, które należą do mnie

**K5 (nieatomowe operacje DB) — defer.** AI klasyfikuje to jako "accidental complexity" i proponuje Postgres function przez `supabase.rpc()`. Zdecydowałem się odroczyć: RLS jest wystarczającym safety netem, a krok 5 (AI call) jest idempotentny — faktyczne ryzyko partial failure jest niskie przy obecnej skali.

**K7 (codegen typów) — defer do kolejnej migracji.** AI rekomenduje `supabase gen types typescript` jako samodzielny refaktor. Wybrałem wejście do codegen przy okazji następnej zmiany schematu — standalone refaktor dodałby kosztu bez wartości dla użytkownika.

**ACL — faza 6 opcjonalna.** Plan ACL proponuje migrację API routes do adapterów (faza 6). To zdecydowałem jako opcjonalne — główny cel (ochrona serwisów) jest osiągnięty po fazach 1–5; migracja 19 plików API routes dodałaby blast radius bez proporcjonalnego zysku na tym etapie projektu.

**Vehicle jako aggregate root — nie implementuję teraz.** DDD plan (L5 `02-invariant-aggregate-refactor.md`) projektuje `src/domain/vehicle/Vehicle.ts` z metodą `assertRepairMileageValid`. To architektonicznie słuszne, ale wymaga nowej warstwy domenowej i 4 faz zmian. Przy single-contributor projekcie odkładam to do czasu, gdy złożoność niezmienników uzasadni overhead warstwy domenowej.

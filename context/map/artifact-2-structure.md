# Artifact 2 — Structure (zależności, granice warstw, testowalność)

> Źródło: dependency-cruiser `--no-config` + grep (uzupełnienie .astro), metryki fan-in/fan-out, analiza importów.
> Zakres: aktywne obszary z artifact-1-territory.md — `repairs`, `lib`, `pages/dashboard/vehicles`.
> Data analizy: 2026-06-18

---

## 1. Cykle zależności

**Wynik: ZERO cykli w kodzie projektu.**

Jedyne cykle — wewnętrzne w `recharts` (third-party, `Area ↔ areaSelectors`, `Bar ↔ BarStack ↔ barSelectors`). Nie blokują zmian w repo.

Ograniczenie narzędzia: dependency-cruiser nie parsuje `.astro` — cała warstwa stron jest niewidoczna. Uzupełniono grepem.

## 2. Granice warstw — wynik audytu

| Reguła | Wynik | Uwagi |
|--------|-------|-------|
| `lib/` → `pages\|components\|layouts` | **PASS** | Zero naruszeń |
| `components/` → `pages/` | **PASS** | Zero naruszeń |
| `types.ts` → `src/` | **PASS** | Czysty liść, zero importów |
| `ui/` → non-ui `src/` (poza `lib/utils`) | **PASS** | `alert-dialog → button` — wewnątrz ui/, akceptowalne |
| `api/` → `components/` | **PASS** | Zero naruszeń |
| `pages/` → `pages/` (cross-page) | **PASS** | 6 wyników — wszystkie w `api/__tests__/` (testy importują endpointy). Zero w produkcji |
| Domeny komponentów (cross-domain) | **PASS** | `repairs/ ↛ vehicles/`, `vehicles/ ↛ repairs/`, `service-reminders/ ↛ repairs\|vehicles/` |
| Komponenty → baza danych | **PASS** | Żaden komponent nie importuje `supabase.ts`. Data-fetching w .astro i API routes |
| Komponenty → `lib/` (charakter) | **PASS** | Wyłącznie typy i stałe: `cn()`, `REPAIR_CATEGORIES`, `type ThresholdWithStatus`, `type CostTrendPoint` |

**Architektura warstw jest wzorcowa — zero naruszeń krytycznych granic.**

## 3. Metryki coupling — kluczowe moduły

| Moduł | Fan-in | Fan-out | Instability | Rola |
|-------|:------:|:-------:|:-----------:|------|
| `supabase.ts` | 15 | 0 | 0.00 | Megahub — każdy API route i strona .astro. Stabilny, ale zmiana sygnatury = 15 plików |
| `types.ts` | 13 | 0 | 0.00 | Leaf — entity types. Zmiana interfejsu propaguje do 13 plików. Brak codegen z DB |
| `schemas.ts` | 5 | 1 | 0.17 | Connector #1 — walidacja zod. Importuje `classifyRepair` (re-export kategorii) |
| `utils.ts` | 6 | 0 | 0.00 | `cn()` helper — stabilny, niski risk |
| `classifyRepair.ts` | 3 | 1 | 0.25 | Środek łańcucha schemas→classify→categories. External API (Gemini) |
| `vehicles/[id].astro` | 0 | 10+ | — | God-page — 10+ importów z 5 modułów, 3 domeny komponentów |

### Łańcuch propagacji schematu

```
supabase/migrations → types.ts → lib/ + components/ + pages/
```

Ręczny sync — brak codegen. Co-change `supabase ↔ types.ts` w 5 commitach.

### God-page problem

`vehicles/[id].astro` importuje z: `lib/supabase`, `lib/costPerKm`, `lib/serviceReminders`, `components/repairs/RepairList`, `components/vehicles/CostTrendChart`, `components/service-reminders/` (3 pliki), `types.ts`. Jedyna strona łamiąca zasadę "1 strona = 1 domena".

## 4. Ryzyka testowalności — repairs + lib

### Klasyfikacja side-effects per moduł

| Kolor | Znaczenie | Moduły |
|-------|-----------|--------|
| pure (zielony) | Zero mocków | `costPerKm`, `serviceReminders`, `utils`, `repairCategories`, `types.ts`, formy, badge |
| platform (złoty) | Wymaga `vi.mock` na `astro:env` | `supabase.ts`, `schemas.ts`, API routes, `supabase-admin`, `config-status` |
| external API (czerwony) | HTTP call do Gemini | `classifyRepair.ts` |
| browser (niebieski) | `fetch()` + `window.reload()` | `RepairList.tsx` |
| page (szary) | .astro — niewidoczna dla depcruise, wymaga e2e | `[id].astro`, `new.astro`, `edit.astro` |

### TOP 7 ryzyk testowych

| # | Moduł | Aktywność | Ryzyko | Rekomendacja |
|---|-------|-----------|--------|-------------|
| 1 | `repairs/[id].ts` | 7 commitów, #2 plik | 179 linii, 3 endpointy, sekwencja 4 ops DB, logika reklasyfikacji AI wpleciona w handler. Mock queue musi odwzorować kolejność operacji | Unit z mockami (obecne) + integracyjny z Supabase na mileage validation |
| 2 | `classifyRepair.ts` | lib aktywny (14 commitów) | Cała funkcja zamockowana — parsing odpowiedzi Gemini (`trim().toLowerCase()`, match do kategorii) ZERO coverage | Unit z mock `GoogleGenAI` (nie mock całej funkcji) |
| 3 | `schemas.ts` | 7 commitów, connector #1 | Import `REPAIR_CATEGORIES` przez `classifyRepair` ciągnie Gemini + `astro:env` do testów walidacji | **Refaktor**: import bezpośrednio z `repairCategories.ts` |
| 4 | `RepairList.tsx` | 6 commitów, #5 plik | `fetch()` + `window.reload()` — brak jakichkolwiek testów | E2e (Playwright) dla delete flow |
| 5 | `supabase.ts` | 15 importerów | Każdy test API zależy od globalnego mocka. Cookie handling i RLS nietestowane | Integracyjny z local Supabase |
| 6 | `repairs.ts` POST | 6 commitów | FormData parsing + redirect + multi-step DB. Mock queue krucha przy zmianach | Assert kolejności DB calls (`toHaveBeenNthCalledWith`) |
| 7 | `costPerKm.ts` | 4 commity | **ZERO ryzyka** — pure functions, dobrze pokryte. Wzorzec do naśladowania | Brak akcji |

### Kluczowy finding: tranzytywny leak side-effectu

```
schemas.ts  ──[import]──▶  classifyRepair.ts  ──[import]──▶  repairCategories.ts
                                    │
                              GoogleGenAI + astro:env/server
```

`schemas.ts` importuje `REPAIR_CATEGORIES` przez re-export z `classifyRepair.ts`. To ciągnie `@google/genai` + `astro:env/server` do każdego testu walidacji. Fix: 1-liniowa zmiana importu na bezpośredni z `repairCategories.ts`.

### Obecna strategia testowa

- Globalny `vi.mock` na `supabase`, `classifyRepair`, `astro:env/server` w `setup.ts`
- Chainable mock Supabase z kolejką wyników (`mockResult`, `mockResults`)
- Factory helpers: `makeVehicle`, `makeRepair`, `makeServiceThreshold`, `createMockContext`
- Strategia działa, ale: mock queue krucha (kolejność = kontrakt), classify zamockowany w całości (parsing nietestowany)

## 5. Wizualizacja

Graf testowalności: `context/map/testability-risk.dot` ([SVG](testability-risk.svg) | [PNG](testability-risk.png))

Pytanie grafu: "Gdzie tranzytywne side-effects utrudniają testowanie w izolacji?"

Kolory node'ów = klasyfikacja side-effects. Bold red edge = `schemas → classifyRepair` (jedyny punkt przecieku). Dotted edges = importy .astro (depcruise-invisible).

## 6. Akcje do rozważenia

| # | Akcja | Koszt | Zysk |
|---|-------|-------|------|
| 1 | `schemas.ts`: zmień import `REPAIR_CATEGORIES` z `classifyRepair` na `repairCategories` | 1 linia | Eliminuje tranzytywne ciągnięcie Gemini do testów walidacji |
| 2 | Test `classifyRepair` z mock `GoogleGenAI` (nie mock całej funkcji) | Nowy plik testowy | Pokrycie parsingu odpowiedzi Gemini, timeout handling, fallback |
| 3 | E2e test delete repair flow w `RepairList.tsx` | Playwright test | Weryfikacja jedynego netestowanego aktywnego komponentu (6 commitów) |
| 4 | Assert kolejności DB calls w testach API repairs | Zmiana w istniejących testach | Ochrona przed cichym failem gdy dodasz nową operację DB |
| 5 | Codegen `supabase → types.ts` | Konfiguracja toolingu | Eliminacja ręcznego sync schematu (5 co-change commitów) |
| 6 | Rozbicie `[id].astro` god-page | Refaktor | Zmniejszenie fan-out z 10+ i oddzielenie domen |

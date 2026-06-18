# Artifact 3 — Contributors (autorstwo i ekspertyza per obszar)

> Źródło: git log ostatnie 12 miesięcy (od 2025-06-18), odfiltrowano boty, automatyzacje i commity agentów bez wyraźnego autorstwa człowieka.
> Data analizy: 2026-06-18

## Podsumowanie

Projekt jest **100% single-contributor**. Jedyny ludzki autor: **Maciej Szklarczyk**.

Dwie tożsamości git, ta sama osoba:

| Tożsamość | Email | Commity | Źródło |
|-----------|-------|:---:|--------|
| Maciej Szklarczyk | maciej.szklarczyk@hotmail.com | 115 | Lokalne commity |
| maciejszklarczyk | 34677047+maciejszklarczyk@users.noreply.github.com | 21 | Merge PRs z GitHub UI |

Zero botów (brak Dependabot/Renovate). Zero trailerów Co-Authored-By. Brak innych ludzi w historii.

---

## Aktywność per kluczowy obszar

### 1. `schemas.ts` + `lib/` — logika biznesowa

| Temat | Commity | Charakter |
|-------|:---:|-----------|
| AI classification (Gemini) | 5 | Nowy feature end-to-end: serwis → API → UI → review fixes |
| Cost/km + mileage tracking | 5 | Fix derivowania przebiegu, kalkulacja, testy |
| Service reminders | 2 | Progi serwisowe, testy |
| Walidacja (zod schemas) | 3 | Ewoluuje z każdym feature |

### 2. `types.ts` + `supabase/migrations/`

| Temat | Commity | Charakter |
|-------|:---:|-----------|
| Schema evolution | 6 | Migracje: RLS policies, kategorie, threshold, seed |
| E2E infra | 3 | DELETE policy, auth fixture, seed cleanup |
| Mileage refaktor | 2 | Drop `current_mileage` z DB i app |

### 3. `vehicles/[id].astro` — god page

| Temat | Commity | Charakter |
|-------|:---:|-----------|
| Feature integration | 5 | Naprawy, cost/km, wykresy, remindery — wszystko ląduje tu |
| Bug fixes | 3 | Daty, mileage display, type errors |
| Mileage refaktor | 2 | Propagacja zmian z lib/ |

### 4. `api/repairs/` + `components/repairs/`

| Temat | Commity | Charakter |
|-------|:---:|-----------|
| CRUD napraw | 5 | POST, PUT, DELETE, formularze |
| AI classification wiring | 4 | Endpoint + UI + review fixes |
| Sentry/error handling | 3 | Throw on error, testing, column fix |
| E2E testing | 2 | Repair lifecycle test |

### 5. `supabase/` (migracje + seed)

| Temat | Commity | Charakter |
|-------|:---:|-----------|
| Feature migrations | 6 | RLS, kategorie, thresholds, baseline |
| Demo data | 4 | Seed data, demo cleanup workflow |
| E2E fixtures | 3 | Test users, delete policies |

---

## Implikacje dla onboardingu

Brak zewnętrznych kontrybutorów = cała wiedza domenowa w jednej głowie. Wąskie gardła przy onboardingu nowej osoby:

1. **`schemas.ts`** (connector #1, 13 zależnych obszarów) — merge conflict prawie pewny przy równoległej pracy na feature'ach napraw.
2. **`types.ts`** (13 importerów, ręczny sync z migracjami) — nowa osoba musi rozumieć łańcuch propagacji `migracja SQL → types.ts → reszta repo`.
3. **`vehicles/[id].astro`** (god page, 10+ importów z 5 modułów) — wielu kontrybutorów pracujących na różnych feature'ach ląduje w tym samym pliku.

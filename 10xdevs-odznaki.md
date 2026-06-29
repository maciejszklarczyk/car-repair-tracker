# Odznaki 10xDevs — checklista

## Builder (moduły 1–3) — certyfikat bazowy

- [x] Komplet CRUD dla co najmniej jednego zasobu — repairs: POST/PUT/DELETE/PATCH + read (`src/pages/api/repairs/`)
- [x] Jedna funkcja z logiką biznesową — `costPerKm.ts`, `classifyRepair.ts`, `serviceReminders.ts`
- [x] Jeden zestaw testów adresujący jedno ryzyko z test planu — 114+ unit tests (costPerKm, serviceReminders, API routes) + E2E
- [x] Artefakty z M1–M3: PRD, specyfikacje, plany, kontekst dla AI — prd.md, shape-notes.md, tech-stack.md, roadmap.md, test-plan.md, 20+ planów zmian
- [x] Mechanizm kontroli dostępu (logowanie lub inny odpowiedni mechanizm) — Supabase auth + middleware chroniący `/dashboard`
- [x] CI/CD pipeline (build + testy) — `ci.yml`: lint, test, build, e2e jako równoległe joby

## Architect (moduł 4)

- [x] `repo-map.md` — mapa repozytorium z dowodami i strefami ryzyka (M4L2) — `context/map/repo-map.md` + territory, structure, contributors, testability-risk
- [x] `research.md` — research wybranego ficzera: trace end-to-end, luki testowe, blast radius (M4L3) — wiele plików w `context/changes/`
- [x] `plan.md` — plan refaktoryzacji z fazami i kryteriami weryfikacji (M4L4) — 19+ planów w `context/changes/`
- [x] `context/domain/` — notatki o domenie inspirowane DDD (M4L5) — 3 pliki: domain-distillation, invariant-aggregate-refactor, anti-corruption-layer
- [ ] Raport architektoniczny złożony z powyższych 4 artefaktów → formularz certyfikacyjny ⚠️ artefakty gotowe, trzeba złożyć formularz

## Champion (moduł 5) — wybierz jedną ścieżkę

### Ścieżka A: Pipeline CI/CD (M5L2 + M5L3) ✅ wybrana ścieżka
- [x] Widok pipeline'u z co najmniej jednym widocznym jobem — `ci.yml` (4 joby: lint, test, build, e2e) + `ai-review.yml`
- [x] Logi z pipeline'u lub joba — GitHub Actions dostarcza logi automatycznie
- [x] Screenshot komentarza od LLM z review na PR — PR #55, komentarz "AI Code Review: pass" od github-actions bot

### Ścieżka B: Rejestr artefaktów zespołowych (M5L4)
- [ ] Repozytorium lub rejestr z działającym przepływem
- [ ] Definicja paczki lub równoważna definicja artefaktu
- [ ] Lista wydanych wersji

---

> Moduły 4 i 5 nie są wymagane do Buildera.
> Dowody dla Championa mogą być zrzutami ekranu — nie trzeba publikować firmowego kodu.
> Formularz certyfikacyjny pojawia się w ostatnim tygodniu kursu (po premierze modułu 5).

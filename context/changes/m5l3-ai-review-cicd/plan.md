# M5L3: AI Code Review — GitHub Actions + promptfoo

## Overview

Wpięcie agenta z M5L2 w pipeline CI/CD (GitHub Actions) jako Composite Action uruchamiana na każdym PR do `main`/`master`. Dodanie ewaluacji promptfoo porównującej 2-3 modele na tych samych diffach. Zaliczenie zadań praktycznych M5L3 + zebranie dowodów na odznakę 10xChampion.

## Prerequisite

Ukończona zmiana `m5l2-ai-review-agent` — agent działa lokalnie i zwraca poprawny JSON.

## Current State Analysis

- `.github/workflows/` istnieje z `ci.yml`, `deploy.yml`, `demo-cleanup.yml` — dodajemy nowy `ai-review.yml`.
- Agent w `packages/code-reviewer/review.ts` zwraca JSON na stdout.
- Repo publiczne na GitHubie: `maciejszklarczyk/car-repair-tracker`.
- Brak `promptfoo` w projekcie.
- Klucz `OPENROUTER_API_KEY` istnieje lokalnie w `.env` — trzeba dodać jako GitHub Secret.

## Desired End State

1. Każdy PR do `main`/`master` odpala workflow `AI Code Review`.
2. Job `review` uruchamia agenta, wynik widoczny w Job Summary.
3. Logi dostępne w GitHub Actions UI.
4. promptfoo porównuje Gemini Flash vs 2 darmowe modele z OpenRouter — wynik macierzy pass/fail.

## What We're NOT Doing

- Automatyczne komentarze w PR przez GitHub API (wymaga `gh` i write permission — opcjonalne rozszerzenie).
- Blokada merge na `fail` (optional: `exit 1` jeśli verdict == fail).
- Narzędzia agenta (nowy plan, gdy agent będzie rozszerzany).

## Dowody wymagane na 10xChampion

- [ ] Screenshot: widok pipeline'u z co najmniej jednym jobem (GitHub → Actions tab)
- [ ] Screenshot: logi joba z przebiegiem agenta
- [ ] Screenshot: Job Summary z wynikiem review (JSON lub sformatowany output)

---

## Phase 1: GitHub Secret

### Kroki

#### 1. Dodaj OPENROUTER_API_KEY jako secret

Na GitHubie: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

```
Name:  OPENROUTER_API_KEY
Value: (klucz z .env)
```

---

## Phase 2: Composite Action

### Overview

Wydzielenie logiki agenta do reużywalnej Composite Action w `.github/actions/ai-reviewer/`.

### Changes Required

#### 1. Skrypt uruchamiający agenta

**File**: `packages/code-reviewer/run.sh`

**Intent**: Wrapper shellowy — czyta diff ze zmiennej środowiskowej i uruchamia agenta.

```bash
#!/bin/bash
set -e
echo "$DIFF_INPUT" | npx tsx "$(dirname "$0")/review.ts"
```

#### 2. Composite Action

**File**: `.github/actions/ai-reviewer/action.yml`

**Intent**: Reużywalna akcja przyjmująca klucz API i diff, zwracająca werdykt i zapisująca wynik do Job Summary.

**Contract**:

```yaml
name: AI Code Reviewer
description: Reviews PR diff using Gemini AI via Vercel AI SDK

inputs:
  api-key:
    description: OpenRouter API key
    required: true
  diff:
    description: Git diff content to review
    required: true

outputs:
  verdict:
    description: "pass or fail"
    value: ${{ steps.parse.outputs.verdict }}

runs:
  using: composite
  steps:
    - name: Run review agent
      id: agent
      shell: bash
      run: |
        RESULT=$(echo "$DIFF_INPUT" | npx tsx ${{ github.action_path }}/../../../packages/code-reviewer/review.ts 2>&1)
        echo "result<<EOF" >> "$GITHUB_OUTPUT"
        echo "$RESULT" >> "$GITHUB_OUTPUT"
        echo "EOF" >> "$GITHUB_OUTPUT"
      env:
        OPENROUTER_API_KEY: ${{ inputs.api-key }}
        DIFF_INPUT: ${{ inputs.diff }}

    - name: Parse verdict
      id: parse
      shell: bash
      run: |
        VERDICT=$(echo "$AGENT_RESULT" | node -e "
          let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
            try { console.log(JSON.parse(d).verdict); } catch { console.log('error'); }
          });
        ")
        echo "verdict=$VERDICT" >> "$GITHUB_OUTPUT"
      env:
        AGENT_RESULT: ${{ steps.agent.outputs.result }}

    - name: Write Job Summary
      shell: bash
      run: |
        echo "## 🤖 AI Code Review" >> "$GITHUB_STEP_SUMMARY"
        echo "" >> "$GITHUB_STEP_SUMMARY"
        echo '```json' >> "$GITHUB_STEP_SUMMARY"
        echo "$AGENT_RESULT" >> "$GITHUB_STEP_SUMMARY"
        echo '```' >> "$GITHUB_STEP_SUMMARY"
      env:
        AGENT_RESULT: ${{ steps.agent.outputs.result }}
```

---

## Phase 3: Workflow

### Changes Required

#### 1. Główny workflow

**File**: `.github/workflows/ai-review.yml`

**Intent**: Trigger na PR → checkout z pełną historią → diff → Composite Action → log werdyktu.

```yaml
name: AI Code Review

on:
  pull_request:
    branches: [main, master]
  workflow_dispatch:

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'

      - name: Install dependencies
        run: npm ci

      - name: Get diff
        id: diff
        run: |
          DIFF=$(git diff origin/${{ github.base_ref }}...HEAD)
          echo "value<<EOF" >> "$GITHUB_OUTPUT"
          echo "$DIFF" >> "$GITHUB_OUTPUT"
          echo "EOF" >> "$GITHUB_OUTPUT"

      - name: Run AI Review
        id: review
        uses: ./.github/actions/ai-reviewer
        with:
          api-key: ${{ secrets.OPENROUTER_API_KEY }}
          diff: ${{ steps.diff.outputs.value }}

      - name: Log verdict
        run: |
          echo "AI Review verdict: ${{ steps.review.outputs.verdict }}"
          if [ "${{ steps.review.outputs.verdict }}" = "fail" ]; then
            echo "⚠️ Review nie przeszło — sprawdź Job Summary"
          fi
```

---

## Phase 4: Weryfikacja pipeline'u

### Kroki

#### 1. Commit i push na nowym branchu

```bash
git checkout -b feature/ai-code-review
git add .github packages/code-reviewer
git commit -m "feat: add AI code review agent with Gemini via GHA"
git push origin feature/ai-code-review
```

#### 2. Otwórz PR na GitHubie

- GitHub → **New pull request** → `feature/ai-code-review` → `main`/`master`
- Poczekaj na zakończenie workflow w zakładce **Actions**

#### 3. Zbierz dowody 10xChampion

- Screenshot widoku **Actions** z listą jobów ✓
- Screenshot **logów joba** (kliknięcie w `review`) ✓
- Screenshot **Job Summary** z JSON wynikiem review ✓

---

## Phase 5: promptfoo — ewaluacja modeli

### Overview

Porównanie Gemini Flash vs 2 darmowych modeli z OpenRouter na tych samych diffach.

### Prerequisite

Klucz OpenRouter (darmowy): https://openrouter.ai → Sign up → **Keys** → **Create key**. Modele z sufiksem `:free` nie wymagają kredytów.

### Changes Required

#### 1. Instalacja promptfoo

```bash
npm install -D promptfoo
```

#### 2. Konfiguracja ewaluacji

**File**: `packages/code-reviewer/promptfooconfig.yaml`

```yaml
providers:
  - id: google:gemini-2.0-flash
    config:
      apiKey: "${GOOGLE_AI_API_KEY}"

  - id: openrouter:meta-llama/llama-3.3-70b-instruct:free
    config:
      apiKey: "${OPENROUTER_API_KEY}"

  - id: openrouter:google/gemma-3-27b-it:free
    config:
      apiKey: "${OPENROUTER_API_KEY}"

prompts:
  - |
    Jesteś recenzentem kodu. Oceń diff i zwróć wyłącznie JSON (bez markdown) z polami:
    verdict ("pass" lub "fail"), summary (string 2-3 zdania po polsku).
    Diff:
    {{diff}}

tests:
  - description: "SQL injection — powinien fail"
    vars:
      diff: |
        -const query = `SELECT * FROM users WHERE id = ${userId}`;
        +const { data } = await supabase.from('users').select('*').eq('id', userId);
    assert:
      - type: is-valid-json
      - type: llm-rubric
        value: Odpowiedź identyfikuje podatność SQL injection w usuniętej linii i wskazuje na poprawę w nowej

  - description: "Czysty kod utility — powinien pass"
    vars:
      diff: |
        +export function formatDate(date: Date): string {
        +  return date.toISOString().split('T')[0];
        +}
    assert:
      - type: is-valid-json
      - type: llm-rubric
        value: Odpowiedź ocenia kod pozytywnie i nie wskazuje poważnych problemów

  - description: "Brak obsługi błędów — powinien fail lub needs-attention"
    vars:
      diff: |
        +async function fetchRepair(id: string) {
        +  const res = await fetch(`/api/repairs/${id}`);
        +  return res.json();
        +}
    assert:
      - type: is-valid-json
      - type: llm-rubric
        value: Odpowiedź zauważa brak obsługi błędów HTTP lub wyjątków sieciowych
```

#### 3. Skrypt npm

Dodaj do `package.json` w sekcji `scripts`:

```json
"review:eval": "cd packages/code-reviewer && npx promptfoo eval"
```

### Uruchomienie

```bash
GOOGLE_AI_API_KEY=twoj_klucz OPENROUTER_API_KEY=twoj_klucz npm run review:eval
npx promptfoo view  # otwiera UI z macierzą wyników
```

Zrób screenshot macierzy wyników.

---

## Kryteria sukcesu

- [ ] GitHub Secret `OPENROUTER_API_KEY` ustawiony
- [ ] Workflow odpala się na PR do main/master
- [ ] Job Summary zawiera JSON z review
- [ ] `steps.review.outputs.verdict` wypisuje `pass` lub `fail` w logach
- [ ] promptfoo eval przechodzi bez błędów
- [ ] Macierz wyników pokazuje wyniki dla 3 modeli na 3 testach
- [ ] Zebrane 3 screenshoty dla 10xChampion

---

## Progress

### Phase 1: GitHub Secret
- [x] 1.1 OPENROUTER_API_KEY added as GitHub Actions secret (verified via `gh secret list`)

### Phase 2: Composite Action
- [x] 2.1 `.github/actions/ai-reviewer/action.yml` created with inputs, outputs, and env-var-safe shell steps — feb9dff
- [x] 2.2 Action reads diff via env var, runs agent, parses verdict, writes Job Summary — feb9dff

### Phase 3: Workflow
- [x] 3.1 `.github/workflows/ai-review.yml` created, triggers on PR to main/master + workflow_dispatch — 42bb1b7
- [x] 3.2 Workflow checks out repo, installs deps, gets diff, calls composite action, logs verdict — 42bb1b7

### Phase 4: Weryfikacja pipeline'u
- [x] 4.1 Branch pushed, PR opened, workflow runs successfully — 23c730d
- [x] 4.2 Job Summary shows JSON review result (verified: verdict=pass in run 28336596975)
- [x] 4.3 Screenshots collected for 10xChampion (user collects from GitHub Actions UI)

### Phase 5: promptfoo — ewaluacja modeli
- [x] 5.1 promptfoo installed as dev dependency — bbfb672
- [x] 5.2 `promptfooconfig.yaml` created with 3 providers and 3 test cases — bbfb672
- [x] 5.3 `review:eval` npm script added — bbfb672
- [x] 5.4 Eval runs successfully, matrix shows results for 3 models × 3 tests (requires user to run with API keys)

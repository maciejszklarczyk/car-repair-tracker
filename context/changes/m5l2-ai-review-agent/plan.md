# M5L2: AI Code Review Agent (lokalnie)

## Overview

Zbudowanie oskryptowanego agenta do code review działającego lokalnie, na podstawie Vercel AI SDK 6 z modelem Gemini 2.0 Flash (darmowy tier Google AI Studio). Agent dostaje diff z gita, zwraca ustrukturyzowaną ocenę JSON z pięcioma kryteriami i werdyktem pass/fail. Zaliczenie zadań praktycznych z lekcji M5L2 kursu 10xDevs.

## Current State Analysis

- Projekt używa `@google/genai` do klasyfikacji AI — znany pattern komunikacji z Gemini.
- Brak Vercel AI SDK, brak struktury dla agentów SDK-based.
- `packages/` nie istnieje — tworzymy jako miejsce na niezależne narzędzia.
- TypeScript + ESM (`"type": "module"` w package.json) — zgodne z przykładami z kursu.
- `tsx` nie jest zainstalowany — potrzebna instalacja.

## Desired End State

Komenda `git diff HEAD~1 | npx tsx packages/code-reviewer/review.ts` zwraca JSON z oceną diffa w 5 kryteriach + werdyktem pass/fail + podsumowaniem. Agent komunikuje się z Gemini przez klucz z `.env`.

## What We're NOT Doing

- GitHub Actions / CI/CD (to M5L3).
- Komentarze w PR.
- Narzędzia agenta (read, write) — na tym etapie sam scorer.
- Obsługa sesji / pamięci między przebiegami.

## Implementation Approach

Vercel AI SDK 6 z `ToolLoopAgent` i `Output.object`. Provider: `@ai-sdk/google` (Gemini). Schemat wyjścia przez Zod. Diff wczytywany ze stdin. Wynik na stdout jako JSON.

---

## Phase 1: Setup zależności i klucza API

### Overview

Pobranie klucza Google AI Studio i instalacja pakietów npm.

### Kroki

#### 1. Klucz Google AI Studio

Projekt używa już `GEMINI_API_KEY` do klasyfikacji AI (ten sam Google AI Studio). Agent code reviewera reużywa tego samego klucza — nie trzeba dodawać nowej zmiennej do `.env`.

Jeśli klucz nie jest jeszcze ustawiony:
- Wejdź na https://aistudio.google.com → **Get API key** → **Create API key**
- Dodaj do `.env`:

```
GEMINI_API_KEY=twoj_klucz_tutaj
```

#### 2. Instalacja pakietów

```bash
npm install ai @ai-sdk/google zod
npm install -D tsx
```

**Weryfikacja:**
```bash
npx tsx --version  # powinien wypisać wersję
```

---

## Phase 2: Implementacja agenta

### Overview

Stworzenie pakietu `packages/code-reviewer` z plikiem `review.ts` zawierającym pełną implementację agenta.

### Changes Required

#### 1. Folder pakietu

**File**: `packages/code-reviewer/` (nowy katalog)

#### 2. Schemat i prompt (współdzielony kontrakt)

**File**: `packages/code-reviewer/review.ts`

**Intent**: Kompletny agent scorer — stdin → ToolLoopAgent → JSON stdout.

**Contract**:

```typescript
// Schemat wyjścia — 5 kryteriów + werdykt + podsumowanie
const REVIEW_SCHEMA = z.object({
  implementationCorrectness: z.number().describe("Poprawność implementacji (1-10). 1: logika błędna lub psuje istniejące zachowania. 10: poprawna na ścieżce głównej, w edge casach i obsłudze błędów."),
  idiomaticity: z.number().describe("Idiomatyczność: zgodność z konwencjami języka i projektu (1-10)."),
  complexity: z.number().describe("Złożoność: prostota rozwiązania względem problemu (1-10). 1: nadmiernie skomplikowane. 10: minimalne i czytelne."),
  testCoverage: z.number().describe("Pokrycie testami proporcjonalne do ryzyka (1-10). 1: brak testów dla ryzykownych zmian. 10: pełne pokrycie edge casów."),
  security: z.number().describe("Bezpieczeństwo: brak podatności i wycieków sekretów (1-10)."),
  verdict: z.enum(["pass", "fail"]).describe("Wiążący werdykt dla całej zmiany"),
  summary: z.string().describe("Podsumowanie w 2-3 zdaniach po polsku, gotowe jako komentarz do PR"),
});
```

**Pełna implementacja**:

```typescript
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { z } from "zod";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const SYSTEM_PROMPT = `Jesteś precyzyjnym, konstruktywnym recenzentem kodu oceniającym pull request.
Oceń podany diff w pięciu kryteriach w skali 1-10 (1 = poważne braki, 10 = wzorowo):
poprawność implementacji, idiomatyczność, złożoność, pokrycie testami względem ryzyka, bezpieczeństwo.
Następnie wydaj wiążący werdykt (pass/fail) dla całej zmiany i dołącz krótkie podsumowanie (2-3 zdania)
po polsku, na podstawie którego autor PR-a będzie mógł działać.`;

const REVIEW_SCHEMA = z.object({
  implementationCorrectness: z.number().describe(
    "Poprawność implementacji (1-10). 1: logika błędna. 10: poprawna na ścieżce głównej i edge casach."
  ),
  idiomaticity: z.number().describe("Idiomatyczność: zgodność z konwencjami języka i projektu (1-10)."),
  complexity: z.number().describe("Złożoność: prostota względem problemu (1-10). 1: nadmiernie skomplikowane. 10: minimalne."),
  testCoverage: z.number().describe("Pokrycie testami proporcjonalne do ryzyka (1-10)."),
  security: z.number().describe("Bezpieczeństwo: brak podatności i wycieków sekretów (1-10)."),
  verdict: z.enum(["pass", "fail"]).describe("Wiążący werdykt dla całej zmiany"),
  summary: z.string().describe("Podsumowanie 2-3 zdania po polsku jako komentarz do PR"),
});

async function readDiff(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function review(diff: string) {
  const reviewer = new ToolLoopAgent({
    model: google("gemini-2.0-flash"),
    instructions: SYSTEM_PROMPT,
    tools: {},
    output: Output.object({ schema: REVIEW_SCHEMA }),
    stopWhen: stepCountIs(2),
  });

  const { output } = await reviewer.generate({
    prompt: `Zrecenzuj ten diff:\n\n${diff}`,
  });
  return output;
}

const diff = await readDiff();
if (!diff.trim()) {
  console.error("Brak diffa na stdin. Użyj: git diff | npx tsx review.ts");
  process.exit(1);
}

const result = await review(diff);
console.log(JSON.stringify(result, null, 2));
```

---

## Phase 3: Weryfikacja

### Kroki

#### 1. Test z realnym diffem

```bash
git diff HEAD~1 | npx tsx packages/code-reviewer/review.ts
```

#### 2. Oczekiwany wynik

```json
{
  "implementationCorrectness": 9,
  "idiomaticity": 8,
  "complexity": 10,
  "testCoverage": 7,
  "security": 10,
  "verdict": "pass",
  "summary": "Zmiana jest trywialna — dodanie komentarza. Brak wpływu na logikę ani bezpieczeństwo. Można mergować."
}
```

---

## Progress

### Phase 1: Setup zależności i klucza API
- [x] 1.1 Klucz `GEMINI_API_KEY` w `.env` (reużyty z istniejącej konfiguracji) — f9c4140
- [x] 1.2 `npm install` przechodzi bez błędów — f9c4140
- [x] 1.3 `npx tsx --version` wypisuje wersję — f9c4140

### Phase 2: Implementacja agenta
- [x] 2.1 `packages/code-reviewer/review.ts` istnieje — 4309750

### Phase 3: Weryfikacja
- [x] 3.1 `git diff HEAD~1 | npx tsx packages/code-reviewer/review.ts` zwraca poprawny JSON
- [x] 3.2 JSON zawiera wszystkie 7 pól zgodnych ze schematem
- [x] 3.3 `verdict` jest `"pass"` lub `"fail"`

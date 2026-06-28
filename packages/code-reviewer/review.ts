import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { z } from "zod";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in .env");
  process.exit(1);
}

const google = createGoogleGenerativeAI({ apiKey });

const SYSTEM_PROMPT = `Jesteś precyzyjnym, konstruktywnym recenzentem kodu oceniającym pull request.
Oceń podany diff w pięciu kryteriach w skali 1-10 (1 = poważne braki, 10 = wzorowo):
poprawność implementacji, idiomatyczność, złożoność, pokrycie testami względem ryzyka, bezpieczeństwo.
Następnie wydaj wiążący werdykt (pass/fail) dla całej zmiany i dołącz krótkie podsumowanie (2-3 zdania)
po polsku, na podstawie którego autor PR-a będzie mógł działać.`;

const REVIEW_SCHEMA = z.object({
  implementationCorrectness: z
    .number()
    .describe("Poprawność implementacji (1-10). 1: logika błędna. 10: poprawna na ścieżce głównej i edge casach."),
  idiomaticity: z.number().describe("Idiomatyczność: zgodność z konwencjami języka i projektu (1-10)."),
  complexity: z
    .number()
    .describe("Złożoność: prostota względem problemu (1-10). 1: nadmiernie skomplikowane. 10: minimalne."),
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

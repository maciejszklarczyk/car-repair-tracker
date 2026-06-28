import "dotenv/config";
import { createOpenAI } from "@ai-sdk/openai";
import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { z } from "zod";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY is not set in .env");
  process.exit(1);
}

// use .chat() to force /chat/completions — OpenRouter doesn't support /responses
const openrouter = createOpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

// Override via OPENROUTER_MODEL env var — see https://openrouter.ai/models?q=free
// openrouter/free auto-routes to a free model supporting the needed features (structured outputs etc.)
const MODEL = process.env.OPENROUTER_MODEL ?? "openrouter/free";

const SYSTEM_PROMPT = `You are a precise, constructive code reviewer assessing a pull request.
Score the provided diff on five criteria from 1-10 (1 = serious issues, 10 = exemplary):
implementation correctness, idiomaticity, complexity, test coverage relative to risk, security.
Then issue a binding verdict (pass/fail) for the entire change and include a short summary (2-3 sentences)
in English that the PR author can act on.`;

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
  summary: z.string().describe("2-3 sentence summary in English suitable as a PR comment"),
});

async function readDiff(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function review(diff: string) {
  const reviewer = new ToolLoopAgent({
    model: openrouter.chat(MODEL, { structuredOutputs: false }),
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
  console.error("Brak diffa na stdin. Użyj: git diff HEAD~1 | npx tsx packages/code-reviewer/review.ts");
  process.exit(1);
}

const result = await review(diff);
console.log(JSON.stringify(result, null, 2));

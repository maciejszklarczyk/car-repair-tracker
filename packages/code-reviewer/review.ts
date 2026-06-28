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
const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemma-4-26b-a4b-it:free";

const SYSTEM_PROMPT = `You are a precise, constructive code reviewer assessing a pull request.
Score the provided diff on five criteria from 1-10 (1 = serious issues, 10 = exemplary):
implementation correctness, idiomaticity, complexity, test coverage relative to risk, security.
Then issue a binding verdict (pass/fail) for the entire change and include a short summary (2-3 sentences)
in English that the PR author can act on.`;

const REVIEW_SCHEMA = z.object({
  implementationCorrectness: z
    .number()
    .describe("Implementation correctness (1-10). 1: broken logic. 10: correct on happy path and edge cases."),
  idiomaticity: z.number().describe("Idiomaticity: adherence to language and project conventions (1-10)."),
  complexity: z
    .number()
    .describe("Complexity: simplicity relative to the problem (1-10). 1: over-engineered. 10: minimal."),
  testCoverage: z.number().describe("Test coverage proportional to risk (1-10)."),
  security: z.number().describe("Security: no vulnerabilities or leaked secrets (1-10)."),
  verdict: z.enum(["pass", "fail"]).describe("Binding verdict for the entire change"),
  summary: z.string().describe("2-3 sentence summary in English suitable as a PR comment"),
});

const MAX_DIFF_BYTES = 1024 * 1024; // 1 MB

async function readDiff(): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of process.stdin) {
    totalBytes += (chunk as Buffer).length;
    if (totalBytes > MAX_DIFF_BYTES) {
      console.error(`Diff exceeds ${MAX_DIFF_BYTES / 1024 / 1024} MB limit. Pass a narrower diff.`);
      process.exit(1);
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function review(diff: string) {
  const reviewer = new ToolLoopAgent({
    model: openrouter.chat(MODEL),
    instructions: SYSTEM_PROMPT,
    tools: {},
    output: Output.object({ schema: REVIEW_SCHEMA }),
    stopWhen: stepCountIs(2),
  });

  const { output } = await reviewer.generate({
    prompt: `Review this diff:\n\n${diff}`,
  });
  return output;
}

const diff = await readDiff();
if (!diff.trim()) {
  console.error("No diff on stdin. Usage: git diff HEAD~1 | npx tsx packages/code-reviewer/review.ts");
  process.exit(1);
}

try {
  const result = await review(diff);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Review failed (model: ${MODEL}): ${message}`);
  process.exit(1);
}

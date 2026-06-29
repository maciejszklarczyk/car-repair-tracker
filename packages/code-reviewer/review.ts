import "dotenv/config";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
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
in English that the PR author can act on.

You MUST respond with ONLY a valid JSON object (no markdown, no code fences) matching this exact schema:
{
  "implementationCorrectness": <number 1-10>,
  "idiomaticity": <number 1-10>,
  "complexity": <number 1-10>,
  "testCoverage": <number 1-10>,
  "security": <number 1-10>,
  "verdict": "pass" | "fail",
  "summary": "<string>"
}`;

const REVIEW_SCHEMA = z.object({
  implementationCorrectness: z.number(),
  idiomaticity: z.number(),
  complexity: z.number(),
  testCoverage: z.number(),
  security: z.number(),
  verdict: z.enum(["pass", "fail"]),
  summary: z.string(),
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

function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fenced) return fenced[1].trim();
  const braced = /\{[\s\S]*\}/.exec(text);
  if (braced) return braced[0];
  return text.trim();
}

async function review(diff: string) {
  const { text } = await generateText({
    model: openrouter.chat(MODEL),
    system: SYSTEM_PROMPT,
    prompt: `Review this diff:\n\n${diff}`,
    maxOutputTokens: 1024,
  });

  const parsed: unknown = JSON.parse(extractJson(text));
  return REVIEW_SCHEMA.parse(parsed);
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

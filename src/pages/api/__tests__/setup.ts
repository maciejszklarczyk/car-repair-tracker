import { vi } from "vitest";
import { createMockSupabase } from "@/test/helpers";

// ---------------------------------------------------------------------------
// Module mocks — imported by test files via `import "./setup"`
// ---------------------------------------------------------------------------

const { client, from, mockResult, mockResults } = createMockSupabase();

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => client),
}));

vi.mock("@/lib/classifyRepair", () => ({
  classifyRepair: vi.fn(() => Promise.resolve("inne")),
  REPAIR_CATEGORIES: ["silnik", "hamulce", "elektryka", "ogumienie", "przegląd", "inne"] as const,
}));

vi.mock("astro:env/server", () => ({
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_KEY: "test-key",
  GEMINI_API_KEY: undefined,
}));

const insert = (client as unknown as Record<string, unknown>).insert as ReturnType<typeof vi.fn>;
const update = (client as unknown as Record<string, unknown>).update as ReturnType<typeof vi.fn>;

export { client, from, insert, update, mockResult, mockResults };

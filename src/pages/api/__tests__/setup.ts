import { vi } from "vitest";
import { createMockSupabase } from "@/test/helpers";

// ---------------------------------------------------------------------------
// Module mocks — imported by test files via `import "./setup"`
// ---------------------------------------------------------------------------

const { client, from, mockResult } = createMockSupabase();

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

export { client, from, mockResult };

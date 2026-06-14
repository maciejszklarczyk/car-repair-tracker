import { vi } from "vitest";
import type { Vehicle, Repair, ServiceThreshold } from "@/types";

// ---------------------------------------------------------------------------
// Chainable Supabase mock
// ---------------------------------------------------------------------------

interface SupabaseResult {
  data: unknown;
  error: unknown;
}

function createChain(defaultResult: SupabaseResult = { data: null, error: null }) {
  let result = defaultResult;

  const chain: Record<string, unknown> = {};

  const self = (..._args: unknown[]) => chain;

  const terminalMethods = ["single", "maybeSingle"] as const;
  const chainMethods = [
    "from",
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "in",
    "is",
    "order",
    "limit",
  ] as const;

  for (const m of chainMethods) {
    chain[m] = vi.fn(self);
  }

  for (const m of terminalMethods) {
    chain[m] = vi.fn(() => Promise.resolve(result));
  }

  chain.then = (resolve: (v: SupabaseResult) => void) => Promise.resolve(result).then(resolve);

  const mockResult = (r: SupabaseResult) => {
    result = r;
  };

  return { chain, mockResult };
}

export function createMockSupabase() {
  const { chain, mockResult } = createChain();

  return {
    client: chain as unknown as ReturnType<typeof import("@/lib/supabase").createClient>,
    from: chain.from as ReturnType<typeof vi.fn>,
    mockResult,
  };
}

// ---------------------------------------------------------------------------
// APIContext factory
// ---------------------------------------------------------------------------

interface MockContextOptions {
  user?: { id: string; [key: string]: unknown } | null;
  request?: Request;
  params?: Record<string, string>;
  url?: URL;
}

export function createMockContext(options: MockContextOptions = {}) {
  const { user = { id: "user-1" }, params = {}, url = new URL("http://test") } = options;

  const redirectFn = vi.fn((target: string) => {
    return new Response(null, {
      status: 302,
      headers: { Location: target },
    });
  });

  return {
    locals: { user },
    request: options.request ?? new Request(url),
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      getAll: vi.fn(() => []),
    },
    params,
    redirect: redirectFn,
    url,
  } as unknown as import("astro").APIContext;
}

// ---------------------------------------------------------------------------
// Entity factories
// ---------------------------------------------------------------------------

export function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "v1",
    user_id: "user-1",
    make: "Toyota",
    model: "Corolla",
    year: 2020,
    baseline_mileage: 10000,
    archived_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function makeRepair(overrides: Partial<Repair> = {}): Repair {
  return {
    id: "r1",
    car_id: "v1",
    user_id: "user-1",
    repair_date: "2024-06-01",
    description: "Oil change",
    cost: 500,
    mileage: 10500,
    category: null,
    category_source: null,
    original_category: null,
    created_at: "2024-06-01T00:00:00Z",
    updated_at: "2024-06-01T00:00:00Z",
    ...overrides,
  };
}

export function makeServiceThreshold(overrides: Partial<ServiceThreshold> = {}): ServiceThreshold {
  return {
    id: "st1",
    car_id: "v1",
    user_id: "user-1",
    name: "Oil change",
    km_interval: 10000,
    days_interval: null,
    last_performed_date: null,
    last_performed_mileage: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

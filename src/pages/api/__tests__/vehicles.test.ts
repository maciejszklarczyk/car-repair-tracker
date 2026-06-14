import { describe, it, expect, beforeEach, vi } from "vitest";
import "./setup";
import { mockResult } from "./setup";
import { createMockContext, formRequest } from "@/test/helpers";
import { POST } from "@/pages/api/vehicles";

const VALID_FIELDS = {
  make: "Toyota",
  model: "Corolla",
  year: "2020",
  baseline_mileage: "10000",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResult({ data: null, error: null });
});

describe("POST /api/vehicles", () => {
  it("redirects to signin when unauthenticated", async () => {
    const ctx = createMockContext({ user: null, request: formRequest("http://test/api/vehicles", VALID_FIELDS) });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/auth/signin");
  });

  it("redirects with error for missing make", async () => {
    const ctx = createMockContext({
      request: formRequest("http://test/api/vehicles", { ...VALID_FIELDS, make: "" }),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("error=");
  });

  it("redirects with error for year in future", async () => {
    const ctx = createMockContext({
      request: formRequest("http://test/api/vehicles", { ...VALID_FIELDS, year: "2099" }),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("error=");
  });

  it("redirects with error for negative baseline mileage", async () => {
    const ctx = createMockContext({
      request: formRequest("http://test/api/vehicles", { ...VALID_FIELDS, baseline_mileage: "-1" }),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("error=");
  });

  it("redirects with error when insert fails", async () => {
    mockResult({ data: null, error: { message: "DB error" } });

    const ctx = createMockContext({ request: formRequest("http://test/api/vehicles", VALID_FIELDS) });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("DB%20error");
  });

  it("redirects to vehicles list on valid creation", async () => {
    mockResult({ data: null, error: null });

    const ctx = createMockContext({ request: formRequest("http://test/api/vehicles", VALID_FIELDS) });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard/vehicles");
  });
});

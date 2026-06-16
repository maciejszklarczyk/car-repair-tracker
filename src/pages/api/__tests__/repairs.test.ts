import { describe, it, expect, beforeEach, vi } from "vitest";
import "./setup";
import { mockResult, mockResults, insert } from "./setup";
import { createMockContext, makeVehicle, formRequest } from "@/test/helpers";
import { POST } from "@/pages/api/repairs";
import { createClient } from "@/lib/supabase";
import { classifyRepair } from "@/lib/classifyRepair";

const mockedClassify = vi.mocked(classifyRepair);

const VALID_FIELDS = {
  car_id: "v1",
  repair_date: "2024-06-01",
  description: "Oil change",
  cost: "500",
  mileage: "11000",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResult({ data: null, error: null });
});

describe("POST /api/repairs", () => {
  it("redirects with error when createClient returns null", async () => {
    vi.mocked(createClient).mockReturnValueOnce(null);
    const ctx = createMockContext({ request: formRequest("http://test/api/repairs", VALID_FIELDS) });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("Supabase");
  });

  it("redirects to signin when unauthenticated", async () => {
    const ctx = createMockContext({ user: null, request: formRequest("http://test/api/repairs", VALID_FIELDS) });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/auth/signin");
  });

  it("redirects with error when car owned by different user", async () => {
    mockResult({ data: makeVehicle({ user_id: "user-2" }), error: null });

    const ctx = createMockContext({ request: formRequest("http://test/api/repairs", VALID_FIELDS) });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("Vehicle%20not%20found");
  });

  it("redirects with error for missing description", async () => {
    const ctx = createMockContext({
      request: formRequest("http://test/api/repairs", { ...VALID_FIELDS, description: "" }),
    });

    mockResult({ data: makeVehicle({ user_id: "user-1" }), error: null });

    const res = await POST(ctx);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("error=");
  });

  it("redirects with error for negative cost", async () => {
    mockResult({ data: makeVehicle({ user_id: "user-1" }), error: null });

    const ctx = createMockContext({
      request: formRequest("http://test/api/repairs", { ...VALID_FIELDS, cost: "-100" }),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("Cost%20must%20be%20positive");
  });

  it("redirects with error when mileage below baseline", async () => {
    mockResult({ data: makeVehicle({ user_id: "user-1", baseline_mileage: 20000 }), error: null });

    const ctx = createMockContext({
      request: formRequest("http://test/api/repairs", { ...VALID_FIELDS, mileage: "11000" }),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("baseline");
  });

  it("redirects to vehicle page on valid creation", async () => {
    mockResults([
      { data: makeVehicle({ user_id: "user-1" }), error: null },
      { data: null, error: null },
    ]);

    const ctx = createMockContext({ request: formRequest("http://test/api/repairs", VALID_FIELDS) });
    const res = await POST(ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/dashboard/vehicles/v1?success=1");
  });

  it("sets category to 'pending' when classifyRepair returns null", async () => {
    mockResults([
      { data: makeVehicle({ user_id: "user-1" }), error: null },
      { data: null, error: null },
    ]);
    mockedClassify.mockResolvedValueOnce(null);

    const ctx = createMockContext({ request: formRequest("http://test/api/repairs", VALID_FIELDS) });
    await POST(ctx);
    expect(mockedClassify).toHaveBeenCalledWith("Oil change");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ category: "pending", category_source: "pending", original_category: "pending" }),
    );
  });

  it("throws when insert fails", async () => {
    mockResults([
      { data: makeVehicle({ user_id: "user-1" }), error: null },
      { data: null, error: { message: "constraint violation" } },
    ]);

    const ctx = createMockContext({ request: formRequest("http://test/api/repairs", VALID_FIELDS) });
    await expect(POST(ctx)).rejects.toThrow("constraint violation");
  });

  it("sets category from classifyRepair when it returns a value", async () => {
    mockResults([
      { data: makeVehicle({ user_id: "user-1" }), error: null },
      { data: null, error: null },
    ]);
    mockedClassify.mockResolvedValueOnce("hamulce");

    const ctx = createMockContext({ request: formRequest("http://test/api/repairs", VALID_FIELDS) });
    await POST(ctx);
    expect(mockedClassify).toHaveBeenCalledWith("Oil change");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ category: "hamulce", category_source: "ai", original_category: "hamulce" }),
    );
  });
});

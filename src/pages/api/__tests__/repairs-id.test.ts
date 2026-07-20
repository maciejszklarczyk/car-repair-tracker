import { describe, it, expect, beforeEach, vi } from "vitest";
import "./setup";
import { mockResult, mockResults, update } from "./setup";
import { createMockContext, makeRepair, jsonRequest } from "@/test/helpers";
import { PUT, DELETE, PATCH } from "@/pages/api/repairs/[id]";
import { createClient } from "@/lib/supabase";
import { classifyRepair } from "@/lib/classifyRepair";

const mockedClassify = vi.mocked(classifyRepair);

const VALID_UPDATE = {
  repair_date: "2024-06-01",
  description: "Brake pad replacement",
  cost: 300,
  mileage: 11000,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResult({ data: null, error: null });
});

// ---------------------------------------------------------------------------
// PUT (edit repair)
// ---------------------------------------------------------------------------
describe("PUT /api/repairs/[id]", () => {
  it("returns 500 when createClient returns null", async () => {
    vi.mocked(createClient).mockReturnValueOnce(null);
    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", VALID_UPDATE),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(500);
  });

  it("returns 401 when unauthenticated", async () => {
    const ctx = createMockContext({
      user: null,
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", VALID_UPDATE),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 403 when repair owned by different user", async () => {
    mockResult({ data: makeRepair({ user_id: "user-2" }), error: null });

    const ctx = createMockContext({
      user: { id: "user-1" },
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", VALID_UPDATE),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockResults([
      { data: makeRepair({ user_id: "user-1" }), error: null },
      { data: { baseline_mileage: 10000 }, error: null },
      { data: [], error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: new Request("http://test/api/repairs/r1", {
        method: "PUT",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      }),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Invalid JSON");
  });

  it("returns 400 for empty description", async () => {
    mockResults([
      { data: makeRepair({ user_id: "user-1" }), error: null },
      { data: { baseline_mileage: 10000 }, error: null },
      { data: [], error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", {
        ...VALID_UPDATE,
        description: "",
      }),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative cost", async () => {
    mockResults([
      { data: makeRepair({ user_id: "user-1" }), error: null },
      { data: { baseline_mileage: 10000 }, error: null },
      { data: [], error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", {
        ...VALID_UPDATE,
        cost: -100,
      }),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when mileage below baseline", async () => {
    mockResults([
      { data: makeRepair({ user_id: "user-1" }), error: null },
      { data: { baseline_mileage: 10000 }, error: null },
      { data: [], error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", {
        ...VALID_UPDATE,
        mileage: 5000,
      }),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("baseline");
  });

  it("returns 400 when mileage above a later-dated sibling repair", async () => {
    mockResults([
      { data: makeRepair({ id: "r1", user_id: "user-1" }), error: null },
      { data: { baseline_mileage: 5000 }, error: null },
      { data: [makeRepair({ id: "r2", repair_date: "2024-12-01", mileage: 9000 })], error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", {
        ...VALID_UPDATE,
        repair_date: "2024-06-01",
        mileage: 9500,
      }),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("at most");
  });

  it("excludes itself from the sibling set so lowering its own mileage succeeds", async () => {
    mockResults([
      { data: makeRepair({ id: "r1", user_id: "user-1" }), error: null },
      { data: { baseline_mileage: 5000 }, error: null },
      {
        data: [
          makeRepair({ id: "r1", repair_date: "2024-06-01", mileage: 20000 }),
          makeRepair({ id: "r2", repair_date: "2024-01-01", mileage: 6000 }),
        ],
        error: null,
      },
      { data: null, error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", {
        ...VALID_UPDATE,
        repair_date: "2024-06-01",
        mileage: 6500,
      }),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(200);
  });

  it("re-validates against neighbors of the newly submitted repair_date", async () => {
    mockResults([
      { data: makeRepair({ id: "r1", user_id: "user-1" }), error: null },
      { data: { baseline_mileage: 5000 }, error: null },
      {
        data: [
          makeRepair({ id: "r1", repair_date: "2024-06-01", mileage: 8000 }),
          makeRepair({ id: "r2", repair_date: "2024-03-01", mileage: 7000 }),
        ],
        error: null,
      },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", {
        ...VALID_UPDATE,
        repair_date: "2024-01-01",
        mileage: 7500,
      }),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("at most");
  });

  it("returns success on valid update", async () => {
    mockResults([
      {
        data: makeRepair({ user_id: "user-1", description: "Oil change", category: "inne", category_source: "ai" }),
        error: null,
      },
      { data: { baseline_mileage: 10000 }, error: null },
      { data: [], error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", VALID_UPDATE),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("returns 500 when update fails", async () => {
    mockResults([
      {
        data: makeRepair({ user_id: "user-1", description: "Oil change", category: "inne", category_source: "ai" }),
        error: null,
      },
      { data: { baseline_mileage: 10000 }, error: null },
      { data: [], error: null },
      { data: null, error: { message: "constraint violation" } },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", VALID_UPDATE),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(500);
  });

  it("calls classifyRepair when description changed and category_source is not manual", async () => {
    mockResults([
      {
        data: makeRepair({
          user_id: "user-1",
          description: "Old description",
          category: "inne",
          category_source: "ai",
        }),
        error: null,
      },
      { data: { baseline_mileage: 10000 }, error: null },
      { data: [], error: null },
    ]);
    mockedClassify.mockResolvedValueOnce("hamulce");

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", VALID_UPDATE),
    });
    await PUT(ctx);
    expect(mockedClassify).toHaveBeenCalledWith(VALID_UPDATE.description);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ category: "hamulce", category_source: "ai", original_category: "hamulce" }),
    );
  });

  it("calls classifyRepair when existing category is null", async () => {
    mockResults([
      { data: makeRepair({ user_id: "user-1", category: null, category_source: null }), error: null },
      { data: { baseline_mileage: 10000 }, error: null },
      { data: [], error: null },
    ]);
    mockedClassify.mockResolvedValueOnce("silnik");

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", {
        ...VALID_UPDATE,
        description: "Oil change",
      }),
    });
    await PUT(ctx);
    expect(mockedClassify).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ category: "silnik", category_source: "ai", original_category: "silnik" }),
    );
  });

  it("does not call classifyRepair when description unchanged and category exists", async () => {
    mockResults([
      {
        data: makeRepair({
          user_id: "user-1",
          description: "Brake pad replacement",
          category: "hamulce",
          category_source: "ai",
        }),
        error: null,
      },
      { data: { baseline_mileage: 10000 }, error: null },
      { data: [], error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PUT", VALID_UPDATE),
    });
    await PUT(ctx);
    expect(mockedClassify).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe("DELETE /api/repairs/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    const ctx = createMockContext({
      user: null,
      params: { id: "r1" },
      request: new Request("http://test/api/repairs/r1", { method: "DELETE" }),
    });
    const res = await DELETE(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 403 when repair owned by different user", async () => {
    mockResult({ data: makeRepair({ user_id: "user-2" }), error: null });

    const ctx = createMockContext({
      user: { id: "user-1" },
      params: { id: "r1" },
      request: new Request("http://test/api/repairs/r1", { method: "DELETE" }),
    });
    const res = await DELETE(ctx);
    expect(res.status).toBe(403);
  });

  it("returns success for owned repair", async () => {
    mockResults([
      { data: makeRepair({ user_id: "user-1" }), error: null },
      { data: null, error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: new Request("http://test/api/repairs/r1", { method: "DELETE" }),
    });
    const res = await DELETE(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PATCH (category override)
// ---------------------------------------------------------------------------
describe("PATCH /api/repairs/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    const ctx = createMockContext({
      user: null,
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PATCH", { category: "silnik" }),
    });
    const res = await PATCH(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 403 when repair owned by different user", async () => {
    mockResult({ data: makeRepair({ user_id: "user-2" }), error: null });

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PATCH", { category: "silnik" }),
    });
    const res = await PATCH(ctx);
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid category", async () => {
    mockResults([
      { data: makeRepair({ user_id: "user-1" }), error: null },
      { data: null, error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PATCH", { category: "invalid" }),
    });
    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
  });

  it("returns success for valid category override", async () => {
    mockResults([
      { data: makeRepair({ user_id: "user-1" }), error: null },
      { data: null, error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "r1" },
      request: jsonRequest("http://test/api/repairs/r1", "PATCH", { category: "silnik" }),
    });
    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});

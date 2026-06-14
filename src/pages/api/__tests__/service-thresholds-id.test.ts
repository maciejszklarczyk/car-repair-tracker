import { describe, it, expect, beforeEach, vi } from "vitest";
import "./setup";
import { mockResult, mockResults } from "./setup";
import { createMockContext, makeServiceThreshold, jsonRequest } from "@/test/helpers";
import { PUT, DELETE } from "@/pages/api/service-thresholds/[id]";

beforeEach(() => {
  vi.clearAllMocks();
  mockResult({ data: null, error: null });
});

// ---------------------------------------------------------------------------
// PUT (update threshold)
// ---------------------------------------------------------------------------
describe("PUT /api/service-thresholds/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    const ctx = createMockContext({
      user: null,
      params: { id: "st1" },
      request: jsonRequest("http://test/api/service-thresholds/st1", "PUT", { name: "New name" }),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 403 when threshold owned by different user", async () => {
    mockResult({ data: makeServiceThreshold({ user_id: "user-2" }), error: null });

    const ctx = createMockContext({
      params: { id: "st1" },
      request: jsonRequest("http://test/api/service-thresholds/st1", "PUT", { name: "New name" }),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(403);
  });

  it("returns 400 for empty body (no fields)", async () => {
    mockResult({ data: makeServiceThreshold({ user_id: "user-1" }), error: null });

    const ctx = createMockContext({
      params: { id: "st1" },
      request: jsonRequest("http://test/api/service-thresholds/st1", "PUT", {}),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("At least one field");
  });

  it("returns 400 for invalid JSON", async () => {
    const ctx = createMockContext({
      params: { id: "st1" },
      request: new Request("http://test/api/service-thresholds/st1", {
        method: "PUT",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      }),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when update fails", async () => {
    mockResults([
      { data: makeServiceThreshold({ user_id: "user-1" }), error: null },
      { data: null, error: { message: "not found" } },
    ]);

    const ctx = createMockContext({
      params: { id: "st1" },
      request: jsonRequest("http://test/api/service-thresholds/st1", "PUT", { name: "New name" }),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(404);
  });

  it("returns updated threshold on valid partial update", async () => {
    mockResults([
      { data: makeServiceThreshold({ user_id: "user-1" }), error: null },
      { data: makeServiceThreshold({ user_id: "user-1", name: "New name" }), error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "st1" },
      request: jsonRequest("http://test/api/service-thresholds/st1", "PUT", { name: "New name" }),
    });
    const res = await PUT(ctx);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe("DELETE /api/service-thresholds/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    const ctx = createMockContext({
      user: null,
      params: { id: "st1" },
      request: new Request("http://test/api/service-thresholds/st1", { method: "DELETE" }),
    });
    const res = await DELETE(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 403 when threshold owned by different user", async () => {
    mockResult({ data: makeServiceThreshold({ user_id: "user-2" }), error: null });

    const ctx = createMockContext({
      params: { id: "st1" },
      request: new Request("http://test/api/service-thresholds/st1", { method: "DELETE" }),
    });
    const res = await DELETE(ctx);
    expect(res.status).toBe(403);
  });

  it("returns 204 for owned threshold", async () => {
    mockResults([
      { data: makeServiceThreshold({ user_id: "user-1" }), error: null },
      { data: null, error: null },
    ]);

    const ctx = createMockContext({
      params: { id: "st1" },
      request: new Request("http://test/api/service-thresholds/st1", { method: "DELETE" }),
    });
    const res = await DELETE(ctx);
    expect(res.status).toBe(204);
  });
});

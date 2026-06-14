import { describe, it, expect, beforeEach, vi } from "vitest";
import "./setup";
import { mockResult, mockResults } from "./setup";
import { createMockContext, makeServiceThreshold } from "@/test/helpers";
import { POST } from "@/pages/api/service-thresholds";

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_THRESHOLD = {
  car_id: "v1",
  name: "Oil change",
  km_interval: 10000,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResult({ data: null, error: null });
});

describe("POST /api/service-thresholds", () => {
  it("returns 401 when unauthenticated", async () => {
    const ctx = createMockContext({
      user: null,
      request: jsonRequest("http://test/api/service-thresholds", VALID_THRESHOLD),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when car owned by different user", async () => {
    mockResult({ data: null, error: { message: "not found" } });

    const ctx = createMockContext({
      request: jsonRequest("http://test/api/service-thresholds", VALID_THRESHOLD),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid JSON", async () => {
    const ctx = createMockContext({
      request: new Request("http://test/api/service-thresholds", {
        method: "POST",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      }),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when missing both km_interval and days_interval", async () => {
    const ctx = createMockContext({
      request: jsonRequest("http://test/api/service-thresholds", {
        car_id: "v1",
        name: "Oil change",
      }),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("At least one");
  });

  it("returns 400 for negative km_interval", async () => {
    const ctx = createMockContext({
      request: jsonRequest("http://test/api/service-thresholds", {
        ...VALID_THRESHOLD,
        km_interval: -100,
      }),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  it("returns 201 on valid creation", async () => {
    mockResults([
      { data: { id: "v1" }, error: null },
      { data: makeServiceThreshold(), error: null },
    ]);

    const ctx = createMockContext({
      request: jsonRequest("http://test/api/service-thresholds", VALID_THRESHOLD),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(201);
  });
});

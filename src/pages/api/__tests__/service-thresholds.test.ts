import { describe, it, expect, beforeEach, vi } from "vitest";
import "./setup";
import { mockResult, mockResults } from "./setup";
import { createMockContext, makeServiceThreshold, makeRepair, jsonRequest } from "@/test/helpers";
import { POST } from "@/pages/api/service-thresholds";

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
      request: jsonRequest("http://test/api/service-thresholds", "POST", VALID_THRESHOLD),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when car owned by different user", async () => {
    mockResult({ data: null, error: { message: "not found" } });

    const ctx = createMockContext({
      request: jsonRequest("http://test/api/service-thresholds", "POST", VALID_THRESHOLD),
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
      request: jsonRequest("http://test/api/service-thresholds", "POST", {
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
      request: jsonRequest("http://test/api/service-thresholds", "POST", {
        ...VALID_THRESHOLD,
        km_interval: -100,
      }),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  it("returns 500 when insert fails", async () => {
    mockResults([
      { data: { id: "v1", baseline_mileage: 10000 }, error: null },
      { data: null, error: { message: "constraint violation" } },
    ]);

    const ctx = createMockContext({
      request: jsonRequest("http://test/api/service-thresholds", "POST", VALID_THRESHOLD),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(500);
  });

  it("returns 201 on valid creation", async () => {
    mockResults([
      { data: { id: "v1", baseline_mileage: 10000 }, error: null },
      { data: makeServiceThreshold(), error: null },
    ]);

    const ctx = createMockContext({
      request: jsonRequest("http://test/api/service-thresholds", "POST", VALID_THRESHOLD),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(201);
  });

  it("returns 400 when last_performed_mileage is below baseline (no date)", async () => {
    mockResults([{ data: { id: "v1", baseline_mileage: 10000 }, error: null }]);

    const ctx = createMockContext({
      request: jsonRequest("http://test/api/service-thresholds", "POST", {
        ...VALID_THRESHOLD,
        last_performed_mileage: 9000,
      }),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("at least");
  });

  it("returns 400 when last_performed_mileage/date pair is inconsistent with logged repairs", async () => {
    mockResults([
      { data: { id: "v1", baseline_mileage: 10000 }, error: null },
      { data: [makeRepair({ id: "r1", repair_date: "2024-06-01", mileage: 11000 })], error: null },
    ]);

    const ctx = createMockContext({
      request: jsonRequest("http://test/api/service-thresholds", "POST", {
        ...VALID_THRESHOLD,
        last_performed_date: "2024-03-01",
        last_performed_mileage: 11500,
      }),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("at most");
  });

  it("succeeds when last_performed_mileage/date pair is consistent with logged repairs", async () => {
    mockResults([
      { data: { id: "v1", baseline_mileage: 10000 }, error: null },
      { data: [makeRepair({ id: "r1", repair_date: "2024-06-01", mileage: 11000 })], error: null },
      { data: makeServiceThreshold(), error: null },
    ]);

    const ctx = createMockContext({
      request: jsonRequest("http://test/api/service-thresholds", "POST", {
        ...VALID_THRESHOLD,
        last_performed_date: "2024-01-01",
        last_performed_mileage: 10500,
      }),
    });
    const res = await POST(ctx);
    expect(res.status).toBe(201);
  });
});

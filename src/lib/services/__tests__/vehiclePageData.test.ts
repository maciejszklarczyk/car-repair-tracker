import { describe, it, expect } from "vitest";
import { getVehiclePageData } from "@/lib/services/vehiclePageData";
import { createMockSupabase, makeVehicle, makeRepair, makeServiceThreshold } from "@/test/helpers";

const vehicle = makeVehicle();
const repairs = [
  makeRepair({ id: "r1", mileage: 11000, cost: 500 }),
  makeRepair({ id: "r2", mileage: 12000, cost: 300 }),
];
const thresholds = [makeServiceThreshold()];

describe("getVehiclePageData", () => {
  it("returns full DTO when all queries succeed", async () => {
    const { client, mockResults } = createMockSupabase();
    mockResults([
      { data: vehicle, error: null },
      { data: repairs, error: null },
      { data: thresholds, error: null },
    ]);

    const result = await getVehiclePageData(client as never, "v1", "user-1");

    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.vehicle).toEqual(vehicle);
    expect(result.repairs).toEqual(repairs);
    expect(result.currentMileage).toBe(12000);
    expect(result.costPerKm).toBeTypeOf("number");
    expect(result.chartData).toBeInstanceOf(Array);
    expect(result.totalCostData).toBeInstanceOf(Array);
    expect(result.mileageData).toBeInstanceOf(Array);
    expect(result.thresholdSummary).toBeInstanceOf(Array);
    expect(result.thresholdSummary).toHaveLength(1);
  });

  it("returns null when vehicle query fails", async () => {
    const { client, mockResults } = createMockSupabase();
    mockResults([{ data: null, error: { message: "not found" } }]);

    const result = await getVehiclePageData(client as never, "v1", "user-1");
    expect(result).toBeNull();
  });

  it("returns null when repairs query fails", async () => {
    const { client, mockResults } = createMockSupabase();
    mockResults([
      { data: vehicle, error: null },
      { data: null, error: { message: "query error" } },
    ]);

    const result = await getVehiclePageData(client as never, "v1", "user-1");
    expect(result).toBeNull();
  });

  it("returns null when thresholds query fails", async () => {
    const { client, mockResults } = createMockSupabase();
    mockResults([
      { data: vehicle, error: null },
      { data: repairs, error: null },
      { data: null, error: { message: "query error" } },
    ]);

    const result = await getVehiclePageData(client as never, "v1", "user-1");
    expect(result).toBeNull();
  });

  it("passes explicit column lists to each select call", async () => {
    const { client, from, select, mockResults } = createMockSupabase();
    mockResults([
      { data: vehicle, error: null },
      { data: repairs, error: null },
      { data: thresholds, error: null },
    ]);

    await getVehiclePageData(client as never, "v1", "user-1");

    expect(from).toHaveBeenCalledWith("cars");
    expect(from).toHaveBeenCalledWith("repairs");
    expect(from).toHaveBeenCalledWith("service_thresholds");

    const selectCalls = select.mock.calls.map((c: unknown[]) => c[0]);
    expect(selectCalls).toContain(
      "id, user_id, make, model, year, baseline_mileage, archived_at, created_at, updated_at",
    );
    expect(selectCalls).toContain(
      "id, car_id, user_id, repair_date, description, cost, mileage, category, category_source, original_category, created_at, updated_at",
    );
    expect(selectCalls).toContain(
      "id, car_id, user_id, name, km_interval, days_interval, last_performed_date, last_performed_mileage, created_at, updated_at",
    );
  });

  it("calls compute functions with correct arguments", async () => {
    const { client, mockResults } = createMockSupabase();
    mockResults([
      { data: vehicle, error: null },
      { data: repairs, error: null },
      { data: thresholds, error: null },
    ]);

    const result = await getVehiclePageData(client as never, "v1", "user-1");

    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.currentMileage).toBe(12000);
    expect(result.costPerKm).toBeCloseTo(0.4);
    expect(result.chartData).toHaveLength(2);
    expect(result.totalCostData).toHaveLength(2);
    expect(result.mileageData).toHaveLength(2);
  });
});

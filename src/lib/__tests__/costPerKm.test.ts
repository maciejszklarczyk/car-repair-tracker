import { describe, it, expect } from "vitest";
import {
  computeCurrentMileage,
  computeCostPerKm,
  computeCostTrendData,
  computeMileageTrendData,
  computeTotalCostTrendData,
} from "@/lib/costPerKm";
import type { Repair, Vehicle } from "@/types";

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "v1",
    user_id: "u1",
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

function makeRepair(overrides: Partial<Repair> = {}): Repair {
  return {
    id: "r1",
    car_id: "v1",
    user_id: "u1",
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

describe("computeCurrentMileage", () => {
  it("returns baseline when no repairs", () => {
    expect(computeCurrentMileage([], 10000)).toBe(10000);
  });

  it("returns baseline when all repairs below baseline", () => {
    const repairs = [makeRepair({ mileage: 8000 }), makeRepair({ mileage: 9000 })];
    expect(computeCurrentMileage(repairs, 10000)).toBe(10000);
  });

  it("returns baseline when single repair at baseline", () => {
    const repairs = [makeRepair({ mileage: 10000 })];
    expect(computeCurrentMileage(repairs, 10000)).toBe(10000);
  });

  it("returns max mileage from multiple repairs", () => {
    const repairs = [makeRepair({ mileage: 11000 }), makeRepair({ mileage: 15000 }), makeRepair({ mileage: 12000 })];
    expect(computeCurrentMileage(repairs, 10000)).toBe(15000);
  });
});

describe("computeCostPerKm", () => {
  it("returns null when no repairs", () => {
    const vehicle = makeVehicle();
    expect(computeCostPerKm(vehicle, [])).toBeNull();
  });

  it("returns null when all repairs have null cost (totalCost = 0)", () => {
    const vehicle = makeVehicle();
    const repairs = [makeRepair({ cost: null, mileage: 11000 }), makeRepair({ cost: null, mileage: 12000 })];
    expect(computeCostPerKm(vehicle, repairs)).toBeNull();
  });

  it("returns null when repairs at baseline mileage (km = 0)", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    const repairs = [makeRepair({ cost: 500, mileage: 10000 })];
    expect(computeCostPerKm(vehicle, repairs)).toBeNull();
  });

  it("null cost treated as zero, not excluded from sum", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    const repairs = [makeRepair({ cost: 500, mileage: 11000 }), makeRepair({ cost: null, mileage: 11000 })];
    // totalCost = 500 + 0 = 500, km = 11000 - 10000 = 1000
    expect(computeCostPerKm(vehicle, repairs)).toBe(0.5);
  });

  it("single repair with known values: 500 / 500 = 1.0", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    const repairs = [makeRepair({ cost: 500, mileage: 10500 })];
    expect(computeCostPerKm(vehicle, repairs)).toBe(1.0);
  });

  it("multiple repairs: hand-calculated cumulative result", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    const repairs = [makeRepair({ cost: 300, mileage: 11000 }), makeRepair({ cost: 200, mileage: 12000 })];
    // totalCost = 300 + 200 = 500, km = max(11000,12000) - 10000 = 2000
    expect(computeCostPerKm(vehicle, repairs)).toBe(0.25);
  });
});

describe("computeCostTrendData", () => {
  it("returns empty array for no repairs", () => {
    const vehicle = makeVehicle();
    expect(computeCostTrendData(vehicle, [])).toEqual([]);
  });

  it("single costed repair above baseline returns one point", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    const repairs = [makeRepair({ cost: 500, mileage: 10500 })];
    // runningCost=500, kmDriven=500, costPerKm=1.0
    expect(computeCostTrendData(vehicle, repairs)).toEqual([{ date: "2024-06-01", costPerKm: 1.0 }]);
  });

  it("repair at baseline (kmDriven = 0) is skipped", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    const repairs = [makeRepair({ cost: 500, mileage: 10000 })];
    expect(computeCostTrendData(vehicle, repairs)).toEqual([]);
  });

  it("non-round cost/km is rounded to 2 decimal places", () => {
    const vehicle = makeVehicle({ baseline_mileage: 10000 });
    const repairs = [makeRepair({ cost: 100, mileage: 10300 })];
    // runningCost=100, kmDriven=300, 100/300=0.3333... → toFixed(2) → 0.33
    expect(computeCostTrendData(vehicle, repairs)).toEqual([{ date: "2024-06-01", costPerKm: 0.33 }]);
  });
});

describe("computeMileageTrendData", () => {
  it("returns empty array for no repairs", () => {
    expect(computeMileageTrendData([])).toEqual([]);
  });

  it("multiple repairs sorted by date with all included", () => {
    const repairs = [
      makeRepair({ repair_date: "2024-06-15", mileage: 12000 }),
      makeRepair({ repair_date: "2024-03-01", mileage: 11000 }),
    ];
    expect(computeMileageTrendData(repairs)).toEqual([
      { date: "2024-03-01", mileage: 11000 },
      { date: "2024-06-15", mileage: 12000 },
    ]);
  });
});

describe("computeTotalCostTrendData", () => {
  it("returns empty array for no repairs", () => {
    expect(computeTotalCostTrendData([])).toEqual([]);
  });

  it("multiple costed repairs produce running total sorted by date", () => {
    const repairs = [
      makeRepair({ id: "r2", repair_date: "2024-07-01", cost: 200 }),
      makeRepair({ id: "r1", repair_date: "2024-03-01", cost: 300 }),
    ];
    expect(computeTotalCostTrendData(repairs)).toEqual([
      { date: "2024-03-01", totalCost: 300 },
      { date: "2024-07-01", totalCost: 500 },
    ]);
  });
});

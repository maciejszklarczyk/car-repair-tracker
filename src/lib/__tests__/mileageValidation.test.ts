import { describe, it, expect } from "vitest";
import { computeMileageBounds } from "@/lib/mileageValidation";
import { makeRepair } from "@/test/helpers";

describe("computeMileageBounds", () => {
  it("returns baseline min and unbounded max when no siblings", () => {
    expect(computeMileageBounds([], 10000, "2024-06-01")).toEqual({ min: 10000, max: Infinity });
  });

  it("raises min from an earlier-only sibling, max stays unbounded", () => {
    const repairs = [makeRepair({ id: "r1", repair_date: "2024-01-01", mileage: 10500 })];
    expect(computeMileageBounds(repairs, 10000, "2024-06-01")).toEqual({ min: 10500, max: Infinity });
  });

  it("lowers max from a later-only sibling, min stays baseline", () => {
    const repairs = [makeRepair({ id: "r1", repair_date: "2024-12-01", mileage: 15000 })];
    expect(computeMileageBounds(repairs, 10000, "2024-06-01")).toEqual({ min: 10000, max: 15000 });
  });

  it("tightens both bounds with siblings on both sides", () => {
    const repairs = [
      makeRepair({ id: "r1", repair_date: "2024-01-01", mileage: 10500 }),
      makeRepair({ id: "r2", repair_date: "2024-12-01", mileage: 15000 }),
    ];
    expect(computeMileageBounds(repairs, 10000, "2024-06-01")).toEqual({ min: 10500, max: 15000 });
  });

  it("excludes same-date siblings from both bounds", () => {
    const repairs = [makeRepair({ id: "r1", repair_date: "2024-06-01", mileage: 99999 })];
    expect(computeMileageBounds(repairs, 10000, "2024-06-01")).toEqual({ min: 10000, max: Infinity });
  });

  it("excludes the repair being edited (excludeId) from both bounds", () => {
    const repairs = [
      makeRepair({ id: "r1", repair_date: "2024-01-01", mileage: 10500 }),
      makeRepair({ id: "r2", repair_date: "2024-12-01", mileage: 15000 }),
    ];
    expect(computeMileageBounds(repairs, 10000, "2024-06-01", "r1")).toEqual({ min: 10000, max: 15000 });
    expect(computeMileageBounds(repairs, 10000, "2024-06-01", "r2")).toEqual({ min: 10500, max: Infinity });
  });
});

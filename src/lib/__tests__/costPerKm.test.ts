import { describe, it, expect } from "vitest";
import { computeCurrentMileage } from "@/lib/costPerKm";

describe("computeCurrentMileage", () => {
  it("returns baseline when no repairs", () => {
    expect(computeCurrentMileage([], 10000)).toBe(10000);
  });
});

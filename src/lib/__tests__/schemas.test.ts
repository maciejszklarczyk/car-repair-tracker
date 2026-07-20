import { describe, it, expect } from "vitest";
import { createRepairSchema, updateRepairSchema } from "@/lib/schemas";

const VALID_CREATE = {
  car_id: "v1",
  repair_date: "2024-06-01",
  description: "Oil change",
  cost: "500",
  mileage: 11000,
};

const VALID_UPDATE = {
  repair_date: "2024-06-01",
  description: "Oil change",
  cost: 500,
  mileage: 11000,
};

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe("createRepairSchema — repair_date", () => {
  it("accepts today's date", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = createRepairSchema.safeParse({ ...VALID_CREATE, repair_date: today });
    expect(result.success).toBe(true);
  });

  it("accepts a past date", () => {
    const result = createRepairSchema.safeParse({ ...VALID_CREATE, repair_date: "2020-01-01" });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed date string", () => {
    const result = createRepairSchema.safeParse({ ...VALID_CREATE, repair_date: "not-a-date" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Repair date must be a valid date")).toBe(true);
    }
  });

  it("rejects an impossible calendar date", () => {
    const result = createRepairSchema.safeParse({ ...VALID_CREATE, repair_date: "2024-02-30" });
    expect(result.success).toBe(false);
  });

  it("rejects a future date", () => {
    const result = createRepairSchema.safeParse({ ...VALID_CREATE, repair_date: tomorrow() });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Repair date cannot be in the future")).toBe(true);
    }
  });
});

describe("updateRepairSchema — repair_date", () => {
  it("accepts today's date", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = updateRepairSchema.safeParse({ ...VALID_UPDATE, repair_date: today });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed date string", () => {
    const result = updateRepairSchema.safeParse({ ...VALID_UPDATE, repair_date: "06/01/2024" });
    expect(result.success).toBe(false);
  });

  it("rejects a future date", () => {
    const result = updateRepairSchema.safeParse({ ...VALID_UPDATE, repair_date: tomorrow() });
    expect(result.success).toBe(false);
  });
});

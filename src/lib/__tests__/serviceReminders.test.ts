import { describe, it, expect } from "vitest";
import {
  daysBetween,
  computeReminderStatus,
  computeThresholdSummary,
} from "@/lib/serviceReminders";
import type { ServiceThreshold } from "@/types";

function makeThreshold(overrides: Partial<ServiceThreshold> = {}): ServiceThreshold {
  return {
    id: "t1",
    car_id: "v1",
    user_id: "u1",
    name: "Oil change",
    km_interval: 10000,
    days_interval: 365,
    last_performed_date: "2024-01-01",
    last_performed_mileage: 50000,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

const TODAY = new Date("2024-06-01T12:00:00Z");

describe("daysBetween", () => {
  it("same day returns 0", () => {
    expect(daysBetween("2024-06-01", TODAY)).toBe(0);
  });

  it("30 days apart returns 30", () => {
    expect(daysBetween("2024-05-02", TODAY)).toBe(30);
  });

  it("future date returns negative number", () => {
    expect(daysBetween("2024-07-01", TODAY)).toBeLessThan(0);
  });
});

describe("computeReminderStatus", () => {
  describe("never performed", () => {
    it("both last_performed fields null returns overdue", () => {
      const threshold = makeThreshold({
        last_performed_date: null,
        last_performed_mileage: null,
      });
      expect(computeReminderStatus(threshold, 55000, TODAY)).toBe("overdue");
    });
  });

  describe("mileage-only (days_interval null)", () => {
    const base = { days_interval: null, last_performed_date: null };

    it("km_remaining = 0 returns overdue", () => {
      // last_performed_mileage(50000) + km_interval(10000) - currentMileage(60000) = 0
      const threshold = makeThreshold({ ...base, km_interval: 10000, last_performed_mileage: 50000 });
      expect(computeReminderStatus(threshold, 60000, TODAY)).toBe("overdue");
    });

    it("km_remaining = km_interval * 0.1 (boundary) returns approaching", () => {
      // 50000 + 10000 - 59000 = 1000, margin = 10000 * 0.1 = 1000
      const threshold = makeThreshold({ ...base, km_interval: 10000, last_performed_mileage: 50000 });
      expect(computeReminderStatus(threshold, 59000, TODAY)).toBe("approaching");
    });

    it("km_remaining = km_interval * 0.1 + 1 returns ok", () => {
      // 50000 + 10000 - 58999 = 1001, margin = 1000
      const threshold = makeThreshold({ ...base, km_interval: 10000, last_performed_mileage: 50000 });
      expect(computeReminderStatus(threshold, 58999, TODAY)).toBe("ok");
    });

    it("large remaining returns ok", () => {
      const threshold = makeThreshold({ ...base, km_interval: 10000, last_performed_mileage: 50000 });
      expect(computeReminderStatus(threshold, 51000, TODAY)).toBe("ok");
    });
  });

  describe("date-only (km_interval null)", () => {
    const base = { km_interval: null, last_performed_mileage: null };

    it("days_remaining = 0 returns overdue", () => {
      // days_interval(365) - daysBetween("2023-06-02", 2024-06-01) = 365 - 365 = 0
      const threshold = makeThreshold({ ...base, days_interval: 365, last_performed_date: "2023-06-02" });
      expect(computeReminderStatus(threshold, 50000, TODAY)).toBe("overdue");
    });

    it("days_remaining = 30 (boundary) returns approaching", () => {
      // days_interval(365) - daysBetween("2023-07-02", 2024-06-01) = 365 - 335 = 30
      const threshold = makeThreshold({ ...base, days_interval: 365, last_performed_date: "2023-07-02" });
      expect(computeReminderStatus(threshold, 50000, TODAY)).toBe("approaching");
    });

    it("days_remaining = 31 returns ok", () => {
      // days_interval(365) - daysBetween("2023-07-03", 2024-06-01) = 365 - 334 = 31
      const threshold = makeThreshold({ ...base, days_interval: 365, last_performed_date: "2023-07-03" });
      expect(computeReminderStatus(threshold, 50000, TODAY)).toBe("ok");
    });
  });

  describe("both intervals present (precedence)", () => {
    it("km overdue, date ok returns overdue", () => {
      const threshold = makeThreshold({
        km_interval: 10000,
        last_performed_mileage: 50000,
        days_interval: 365,
        last_performed_date: "2024-03-01",
      });
      // km: 50000+10000-60000=0 → overdue; date: 365-92=273 → ok
      expect(computeReminderStatus(threshold, 60000, TODAY)).toBe("overdue");
    });

    it("km ok, date overdue returns overdue", () => {
      const threshold = makeThreshold({
        km_interval: 10000,
        last_performed_mileage: 50000,
        days_interval: 100,
        last_performed_date: "2024-01-01",
      });
      // km: 50000+10000-51000=9000 → ok; date: 100-152 = -52 → overdue
      expect(computeReminderStatus(threshold, 51000, TODAY)).toBe("overdue");
    });

    it("both approaching returns approaching", () => {
      const threshold = makeThreshold({
        km_interval: 10000,
        last_performed_mileage: 50000,
        days_interval: 365,
        last_performed_date: "2023-07-02",
      });
      // km: 50000+10000-59500=500 → approaching (500 <= 1000); date: 365-335=30 → approaching
      expect(computeReminderStatus(threshold, 59500, TODAY)).toBe("approaching");
    });

    it("both ok returns ok", () => {
      const threshold = makeThreshold({
        km_interval: 10000,
        last_performed_mileage: 50000,
        days_interval: 365,
        last_performed_date: "2024-03-01",
      });
      // km: 50000+10000-51000=9000 → ok; date: 365-92=273 → ok
      expect(computeReminderStatus(threshold, 51000, TODAY)).toBe("ok");
    });
  });
});

describe("computeThresholdSummary", () => {
  it("empty array returns empty array", () => {
    expect(computeThresholdSummary([], 50000)).toEqual([]);
  });

  it("single threshold propagates correct status", () => {
    const threshold = makeThreshold({
      km_interval: 10000,
      last_performed_mileage: 50000,
      days_interval: null,
      last_performed_date: null,
    });
    const result = computeThresholdSummary([threshold], 60000);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("overdue");
    expect(result[0].km_remaining).toBe(0);
  });

  it("km_remaining null when km_interval null", () => {
    const threshold = makeThreshold({
      km_interval: null,
      last_performed_mileage: null,
      days_interval: 365,
      last_performed_date: "2024-03-01",
    });
    const result = computeThresholdSummary([threshold], 50000);
    expect(result[0].km_remaining).toBeNull();
  });
});

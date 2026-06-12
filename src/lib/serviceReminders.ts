import type { ServiceThreshold } from "@/types";

export type ReminderStatus = "overdue" | "approaching" | "ok";

export interface ThresholdWithStatus {
  threshold: ServiceThreshold;
  status: ReminderStatus;
  km_remaining: number | null;
  days_remaining: number | null;
}

export function daysBetween(dateStr: string, today: Date): number {
  const past = new Date(dateStr);
  const diff = today.getTime() - past.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function computeReminderStatus(
  threshold: ServiceThreshold,
  currentMileage: number,
  today: Date,
): ReminderStatus {
  const { km_interval, days_interval, last_performed_mileage, last_performed_date } = threshold;

  if (last_performed_mileage === null && last_performed_date === null) {
    return "overdue";
  }

  let status: ReminderStatus = "ok";

  if (km_interval !== null && last_performed_mileage !== null) {
    const km_remaining = last_performed_mileage + km_interval - currentMileage;
    if (km_remaining <= 0) {
      return "overdue";
    }
    if (km_remaining <= km_interval * 0.1) {
      status = "approaching";
    }
  }

  if (days_interval !== null && last_performed_date !== null) {
    const days_remaining = days_interval - daysBetween(last_performed_date, today);
    if (days_remaining <= 0) {
      return "overdue";
    }
    // Fixed 30-day margin (intentional — km uses relative 10% instead).
    if (days_remaining <= 30 && status !== "overdue") {
      status = "approaching";
    }
  }

  return status;
}

export function computeThresholdSummary(thresholds: ServiceThreshold[], currentMileage: number): ThresholdWithStatus[] {
  const today = new Date();
  return thresholds.map((threshold) => {
    const { km_interval, days_interval, last_performed_mileage, last_performed_date } = threshold;

    const km_remaining =
      km_interval !== null && last_performed_mileage !== null
        ? last_performed_mileage + km_interval - currentMileage
        : null;

    const days_remaining =
      days_interval !== null && last_performed_date !== null
        ? days_interval - daysBetween(last_performed_date, today)
        : null;

    return {
      threshold,
      status: computeReminderStatus(threshold, currentMileage, today),
      km_remaining,
      days_remaining,
    };
  });
}

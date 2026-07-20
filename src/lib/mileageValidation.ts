import type { Repair } from "@/types";

export function computeMileageBounds(
  repairs: Pick<Repair, "id" | "repair_date" | "mileage">[],
  baselineMileage: number,
  referenceDate: string,
  excludeId?: string,
): { min: number; max: number } {
  const siblings = repairs.filter((r) => r.id !== excludeId);

  const earlier = siblings.filter((r) => r.repair_date < referenceDate);
  const later = siblings.filter((r) => r.repair_date > referenceDate);

  const min = earlier.length > 0 ? Math.max(baselineMileage, ...earlier.map((r) => r.mileage)) : baselineMileage;
  const max = later.length > 0 ? Math.min(...later.map((r) => r.mileage)) : Infinity;

  return { min, max };
}

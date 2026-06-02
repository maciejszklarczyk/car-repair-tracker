import type { Repair, Vehicle } from "@/types";

export function computeCurrentMileage(repairs: Repair[], baselineMileage: number): number {
  if (repairs.length === 0) return baselineMileage;
  return Math.max(baselineMileage, ...repairs.map((r) => r.mileage));
}

export function computeCostPerKm(vehicle: Vehicle, repairs: Repair[]): number | null {
  const km = computeCurrentMileage(repairs, vehicle.baseline_mileage) - vehicle.baseline_mileage;
  if (km <= 0) return null;
  const totalCost = repairs.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  if (totalCost === 0) return null;
  return totalCost / km;
}

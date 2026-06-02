import type { Repair, Vehicle } from "@/types";

export function computeCostPerKm(vehicle: Vehicle, repairs: Repair[]): number | null {
  const km = vehicle.current_mileage - vehicle.baseline_mileage;
  if (km <= 0) return null;
  const totalCost = repairs.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  if (totalCost === 0) return null;
  return totalCost / km;
}

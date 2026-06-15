import type { Repair, Vehicle } from "@/types";

export function computeCurrentMileage(repairs: Pick<Repair, "mileage">[], baselineMileage: number): number {
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

export interface CostTrendPoint {
  date: string;
  costPerKm: number;
}

export interface TotalCostPoint {
  date: string;
  totalCost: number;
}

export function computeCostTrendData(vehicle: Vehicle, repairs: Repair[]): CostTrendPoint[] {
  const costed = repairs.filter((r): r is Repair & { cost: number } => r.cost != null);
  const sorted = [...costed].sort((a, b) => a.repair_date.localeCompare(b.repair_date));

  const points: CostTrendPoint[] = [];
  let runningCost = 0;

  for (const repair of sorted) {
    runningCost += repair.cost;
    const kmDriven = repair.mileage - vehicle.baseline_mileage;
    if (kmDriven <= 0) continue;
    points.push({
      date: repair.repair_date,
      costPerKm: parseFloat((runningCost / kmDriven).toFixed(2)),
    });
  }

  return points;
}

export interface MileagePoint {
  date: string;
  mileage: number;
}

export function computeMileageTrendData(repairs: Repair[]): MileagePoint[] {
  const sorted = [...repairs].sort((a, b) => a.repair_date.localeCompare(b.repair_date));
  return sorted.map((r) => ({ date: r.repair_date, mileage: r.mileage }));
}

export function computeTotalCostTrendData(repairs: Repair[]): TotalCostPoint[] {
  const costed = repairs.filter((r): r is Repair & { cost: number } => r.cost != null);
  const sorted = [...costed].sort((a, b) => a.repair_date.localeCompare(b.repair_date));

  const points: TotalCostPoint[] = [];
  let runningCost = 0;

  for (const repair of sorted) {
    runningCost += repair.cost;
    points.push({
      date: repair.repair_date,
      totalCost: parseFloat(runningCost.toFixed(2)),
    });
  }

  return points;
}

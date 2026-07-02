import { useRepairsStore } from "@/components/hooks/useRepairsStore";
import { computeCostPerKm, computeCurrentMileage } from "@/lib/costPerKm";
import type { Repair, Vehicle } from "@/types";

interface Props {
  vehicle: Vehicle;
  initialRepairs: Repair[];
}

export default function VehicleStatsHeader({ vehicle, initialRepairs }: Props) {
  const [repairs] = useRepairsStore(initialRepairs);
  const currentMileage = computeCurrentMileage(repairs, vehicle.baseline_mileage);
  const costPerKm = computeCostPerKm(vehicle, repairs);

  return (
    <>
      <span>Year: {vehicle.year}</span>
      <span>Mileage: {currentMileage.toLocaleString()} km</span>
      <span>
        Cost/km:{" "}
        {costPerKm !== null ? (
          `${costPerKm.toFixed(2)} PLN/km`
        ) : (
          <span className="text-xs text-blue-100/40">(— PLN/km — no cost data yet)</span>
        )}
      </span>
    </>
  );
}

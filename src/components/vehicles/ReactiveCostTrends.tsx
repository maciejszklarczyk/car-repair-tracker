import { useRepairsStore } from "@/components/hooks/useRepairsStore";
import CostTrendChart from "@/components/vehicles/CostTrendChart";
import { computeCostTrendData, computeMileageTrendData, computeTotalCostTrendData } from "@/lib/costPerKm";
import type { Repair, Vehicle } from "@/types";

interface Props {
  vehicle: Vehicle;
  initialRepairs: Repair[];
}

export default function ReactiveCostTrends({ vehicle, initialRepairs }: Props) {
  const [repairs] = useRepairsStore(initialRepairs);
  const chartData = computeCostTrendData(vehicle, repairs);
  const totalCostData = computeTotalCostTrendData(repairs);
  const mileageData = computeMileageTrendData(repairs);

  if (chartData.length < 2 && totalCostData.length < 2 && mileageData.length < 2) {
    return null;
  }

  return (
    <div className="mt-6">
      <h2 className="mb-4 text-xl font-semibold text-blue-100/80">Cost Trends</h2>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <CostTrendChart costPerKmData={chartData} totalCostData={totalCostData} mileageData={mileageData} />
      </div>
    </div>
  );
}

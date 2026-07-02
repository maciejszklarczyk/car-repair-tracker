import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vehicle, Repair, ServiceThreshold } from "@/types";
import { computeCurrentMileage } from "@/lib/costPerKm";
import { computeThresholdSummary, type ThresholdWithStatus } from "@/lib/serviceReminders";

export interface VehiclePageData {
  vehicle: Vehicle;
  repairs: Repair[];
  currentMileage: number;
  thresholdSummary: ThresholdWithStatus[];
}

const VEHICLE_COLUMNS = "id, user_id, make, model, year, baseline_mileage, archived_at, created_at, updated_at";
const REPAIR_COLUMNS =
  "id, car_id, user_id, repair_date, description, cost, mileage, category, category_source, original_category, created_at, updated_at";
const THRESHOLD_COLUMNS =
  "id, car_id, user_id, name, km_interval, days_interval, last_performed_date, last_performed_mileage, created_at, updated_at";

export async function getVehiclePageData(
  supabase: SupabaseClient,
  vehicleId: string,
  userId: string,
): Promise<VehiclePageData | null> {
  const vehicleResult = await supabase
    .from("cars")
    .select(VEHICLE_COLUMNS)
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .single();
  if (vehicleResult.error) return null;
  const vehicle: Vehicle = vehicleResult.data;

  const [repairsResult, thresholdsResult] = await Promise.all([
    supabase
      .from("repairs")
      .select(REPAIR_COLUMNS)
      .eq("car_id", vehicleId)
      .eq("user_id", userId)
      .order("repair_date", { ascending: false }),
    supabase
      .from("service_thresholds")
      .select(THRESHOLD_COLUMNS)
      .eq("car_id", vehicleId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);
  if (repairsResult.error) return null;
  const repairs: Repair[] = repairsResult.data;
  if (thresholdsResult.error) return null;
  const thresholds: ServiceThreshold[] = thresholdsResult.data;

  const currentMileage = computeCurrentMileage(repairs, vehicle.baseline_mileage);
  const thresholdSummary = computeThresholdSummary(thresholds, currentMileage);

  return {
    vehicle,
    repairs,
    currentMileage,
    thresholdSummary,
  };
}

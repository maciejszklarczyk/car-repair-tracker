import type { SupabaseClient } from "@supabase/supabase-js";

export async function seedDemoData(adminClient: SupabaseClient, userId: string): Promise<void> {
  const { data: cars, error: carsError } = await adminClient
    .from("cars")
    .insert([
      { user_id: userId, make: "Skoda", model: "Octavia", year: 2018, baseline_mileage: 120000 },
      { user_id: userId, make: "Volkswagen", model: "Golf VII", year: 2015, baseline_mileage: 85000 },
    ])
    .select("id");

  if (carsError) {
    throw new Error(`Failed to insert cars: ${carsError.message}`);
  }

  const octaviaId = cars[0].id as string;

  const repairs = [
    {
      car_id: octaviaId,
      user_id: userId,
      repair_date: "2024-03-01",
      description: "Wymiana oleju i filtra",
      cost: 200,
      mileage: 120500,
      category: "przegląd",
      category_source: "ai",
    },
    {
      car_id: octaviaId,
      user_id: userId,
      repair_date: "2024-05-10",
      description: "Wymiana rozrządu",
      cost: 2000,
      mileage: 122300,
      category: "silnik",
      category_source: "ai",
    },
    {
      car_id: octaviaId,
      user_id: userId,
      repair_date: "2024-07-20",
      description: "Klocki i tarcze hamulcowe (przód)",
      cost: 850,
      mileage: 125100,
      category: "hamulce",
      category_source: "ai",
    },
    {
      car_id: octaviaId,
      user_id: userId,
      repair_date: "2024-09-15",
      description: "Wymiana alternator — gwarancja",
      cost: null,
      mileage: 127000,
      category: "elektryka",
      category_source: "ai",
    },
    {
      car_id: octaviaId,
      user_id: userId,
      repair_date: "2024-12-05",
      description: "Opony zimowe + geometria",
      cost: 1400,
      mileage: 128000,
      category: "ogumienie",
      category_source: "ai",
    },
    {
      car_id: octaviaId,
      user_id: userId,
      repair_date: "2025-02-20",
      description: "Wymiana oleju i filtra",
      cost: 250,
      mileage: 130500,
      category: "przegląd",
      category_source: "ai",
    },
    {
      car_id: octaviaId,
      user_id: userId,
      repair_date: "2025-05-15",
      description: "Wymiana sprzęgła",
      cost: 3200,
      mileage: 133800,
      category: "silnik",
      category_source: "ai",
    },
    {
      car_id: octaviaId,
      user_id: userId,
      repair_date: "2025-08-01",
      description: "Nabicie klimatyzacji + filtr kabinowy",
      cost: 350,
      mileage: 136200,
      category: "inne",
      category_source: "ai",
    },
  ];

  const { error: repairsError } = await adminClient.from("repairs").insert(repairs);
  if (repairsError) {
    throw new Error(`Failed to insert repairs: ${repairsError.message}`);
  }

  const thresholds = [
    {
      car_id: octaviaId,
      user_id: userId,
      name: "Oil Change",
      km_interval: 10000,
      last_performed_mileage: 130500,
      last_performed_date: "2025-02-20",
    },
    {
      car_id: octaviaId,
      user_id: userId,
      name: "Przegląd techniczny",
      days_interval: 365,
      last_performed_date: "2025-05-01",
      last_performed_mileage: 133000,
    },
  ];

  const { error: thresholdsError } = await adminClient.from("service_thresholds").insert(thresholds);
  if (thresholdsError) {
    throw new Error(`Failed to insert thresholds: ${thresholdsError.message}`);
  }
}

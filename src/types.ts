export interface Repair {
  id: string;
  car_id: string;
  user_id: string;
  repair_date: string;
  description: string;
  cost: number | null;
  mileage: number;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year: number;
  current_mileage: number;
  baseline_mileage: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

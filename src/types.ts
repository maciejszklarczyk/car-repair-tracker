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

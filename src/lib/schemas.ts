import { z } from "zod";

export const createVehicleSchema = z
  .object({
    make: z.string().trim().min(1, "Make is required"),
    model: z.string().trim().min(1, "Model is required"),
    year: z
      .number({ error: "Year must be a number" })
      .int()
      .min(1900, "Year must be 1900 or later")
      .max(new Date().getFullYear(), "Year cannot be in the future"),
    current_mileage: z.number({ error: "Current mileage must be a number" }).int().min(0, "Mileage cannot be negative"),
    baseline_mileage: z
      .number({ error: "Baseline mileage must be a number" })
      .int()
      .min(0, "Mileage cannot be negative"),
  })
  .refine((data) => data.current_mileage >= data.baseline_mileage, {
    message: "Current mileage must be greater than or equal to baseline mileage",
    path: ["current_mileage"],
  });

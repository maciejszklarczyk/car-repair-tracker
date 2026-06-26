import { z } from "zod";
import { REPAIR_CATEGORIES } from "@/lib/repairCategories";

// For FormData input (POST) — cost is a string that gets transformed to number | null.
export const createRepairSchema = z.object({
  car_id: z.string().trim().min(1, "Car is required"),
  repair_date: z.string().trim().min(1, "Repair date is required"),
  description: z.string().trim().min(1, "Description is required").max(500, "Description cannot exceed 500 characters"),
  cost: z
    .string()
    .optional()
    .transform((val) => (val === undefined || val === "" ? null : Number(val)))
    .pipe(z.number().positive("Cost must be positive").nullable()),
  mileage: z.number({ error: "Mileage must be a number" }).int().min(0, "Mileage cannot be negative"),
});

// For JSON body input (PUT) — cost is already a number or null; omitting the field nulls it (PUT semantics).
export const updateRepairSchema = z.object({
  repair_date: z.string().trim().min(1, "Repair date is required"),
  description: z.string().trim().min(1, "Description is required").max(500, "Description cannot exceed 500 characters"),
  cost: z.number().positive("Cost must be positive").nullable().optional(),
  mileage: z.number({ error: "Mileage must be a number" }).int().min(0, "Mileage cannot be negative"),
});

export const createServiceThresholdSchema = z
  .object({
    car_id: z.string().min(1, "Car ID is required"),
    name: z.string().trim().min(1, "Name is required"),
    km_interval: z.number().int().positive("km_interval must be positive").optional(),
    days_interval: z.number().int().positive("days_interval must be positive").optional(),
    last_performed_date: z.string().trim().optional(),
    last_performed_mileage: z.number().int().min(0, "Mileage cannot be negative").optional(),
  })
  .refine((d) => d.km_interval !== undefined || d.days_interval !== undefined, {
    message: "At least one of km_interval or days_interval must be provided",
  });

export const updateServiceThresholdSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").optional(),
    km_interval: z.number().int().positive("km_interval must be positive").optional(),
    days_interval: z.number().int().positive("days_interval must be positive").optional(),
    last_performed_date: z.string().trim().nullable().optional(),
    last_performed_mileage: z.number().int().min(0, "Mileage cannot be negative").nullable().optional(),
  })
  .refine((d) => Object.values(d as Record<string, unknown>).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

export const categoryOverrideSchema = z.object({
  category: z.enum(REPAIR_CATEGORIES),
});

export const createVehicleSchema = z.object({
  make: z.string().trim().min(1, "Make is required"),
  model: z.string().trim().min(1, "Model is required"),
  year: z
    .number({ error: "Year must be a number" })
    .int()
    .min(1900, "Year must be 1900 or later")
    .max(new Date().getFullYear(), "Year cannot be in the future"),
  baseline_mileage: z.number({ error: "Baseline mileage must be a number" }).int().min(0, "Mileage cannot be negative"),
});

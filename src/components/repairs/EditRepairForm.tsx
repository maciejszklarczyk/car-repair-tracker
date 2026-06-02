import React, { useState } from "react";
import { Calendar, Gauge, DollarSign, FileText, Save } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { TextareaField } from "@/components/ui/TextareaField";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import type { Repair } from "@/types";

interface Props {
  repair: Repair;
  vehicleName: string;
  baselineMileage: number;
}

interface FormErrors {
  repair_date?: string;
  description?: string;
  cost?: string;
  mileage?: string;
}

export default function EditRepairForm({ repair, vehicleName, baselineMileage }: Props) {
  const [repairDate, setRepairDate] = useState(repair.repair_date);
  const [description, setDescription] = useState(repair.description);
  const [cost, setCost] = useState(repair.cost != null ? String(repair.cost) : "");
  const [mileage, setMileage] = useState(String(repair.mileage));
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const next: FormErrors = {};

    if (!repairDate.trim()) next.repair_date = "Repair date is required";

    if (!description.trim()) {
      next.description = "Description is required";
    } else if (description.length > 500) {
      next.description = "Description cannot exceed 500 characters";
    }

    if (cost.trim()) {
      const costNum = Number(cost);
      if (isNaN(costNum) || costNum <= 0) next.cost = "Cost must be a positive number";
    }

    if (!mileage.trim()) {
      next.mileage = "Mileage is required";
    } else {
      const mileageNum = Number(mileage);
      if (!Number.isInteger(mileageNum) || mileageNum < 0) next.mileage = "Mileage must be a non-negative integer";
      else if (mileageNum < baselineMileage)
        next.mileage = `Mileage must be at or above baseline mileage (${baselineMileage} km)`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof FormErrors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      const response = await fetch(`/api/repairs/${repair.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repair_date: repairDate,
          description,
          cost: cost.trim() ? Number(cost) : null,
          mileage: Number(mileage),
        }),
      });

      if (response.ok) {
        window.location.href = `/dashboard/vehicles/${repair.car_id}?success=updated`;
      } else {
        const data = (await response.json()) as { error?: string };
        setServerError(data.error ?? "An error occurred. Please try again.");
      }
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <p className="text-sm text-blue-100/60">{vehicleName}</p>

      <FormField
        id="repair_date"
        type="date"
        label="Repair Date"
        value={repairDate}
        onChange={(v) => {
          setRepairDate(v);
          clearError("repair_date");
        }}
        error={errors.repair_date}
        icon={<Calendar className="size-4" />}
      />

      <TextareaField
        id="description"
        label="Description"
        value={description}
        onChange={(v) => {
          setDescription(v);
          clearError("description");
        }}
        placeholder="e.g. Oil and filter change"
        error={errors.description}
        icon={<FileText className="size-4" />}
        maxLength={500}
      />

      <FormField
        id="cost"
        type="number"
        label="Cost (PLN) — optional"
        value={cost}
        onChange={(v) => {
          setCost(v);
          clearError("cost");
        }}
        placeholder="e.g. 350.00"
        error={errors.cost}
        icon={<DollarSign className="size-4" />}
      />

      <FormField
        id="mileage"
        type="number"
        label="Mileage (km)"
        value={mileage}
        onChange={(v) => {
          setMileage(v);
          clearError("mileage");
        }}
        placeholder="e.g. 121000"
        error={errors.mileage}
        icon={<Gauge className="size-4" />}
      />

      <ServerError message={serverError} />

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Saving...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Save className="size-4" />
            Save changes
          </span>
        )}
      </Button>
    </form>
  );
}

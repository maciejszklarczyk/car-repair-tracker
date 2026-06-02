import React, { useState } from "react";
import { Calendar, Gauge, DollarSign, FileText, Plus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { TextareaField } from "@/components/ui/TextareaField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  carId: string;
  vehicleName: string;
  serverError?: string | null;
  baselineMileage: number;
}

interface FormErrors {
  repair_date?: string;
  description?: string;
  cost?: string;
  mileage?: string;
}

const today = new Date().toISOString().split("T")[0];

export default function AddRepairForm({ carId, vehicleName, serverError, baselineMileage }: Props) {
  const [repairDate, setRepairDate] = useState(today);
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [mileage, setMileage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

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

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    if (!validate()) e.preventDefault();
  }

  return (
    <form method="POST" action="/api/repairs" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <input type="hidden" name="car_id" value={carId} />

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

      <SubmitButton pendingText="Adding repair..." icon={<Plus className="size-4" />}>
        Add repair
      </SubmitButton>
    </form>
  );
}

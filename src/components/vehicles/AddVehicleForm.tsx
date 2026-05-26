import React, { useState } from "react";
import { Car, Calendar, Gauge, Plus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  serverError?: string | null;
}

interface FormErrors {
  make?: string;
  model?: string;
  year?: string;
  current_mileage?: string;
  baseline_mileage?: string;
}

export default function AddVehicleForm({ serverError }: Props) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [currentMileage, setCurrentMileage] = useState("");
  const [baselineMileage, setBaselineMileage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): boolean {
    const next: FormErrors = {};

    if (!make.trim()) next.make = "Make is required";
    if (!model.trim()) next.model = "Model is required";

    const yearNum = Number(year);
    if (!year.trim()) {
      next.year = "Year is required";
    } else if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear()) {
      next.year = `Year must be between 1900 and ${new Date().getFullYear()}`;
    }

    const currentNum = Number(currentMileage);
    if (!currentMileage.trim()) {
      next.current_mileage = "Current mileage is required";
    } else if (!Number.isInteger(currentNum) || currentNum < 0) {
      next.current_mileage = "Mileage must be a non-negative integer";
    }

    const baselineNum = Number(baselineMileage);
    if (!baselineMileage.trim()) {
      next.baseline_mileage = "Baseline mileage is required";
    } else if (!Number.isInteger(baselineNum) || baselineNum < 0) {
      next.baseline_mileage = "Mileage must be a non-negative integer";
    }

    if (!next.current_mileage && !next.baseline_mileage && currentNum < baselineNum) {
      next.current_mileage = "Current mileage must be greater than or equal to baseline mileage";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof FormErrors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action="/api/vehicles" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="make"
        label="Make"
        value={make}
        onChange={(v) => {
          setMake(v);
          clearError("make");
        }}
        placeholder="e.g. Skoda"
        error={errors.make}
        icon={<Car className="size-4" />}
      />

      <FormField
        id="model"
        label="Model"
        value={model}
        onChange={(v) => {
          setModel(v);
          clearError("model");
        }}
        placeholder="e.g. Octavia"
        error={errors.model}
        icon={<Car className="size-4" />}
      />

      <FormField
        id="year"
        type="number"
        label="Year"
        value={year}
        onChange={(v) => {
          setYear(v);
          clearError("year");
        }}
        placeholder="e.g. 2018"
        error={errors.year}
        icon={<Calendar className="size-4" />}
      />

      <FormField
        id="current_mileage"
        type="number"
        label="Current Mileage (km)"
        value={currentMileage}
        onChange={(v) => {
          setCurrentMileage(v);
          clearError("current_mileage");
        }}
        placeholder="e.g. 145000"
        error={errors.current_mileage}
        icon={<Gauge className="size-4" />}
      />

      <FormField
        id="baseline_mileage"
        type="number"
        label="Baseline Mileage (km)"
        value={baselineMileage}
        onChange={(v) => {
          setBaselineMileage(v);
          clearError("baseline_mileage");
        }}
        placeholder="e.g. 142000"
        error={errors.baseline_mileage}
        icon={<Gauge className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText="Adding vehicle..." icon={<Plus className="size-4" />}>
        Add vehicle
      </SubmitButton>
    </form>
  );
}

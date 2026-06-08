import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  carId: string;
}

export default function AddServiceThresholdForm({ carId }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    const kmInterval = data.get("km_interval") as string;
    const daysInterval = data.get("days_interval") as string;

    if (!kmInterval && !daysInterval) {
      setError("At least one of km interval or days interval must be provided.");
      return;
    }

    const body: Record<string, unknown> = {
      car_id: carId,
      name: data.get("name"),
    };
    if (kmInterval) body.km_interval = Number(kmInterval);
    if (daysInterval) body.days_interval = Number(daysInterval);
    const lastDate = data.get("last_performed_date") as string;
    const lastMileage = data.get("last_performed_mileage") as string;
    if (lastDate) body.last_performed_date = lastDate;
    if (lastMileage) body.last_performed_mileage = Number(lastMileage);

    setLoading(true);
    try {
      const response = await fetch("/api/service-thresholds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        window.location.href = `?success=threshold_added`;
      } else {
        const json = (await response.json()) as { error?: string };
        setError(json.error ?? "Failed to add threshold.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button
        onClick={() => {
          setOpen(true);
        }}
        className="mt-4 bg-purple-600 text-white hover:bg-purple-500"
      >
        + Add Service Threshold
      </Button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <h3 className="mb-4 text-sm font-semibold text-blue-100/80">New Service Threshold</h3>
      {error && (
        <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-blue-100/60">Service name *</label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100 placeholder-blue-100/30 focus:border-purple-500/50 focus:outline-none"
            placeholder="e.g. Oil change"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-blue-100/60">Km interval</label>
            <input
              name="km_interval"
              type="number"
              min="1"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100 placeholder-blue-100/30 focus:border-purple-500/50 focus:outline-none"
              placeholder="e.g. 10000"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-blue-100/60">Days interval</label>
            <input
              name="days_interval"
              type="number"
              min="1"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100 placeholder-blue-100/30 focus:border-purple-500/50 focus:outline-none"
              placeholder="e.g. 365"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-blue-100/60">Last performed date</label>
            <input
              name="last_performed_date"
              type="date"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100 focus:border-purple-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-blue-100/60">Last performed mileage</label>
            <input
              name="last_performed_mileage"
              type="number"
              min="0"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100 placeholder-blue-100/30 focus:border-purple-500/50 focus:outline-none"
              placeholder="e.g. 45000"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="bg-purple-600 text-white hover:bg-purple-500">
            {loading ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="text-blue-100/60 hover:text-blue-100"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

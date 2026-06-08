import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ServiceThreshold } from "@/types";

interface Props {
  threshold: ServiceThreshold;
  onCancel: () => void;
}

export default function EditServiceThresholdForm({ threshold, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
      name: data.get("name") as string,
    };
    body.km_interval = kmInterval ? Number(kmInterval) : null;
    body.days_interval = daysInterval ? Number(daysInterval) : null;
    const lastDate = data.get("last_performed_date") as string;
    const lastMileage = data.get("last_performed_mileage") as string;
    body.last_performed_date = lastDate || null;
    body.last_performed_mileage = lastMileage ? Number(lastMileage) : null;

    setLoading(true);
    try {
      const response = await fetch(`/api/service-thresholds/${threshold.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        window.location.href = `?success=threshold_updated`;
      } else {
        const json = (await response.json()) as { error?: string };
        setError(json.error ?? "Failed to update threshold.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
      {error && (
        <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-blue-100/60">Service name *</label>
          <input
            name="name"
            required
            defaultValue={threshold.name}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100 focus:border-purple-500/50 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-blue-100/60">Km interval</label>
            <input
              name="km_interval"
              type="number"
              min="1"
              defaultValue={threshold.km_interval ?? ""}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100 focus:border-purple-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-blue-100/60">Days interval</label>
            <input
              name="days_interval"
              type="number"
              min="1"
              defaultValue={threshold.days_interval ?? ""}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100 focus:border-purple-500/50 focus:outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-blue-100/60">Last performed date</label>
            <input
              name="last_performed_date"
              type="date"
              defaultValue={threshold.last_performed_date ?? ""}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100 focus:border-purple-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-blue-100/60">Last performed mileage</label>
            <input
              name="last_performed_mileage"
              type="number"
              min="0"
              defaultValue={threshold.last_performed_mileage ?? ""}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100 focus:border-purple-500/50 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="bg-purple-600 text-white hover:bg-purple-500">
            {loading ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} className="text-blue-100/60 hover:text-blue-100">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

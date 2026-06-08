import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import EditServiceThresholdForm from "./EditServiceThresholdForm";
import type { ThresholdWithStatus } from "@/lib/serviceReminders";

interface Props {
  thresholds: ThresholdWithStatus[];
}

const statusBadge: Record<string, string> = {
  overdue: "bg-red-500/20 text-red-300 border-red-500/30",
  approaching: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  ok: "bg-green-500/20 text-green-300 border-green-500/30",
};

export default function ServiceThresholdList({ thresholds }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeleteError(null);
    try {
      const response = await fetch(`/api/service-thresholds/${id}`, { method: "DELETE" });
      if (response.ok || response.status === 204) {
        window.location.reload();
      } else {
        const data = (await response.json()) as { error?: string };
        setDeleteError(data.error ?? "Failed to delete. Please try again.");
      }
    } catch {
      setDeleteError("Network error. Please try again.");
    }
  }

  if (thresholds.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
        <p className="text-blue-100/50">No service thresholds yet.</p>
        <p className="mt-1 text-sm text-blue-100/30">Add a threshold to track maintenance intervals.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deleteError && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {deleteError}
        </p>
      )}
      {thresholds.map(({ threshold, status, km_remaining, days_remaining }) => (
        <div key={threshold.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-blue-100/90">{threshold.name}</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge[status]}`}>
                  {status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-blue-100/50">
                {threshold.km_interval !== null && (
                  <span>
                    Every {threshold.km_interval.toLocaleString()} km
                    {km_remaining !== null && (
                      <span className={km_remaining < 0 ? "text-red-400" : ""}>
                        {" "}
                        (
                        {km_remaining < 0
                          ? `${Math.abs(km_remaining).toLocaleString()} km overdue`
                          : `${km_remaining.toLocaleString()} km left`}
                        )
                      </span>
                    )}
                  </span>
                )}
                {threshold.days_interval !== null && (
                  <span>
                    Every {threshold.days_interval} days
                    {days_remaining !== null && (
                      <span className={days_remaining < 0 ? "text-red-400" : ""}>
                        {" "}
                        (
                        {days_remaining < 0
                          ? `${Math.abs(days_remaining)} days overdue`
                          : `${days_remaining} days left`}
                        )
                      </span>
                    )}
                  </span>
                )}
                {threshold.last_performed_date && (
                  <span>Last: {new Date(threshold.last_performed_date).toLocaleDateString("en-GB")}</span>
                )}
                {threshold.last_performed_mileage !== null && (
                  <span>@ {threshold.last_performed_mileage.toLocaleString()} km</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingId(editingId === threshold.id ? null : threshold.id);
                }}
                className="h-auto rounded-lg border border-white/10 px-3 py-1.5 text-xs text-blue-100/70 hover:border-white/20 hover:text-blue-100"
              >
                <Pencil className="size-3" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400/70 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="size-3" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-white/10 bg-slate-900">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Delete threshold?</AlertDialogTitle>
                    <AlertDialogDescription className="text-blue-100/60">
                      This will permanently remove &quot;{threshold.name}&quot;.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/10 text-blue-100/70 hover:text-blue-100">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 text-white hover:bg-red-500"
                      onClick={() => void handleDelete(threshold.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          {editingId === threshold.id && (
            <EditServiceThresholdForm
              threshold={threshold}
              onCancel={() => {
                setEditingId(null);
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

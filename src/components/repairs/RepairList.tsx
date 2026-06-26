import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import CategoryBadge from "@/components/repairs/CategoryBadge";
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
import type { Repair } from "@/types";

interface Props {
  repairs: Repair[];
}

export default function RepairList({ repairs: initialRepairs }: Props) {
  const [repairs, setRepairs] = useState<Repair[]>(initialRepairs);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(repairId: string) {
    setDeleteError(null);
    try {
      const response = await fetch(`/api/repairs/${repairId}`, { method: "DELETE" });
      if (response.ok) {
        setRepairs((prev) => prev.filter((r) => r.id !== repairId));
      } else {
        const data = (await response.json()) as { error?: string };
        setDeleteError(data.error ?? "Failed to delete repair. Please try again.");
      }
    } catch {
      setDeleteError("Network error. Please try again.");
    }
  }

  if (repairs.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
        <p className="text-blue-100/50">No repairs yet.</p>
        <p className="mt-1 text-sm text-blue-100/30">Repairs will appear here once added.</p>
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
      {repairs.map((repair) => (
        <div key={repair.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap gap-4 text-sm text-blue-100/60">
                <span>{new Date(repair.repair_date).toLocaleDateString("en-GB")}</span>
                <span>{repair.cost != null ? `${repair.cost.toLocaleString()} PLN` : "—"}</span>
                <span>{repair.mileage.toLocaleString()} km</span>
              </div>
              <div className="mb-2">
                <CategoryBadge category={repair.category} />
              </div>
              <p className="line-clamp-2 text-sm text-blue-100/90">{repair.description}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={`/dashboard/repairs/${repair.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-blue-100/70 transition-colors hover:border-white/20 hover:text-blue-100"
              >
                <Pencil className="size-3" />
                Edit
              </a>
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
                    <AlertDialogTitle className="text-white">Delete repair?</AlertDialogTitle>
                    <AlertDialogDescription className="text-blue-100/60">
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/10 text-blue-100/70 hover:text-blue-100">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 text-white hover:bg-red-500"
                      onClick={() => {
                        void handleDelete(repair.id);
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

import type { ThresholdWithStatus } from "@/lib/serviceReminders";

interface Props {
  thresholds: ThresholdWithStatus[];
}

export default function ServiceReminders({ thresholds }: Props) {
  const alerts = thresholds.filter((t) => t.status === "overdue" || t.status === "approaching");

  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-100/50">Service Alerts</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {alerts.map(({ threshold, status, km_remaining, days_remaining }) => {
          const isOverdue = status === "overdue";
          const cardClass = isOverdue
            ? "border-red-500/30 bg-red-500/10"
            : "border-yellow-500/30 bg-yellow-500/10";
          const titleClass = isOverdue ? "text-red-200" : "text-yellow-200";
          const subClass = isOverdue ? "text-red-300/70" : "text-yellow-300/70";

          return (
            <div key={threshold.id} className={`rounded-xl border p-4 backdrop-blur-xl ${cardClass}`}>
              <p className={`font-medium ${titleClass}`}>{threshold.name}</p>
              <div className={`mt-1 space-y-0.5 text-xs ${subClass}`}>
                {km_remaining !== null && (
                  <p>
                    {km_remaining <= 0
                      ? `${Math.abs(km_remaining).toLocaleString()} km overdue`
                      : `${km_remaining.toLocaleString()} km remaining`}
                  </p>
                )}
                {days_remaining !== null && (
                  <p>
                    {days_remaining <= 0
                      ? `${Math.abs(days_remaining)} days overdue`
                      : `${days_remaining} days remaining`}
                  </p>
                )}
                {km_remaining === null && days_remaining === null && <p>Never performed</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

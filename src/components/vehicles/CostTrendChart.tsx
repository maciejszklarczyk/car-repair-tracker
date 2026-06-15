import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import type { CostTrendPoint, TotalCostPoint, MileagePoint } from "@/lib/costPerKm";

type Tab = "costPerKm" | "totalCost" | "mileage";

interface Props {
  costPerKmData: CostTrendPoint[];
  totalCostData: TotalCostPoint[];
  mileageData: MileagePoint[];
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
}

const tooltipStyle = {
  backgroundColor: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  color: "#e2e8f0",
};

const gridStroke = "rgba(255,255,255,0.1)";
const axisStroke = "rgba(255,255,255,0.4)";
const axisTick = { fontSize: 12 };

export default function CostTrendChart({ costPerKmData, totalCostData, mileageData }: Props) {
  const [tab, setTab] = useState<Tab>("costPerKm");

  const hasCostPerKm = costPerKmData.length >= 2;
  const hasTotalCost = totalCostData.length >= 2;
  const hasMileage = mileageData.length >= 2;

  if (!hasCostPerKm && !hasTotalCost && !hasMileage) return null;

  const tabs: { key: Tab; label: string; available: boolean }[] = [
    { key: "costPerKm", label: "Cost/km", available: hasCostPerKm },
    { key: "totalCost", label: "Total Cost", available: hasTotalCost },
    { key: "mileage", label: "Mileage", available: hasMileage },
  ];

  const firstAvailable = tabs.find((t) => t.available);
  const activeTab = tabs.find((t) => t.key === tab)?.available ? tab : (firstAvailable?.key ?? "costPerKm");

  return (
    <div>
      <div className="mb-4 flex gap-1">
        {tabs
          .filter((t) => t.available)
          .map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === t.key ? "bg-white/10 text-blue-100" : "text-blue-100/40 hover:text-blue-100/70"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        {activeTab === "costPerKm" ? (
          <AreaChart data={costPerKmData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} stroke={axisStroke} tick={axisTick} />
            <YAxis tickFormatter={(v: number) => `${v} PLN/km`} stroke={axisStroke} tick={axisTick} width={90} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [`${Number(value).toFixed(2)} PLN/km`, "Cost/km"]}
              labelFormatter={(label) => formatDate(String(label))}
            />
            <Area type="monotone" dataKey="costPerKm" stroke="#818cf8" strokeWidth={2} fill="url(#costGradient)" />
          </AreaChart>
        ) : activeTab === "totalCost" ? (
          <AreaChart data={totalCostData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="totalCostGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} stroke={axisStroke} tick={axisTick} />
            <YAxis tickFormatter={(v: number) => `${v} PLN`} stroke={axisStroke} tick={axisTick} width={90} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [`${Number(value).toFixed(2)} PLN`, "Total Cost"]}
              labelFormatter={(label) => formatDate(String(label))}
            />
            <Area type="monotone" dataKey="totalCost" stroke="#a78bfa" strokeWidth={2} fill="url(#totalCostGradient)" />
          </AreaChart>
        ) : (
          <AreaChart data={mileageData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="mileageGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} stroke={axisStroke} tick={axisTick} />
            <YAxis
              tickFormatter={(v: number) => `${v.toLocaleString()} km`}
              stroke={axisStroke}
              tick={axisTick}
              width={90}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [`${Number(value).toLocaleString()} km`, "Mileage"]}
              labelFormatter={(label) => formatDate(String(label))}
            />
            <Area type="monotone" dataKey="mileage" stroke="#34d399" strokeWidth={2} fill="url(#mileageGradient)" />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

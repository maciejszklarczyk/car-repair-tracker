import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import type { CostTrendPoint } from "@/lib/costPerKm";

interface Props {
  chartData: CostTrendPoint[];
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
}

export default function CostTrendChart({ chartData }: Props) {
  if (chartData.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={formatDate} stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={(v: number) => `${v} PLN/km`}
          stroke="rgba(255,255,255,0.4)"
          tick={{ fontSize: 12 }}
          width={90}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            color: "#e2e8f0",
          }}
          formatter={(value: number) => [`${value.toFixed(2)} PLN/km`, "Cost/km"]}
          labelFormatter={formatDate}
        />
        <Area type="monotone" dataKey="costPerKm" stroke="#818cf8" strokeWidth={2} fill="url(#costGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

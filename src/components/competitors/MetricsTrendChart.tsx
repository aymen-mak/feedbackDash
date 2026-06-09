"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useChartColors } from "./useChartColors";
import { formatCount } from "./platformMeta";

export interface TrendSeries {
  id: string;
  name: string;
  color: string;
  values: (number | null)[];
  emphasized?: boolean;
}

interface Props {
  labels: string[];
  series: TrendSeries[];
}

export default function MetricsTrendChart({ labels, series }: Props) {
  const c = useChartColors();

  const data = labels.map((label, i) => {
    const row: Record<string, string | number | null> = { label };
    for (const s of series) row[s.id] = s.values[i];
    return row;
  });

  if (series.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-center text-sm text-makina-muted">
        No history yet for this platform — points accrue on each refresh / daily cron.
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: -4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: c.tick }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 10, fill: c.tick }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v) => formatCount(typeof v === "number" ? v : null)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: "10px",
              fontSize: "12px",
              color: c.tooltipText,
            }}
            formatter={(v, name) => [
              typeof v === "number" ? v.toLocaleString() : "—",
              name as string,
            ]}
          />
          {series.map((s) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.name}
              stroke={s.color}
              strokeWidth={s.emphasized ? 2.8 : 1.6}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
              strokeOpacity={s.emphasized ? 1 : 0.85}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

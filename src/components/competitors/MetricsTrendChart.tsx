"use client";

import {
  ComposedChart,
  Area,
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
  /** The protocol drawn as the bold, filled focus line. */
  focusId: string;
  /** Overlay the other protocols as faint context lines. */
  compareAll: boolean;
}

export default function MetricsTrendChart({ labels, series, focusId, compareAll }: Props) {
  const c = useChartColors();

  if (series.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-center text-sm text-makina-muted">
        No history yet for this platform — points accrue on each capture / daily cron.
      </div>
    );
  }

  const focus = series.find((s) => s.id === focusId) ?? series[0];
  const others = series.filter((s) => s.id !== focus.id);

  const data = labels.map((label, i) => {
    const row: Record<string, string | number | null> = { label };
    for (const s of series) row[s.id] = s.values[i];
    return row;
  });

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="metricsFocusFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={focus.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={focus.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: c.tick }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
            padding={{ left: 6, right: 6 }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: c.tick }}
            axisLine={false}
            tickLine={false}
            width={52}
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
            formatter={(v, name) => [typeof v === "number" ? v.toLocaleString() : "—", name as string]}
          />

          {/* Faint context lines (opt-in) drawn under the focus line. */}
          {compareAll &&
            others.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                name={s.name}
                stroke={s.color}
                strokeWidth={1.4}
                strokeOpacity={0.35}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls
              />
            ))}

          {/* Focus protocol: bold line + gradient area. */}
          <Area
            type="monotone"
            dataKey={focus.id}
            name={focus.name}
            stroke={focus.color}
            strokeWidth={3}
            fill="url(#metricsFocusFill)"
            dot={{ r: 2.5, fill: focus.color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

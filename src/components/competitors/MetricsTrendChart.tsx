"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
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
  /** "area" draws a single filled trend; "lines" overlays multiple. */
  mode: "area" | "lines";
  /** Axis/tooltip formatting: absolute counts, signed % change, or a ratio (x%). */
  valueFormat: "count" | "percent" | "ratio";
}

export default function MetricsTrendChart({ labels, series, mode, valueFormat }: Props) {
  const c = useChartColors();

  if (series.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-center text-sm text-makina-muted">
        Nothing selected — tick a protocol below to plot it.
      </div>
    );
  }

  const data = labels.map((label, i) => {
    const row: Record<string, string | number | null> = { label };
    for (const s of series) row[s.id] = s.values[i];
    return row;
  });

  const fmtTick = (v: number) =>
    valueFormat === "percent"
      ? `${v > 0 ? "+" : ""}${Math.round(v)}%`
      : valueFormat === "ratio"
      ? `${Math.round(v * 10) / 10}%`
      : formatCount(v);
  const fmtTip = (v: number) =>
    valueFormat === "percent"
      ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
      : valueFormat === "ratio"
      ? `${v.toFixed(1)}%`
      : v.toLocaleString();

  const head = series[0];

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="metricsFocusFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={head.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={head.color} stopOpacity={0} />
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
            width={54}
            tickFormatter={(v) => fmtTick(typeof v === "number" ? v : 0)}
          />
          {valueFormat === "percent" && <ReferenceLine y={0} stroke={c.tooltipBorder} strokeDasharray="4 4" />}
          <Tooltip
            contentStyle={{
              backgroundColor: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: "10px",
              fontSize: "12px",
              color: c.tooltipText,
            }}
            formatter={(v, name) => [typeof v === "number" ? fmtTip(v) : "—", name as string]}
          />

          {mode === "area" ? (
            <Area
              type="monotone"
              dataKey={head.id}
              name={head.name}
              stroke={head.color}
              strokeWidth={3}
              fill="url(#metricsFocusFill)"
              dot={{ r: 2.5, fill: head.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ) : (
            series.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                name={s.name}
                stroke={s.color}
                strokeWidth={s.emphasized ? 2.8 : 1.8}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

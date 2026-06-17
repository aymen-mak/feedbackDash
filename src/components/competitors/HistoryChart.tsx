"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { type Snapshot } from "@/lib/competitors/types";
import { useChartColors } from "./useChartColors";
import { formatCount } from "./platformMeta";

interface Props {
  snapshots: Snapshot[];
  color?: string;
}

export default function HistoryChart({ snapshots, color = "#5b9cf6" }: Props) {
  const c = useChartColors();
  const gid = `hist-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  const data = [...snapshots]
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
    .map((s) => ({
      date: new Date(s.capturedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: s.value,
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-center text-xs text-makina-muted">
        No history yet, a data point is captured on every refresh.
      </div>
    );
  }

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: c.tick }}
            axisLine={false}
            tickLine={false}
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 10, fill: c.tick }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v) => formatCount(typeof v === "number" ? v : null)}
          />
          <Tooltip
            cursor={{ stroke: c.cursor, strokeWidth: 1, strokeDasharray: "4 4" }}
            contentStyle={{
              backgroundColor: c.tooltipBg,
              border: `1px solid ${c.tooltipBorder}`,
              borderRadius: "10px",
              fontSize: "12px",
              color: c.tooltipText,
            }}
            labelStyle={{ color: c.tick, marginBottom: 2, fontSize: 11 }}
            formatter={(v) => [typeof v === "number" ? v.toLocaleString() : String(v ?? ""), "value"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gid})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

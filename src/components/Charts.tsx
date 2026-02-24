"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DailyMetric {
  date: string;
  submissions: number;
  satisfaction: number;
  issues: number;
  resolved: number;
}

type MetricKey = "submissions" | "satisfaction" | "issues";
type TimeRange = "7D" | "14D" | "All";

const METRICS: { key: MetricKey; label: string; color: string; format: (v: number) => string }[] = [
  { key: "submissions", label: "Submissions", color: "#34d399", format: (v) => String(v) },
  { key: "satisfaction", label: "Satisfaction %", color: "#22c55e", format: (v) => `${v}%` },
  { key: "issues", label: "Open Issues", color: "#ef4444", format: (v) => String(v) },
];

function useChartColors() {
  const [colors, setColors] = useState({
    grid: "#1e2a3d",
    tick: "#64748b",
    tooltipBg: "#141c2b",
    tooltipBorder: "#1e2a3d",
    tooltipText: "#f1f5f9",
    cursor: "#334155",
    dotStroke: "#141c2b",
  });

  useEffect(() => {
    const update = () => {
      const s = getComputedStyle(document.documentElement);
      setColors({
        grid: s.getPropertyValue("--chart-grid").trim() || "#1e2a3d",
        tick: s.getPropertyValue("--chart-tick").trim() || "#64748b",
        tooltipBg: s.getPropertyValue("--chart-tooltip-bg").trim() || "#141c2b",
        tooltipBorder: s.getPropertyValue("--chart-tooltip-border").trim() || "#1e2a3d",
        tooltipText: s.getPropertyValue("--chart-tooltip-text").trim() || "#f1f5f9",
        cursor: s.getPropertyValue("--chart-cursor").trim() || "#334155",
        dotStroke: s.getPropertyValue("--chart-dot-stroke").trim() || "#141c2b",
      });
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return colors;
}

function getTimeSlice(data: DailyMetric[], range: TimeRange) {
  if (range === "7D") return data.slice(-7);
  if (range === "14D") return data.slice(-14);
  return data;
}

function getTotal(data: DailyMetric[], key: MetricKey) {
  if (key === "satisfaction") {
    const valid = data.filter((d) => d.submissions > 0);
    if (valid.length === 0) return 0;
    const avg = valid.reduce((sum, d) => sum + d[key], 0) / valid.length;
    return Math.round(avg);
  }
  return data.reduce((sum, d) => sum + d[key], 0);
}

function getChange(data: DailyMetric[], key: MetricKey) {
  if (data.length < 2) return 0;
  const half = Math.floor(data.length / 2);
  const recent = data.slice(half);
  const earlier = data.slice(0, half);
  const recentAvg = recent.reduce((s, d) => s + d[key], 0) / recent.length;
  const earlierAvg = earlier.reduce((s, d) => s + d[key], 0) / earlier.length;
  if (earlierAvg === 0) return 0;
  return Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100);
}

interface AnalyticsChartProps {
  data?: DailyMetric[];
}

export function AnalyticsChart({ data: externalData }: AnalyticsChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("submissions");
  const [timeRange, setTimeRange] = useState<TimeRange>("14D");
  const [chartData, setChartData] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(!externalData);
  const c = useChartColors();

  useEffect(() => {
    if (externalData) {
      setChartData(externalData);
      setLoading(false);
      return;
    }
    fetch("/api/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((stats) => {
        setChartData(stats?.dailyMetrics || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [externalData]);

  const data = getTimeSlice(chartData, timeRange);
  const metric = METRICS.find((m) => m.key === activeMetric)!;
  const total = getTotal(data, activeMetric);
  const change = getChange(data, activeMetric);

  if (loading) {
    return (
      <div className="rounded-lg bg-makina-card border border-makina-border p-5 h-96 flex items-center justify-center">
        <div className="text-sm text-makina-muted animate-pulse">Loading chart data...</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-makina-card border border-makina-border overflow-hidden animate-fade-in-up">
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-makina-muted font-medium uppercase tracking-wider mb-1">{metric.label}</p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold tracking-tight" style={{ color: metric.color }}>
                {metric.format(total)}
              </span>
              <span className={`text-sm font-semibold ${change >= 0 ? "text-makina-green" : "text-makina-red"}`}>
                {change >= 0 ? "+" : ""}{change}%
              </span>
            </div>
          </div>
          <div className="flex items-center rounded-lg bg-makina-surface border border-makina-border p-0.5">
            {(["7D", "14D", "All"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  timeRange === range
                    ? "bg-makina-card text-makina-text shadow-sm"
                    : "text-makina-muted hover:text-makina-text"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                activeMetric === m.key
                  ? "bg-makina-surface text-makina-text border border-makina-border"
                  : "text-makina-subtle hover:text-makina-muted"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: m.color, opacity: activeMetric === m.key ? 1 : 0.4 }}
              />
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-72 px-2 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: c.tick }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: c.tick }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: c.tooltipBg,
                border: `1px solid ${c.tooltipBorder}`,
                borderRadius: "12px",
                fontSize: "12px",
                color: c.tooltipText,
              }}
              cursor={{ stroke: c.cursor, strokeDasharray: "4 4" }}
            />
            <Bar
              dataKey={activeMetric}
              fill={metric.color}
              opacity={0.15}
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Area
              type="monotone"
              dataKey={activeMetric}
              stroke={metric.color}
              strokeWidth={2}
              fill="url(#areaGrad)"
              dot={false}
              activeDot={{ r: 4, fill: metric.color, stroke: c.dotStroke, strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

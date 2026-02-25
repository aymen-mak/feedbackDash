"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DailyMetric {
  date: string;
  submissions: number;
  core: number;
  uiux: number;
  app: number;
  operatorCli: number;
  issues: number;
  resolved: number;
}

type ViewMode = "categories" | "issues";
type TimeRange = "7D" | "14D" | "All";

const CATEGORY_LINES = [
  { key: "core", label: "Core", color: "#3b82f6" },
  { key: "uiux", label: "UI/UX", color: "#8b5cf6" },
  { key: "app", label: "App", color: "#10b981" },
  { key: "operatorCli", label: "Operator CLI", color: "#f97316" },
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

interface AnalyticsChartProps {
  data?: DailyMetric[];
}

export function AnalyticsChart({ data: externalData }: AnalyticsChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("categories");
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

  const totalSubmissions = data.reduce((s, d) => s + d.submissions, 0);
  const totalIssues = data.reduce((s, d) => s + d.issues, 0);

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
            <p className="text-xs text-makina-muted font-medium uppercase tracking-wider mb-1">
              {viewMode === "categories" ? "Submissions by Category" : "Issues & Resolution"}
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold tracking-tight text-makina-text">
                {viewMode === "categories" ? totalSubmissions : totalIssues}
              </span>
              <span className="text-sm text-makina-muted">
                {viewMode === "categories" ? "total submissions" : "total issues"}
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
          {(["categories", "issues"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === mode
                  ? "bg-makina-surface text-makina-text border border-makina-border"
                  : "text-makina-subtle hover:text-makina-muted"
              }`}
            >
              {mode === "categories" ? "By Category" : "Issues"}
            </button>
          ))}
        </div>
      </div>
      <div className="h-72 px-2 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              {CATEGORY_LINES.map((cat) => (
                <linearGradient key={cat.key} id={`grad-${cat.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cat.color} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={cat.color} stopOpacity={0} />
                </linearGradient>
              ))}
              <linearGradient id="grad-issues" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: c.tick }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: c.tick }} axisLine={false} tickLine={false} allowDecimals={false} />
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
            {viewMode === "categories" ? (
              <>
                {CATEGORY_LINES.map((cat) => (
                  <Area
                    key={cat.key}
                    type="monotone"
                    dataKey={cat.key}
                    name={cat.label}
                    stroke={cat.color}
                    strokeWidth={2}
                    fill={`url(#grad-${cat.key})`}
                    dot={false}
                    activeDot={{ r: 4, fill: cat.color, stroke: c.dotStroke, strokeWidth: 2 }}
                  />
                ))}
                <Legend
                  verticalAlign="bottom"
                  height={30}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: c.tick, fontSize: "11px" }}>{value}</span>
                  )}
                />
              </>
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="issues"
                  name="Issues"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#grad-issues)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#ef4444", stroke: c.dotStroke, strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 4, fill: "#22c55e", stroke: c.dotStroke, strokeWidth: 2 }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={30}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: c.tick, fontSize: "11px" }}>{value}</span>
                  )}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  SENTIMENT_OVER_TIME,
  FEEDBACK_BY_TYPE,
  TOP_QUICK_ACTIONS,
} from "@/lib/mock-data";

const tooltipStyle = {
  backgroundColor: "#141c2b",
  border: "1px solid #1e2a3d",
  borderRadius: "12px",
  fontSize: "12px",
  color: "#f1f5f9",
};

export function SentimentChart() {
  return (
    <div className="rounded-2xl bg-makina-card border border-makina-border p-5">
      <h3 className="text-sm font-semibold mb-4">Sentiment Over Time</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={SENTIMENT_OVER_TIME}>
            <defs>
              <linearGradient id="gradPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3d" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="positive" stroke="#22c55e" fill="url(#gradPositive)" strokeWidth={2} />
            <Area type="monotone" dataKey="neutral" stroke="#64748b" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
            <Area type="monotone" dataKey="negative" stroke="#ef4444" fill="url(#gradNegative)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-makina-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" /> Positive
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-makina-muted" /> Neutral
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Negative
        </span>
      </div>
    </div>
  );
}

export function FeedbackTypePie() {
  return (
    <div className="rounded-2xl bg-makina-card border border-makina-border p-5">
      <h3 className="text-sm font-semibold mb-4">Feedback by Type</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={FEEDBACK_BY_TYPE}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {FEEDBACK_BY_TYPE.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {FEEDBACK_BY_TYPE.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-makina-muted">{item.name}</span>
            <span className="ml-auto font-medium">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TopActionsChart() {
  return (
    <div className="rounded-2xl bg-makina-card border border-makina-border p-5">
      <h3 className="text-sm font-semibold mb-4">Top Quick Actions</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={TOP_QUICK_ACTIONS} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3d" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="action" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={120} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={24}>
              {TOP_QUICK_ACTIONS.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index < 3 ? "#CAEF45" : "#334155"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

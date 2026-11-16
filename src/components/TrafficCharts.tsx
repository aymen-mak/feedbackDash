"use client";

import { useId } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useChartColors } from "@/components/competitors/useChartColors";
import { type TrafficWeek, pagesPerVisitor } from "@/lib/traffic/types";

// Interactive traffic charts: gradient area fills, a crosshair with a tooltip
// that shows the exact values at the hovered point, formatted axes, and
// theme-aware colors from the shared useChartColors hook (--chart-* tokens).

const ACCENT = "#5b9cf6"; // pageviews
const GREEN = "#22c55e"; // visitors

const fmtFull = (n: number): string => n.toLocaleString("en-US");
const fmtK = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1000) return (n / 1000).toFixed(a % 1000 === 0 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(n);
};

interface Datum {
  name: string;
  full?: string;
  visitors?: number;
  pageviews?: number;
  value?: number;
  ppv?: number | null;
  id?: string;
}
interface TipItem {
  dataKey: string;
  name: string;
  value: number;
  color: string;
  payload: Datum;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TipItem[] }) {
  const c = useChartColors();
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText }}>
      <div className="mb-1 font-semibold">{d.full ?? d.name}</div>
      <div className="space-y-0.5">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-5">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
              <span style={{ opacity: 0.8 }}>{p.name}</span>
            </span>
            <span className="font-semibold tabular-nums">{fmtFull(p.value)}</span>
          </div>
        ))}
        {d.ppv != null && (
          <div className="mt-1 flex items-center justify-between gap-5 pt-1" style={{ borderTop: `1px solid ${c.tooltipBorder}` }}>
            <span style={{ opacity: 0.6 }}>Pages / visitor</span>
            <span className="font-semibold tabular-nums">{d.ppv}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TrafficArea({ data, height, highlight }: { data: Datum[]; height: number; highlight?: string }) {
  const c = useChartColors();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gPv = `pv-${uid}`;
  const gV = `v-${uid}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 10, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={gPv} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={gV} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity={0.3} />
            <stop offset="100%" stopColor={GREEN} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="name" tick={{ fill: c.tick, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={14} />
        <YAxis tick={{ fill: c.tick, fontSize: 11 }} tickLine={false} axisLine={false} width={38} tickFormatter={fmtK} />
        {highlight && <ReferenceLine x={highlight} stroke={c.cursor} strokeDasharray="3 3" />}
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: c.cursor, strokeWidth: 1, strokeDasharray: "4 4" }} />
        <Area type="monotone" dataKey="pageviews" name="Pageviews" stroke={ACCENT} strokeWidth={2} fill={`url(#${gPv})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: c.dotStroke }} />
        <Area type="monotone" dataKey="visitors" name="Visitors" stroke={GREEN} strokeWidth={2} fill={`url(#${gV})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: c.dotStroke }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-makina-muted">
      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: ACCENT }} />Pageviews</span>
      <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: GREEN }} />Visitors</span>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-makina-border bg-makina-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-makina-text">{title}</h3>
        <Legend />
      </div>
      {children}
    </div>
  );
}

const short = (w: TrafficWeek): string => (w.label.split(/[–-]/)[0] || w.weekStart).trim();

export function WeeksArea({ weeks, selId }: { weeks: TrafficWeek[]; selId: string }) {
  const chrono = [...weeks].reverse(); // oldest to newest
  if (chrono.length < 2) return null; // a trend needs at least two reports
  const data: Datum[] = chrono.map((w) => ({
    name: short(w),
    full: w.label,
    id: w.id,
    visitors: w.visitors,
    pageviews: w.pageviews,
    ppv: pagesPerVisitor(w.pageviews, w.visitors),
  }));
  const highlight = data.find((d) => d.id === selId)?.name;
  return (
    <ChartCard title="Activity since the first report">
      <TrafficArea data={data} height={260} highlight={highlight} />
    </ChartCard>
  );
}

export function DailyArea({ week }: { week: TrafficWeek }) {
  if (!week.daily || !week.daily.length) return null;
  const data: Datum[] = week.daily.map((d) => ({
    name: d.day.split(" ").slice(1).join(" ") || d.day,
    full: d.day,
    visitors: d.visitors,
    pageviews: d.pageviews,
    ppv: pagesPerVisitor(d.pageviews, d.visitors),
  }));
  return (
    <ChartCard title="Daily traffic">
      <TrafficArea data={data} height={220} />
    </ChartCard>
  );
}

function SparkTooltip({ active, payload, fmtVal }: { active?: boolean; payload?: TipItem[]; fmtVal: (n: number) => string }) {
  const c = useChartColors();
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-md px-2 py-1 text-[11px] shadow-lg" style={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText }}>
      <span style={{ opacity: 0.6 }}>{p.payload.name} </span>
      <span className="font-semibold tabular-nums">{fmtVal(p.value)}</span>
    </div>
  );
}

export function MetricSpark({ data, color, fmtVal }: { data: { name: string; value: number }[]; color: string; fmtVal: (n: number) => string }) {
  const c = useChartColors();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gid = `sp-${uid}`;
  if (data.length < 2) return <div className="h-full" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Tooltip content={<SparkTooltip fmtVal={fmtVal} />} cursor={{ stroke: c.cursor, strokeWidth: 1 }} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gid})`} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

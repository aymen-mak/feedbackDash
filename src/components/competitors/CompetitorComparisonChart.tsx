"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import { useChartColors } from "./useChartColors";
import {
  type Competitor,
  PLATFORMS,
  PLATFORM_LABELS,
  PLATFORM_METRIC_UNIT,
} from "@/lib/competitors/types";
import { PLATFORM_META, formatCount, formatUsd } from "./platformMeta";

interface SeriesDef {
  key: string;
  short: string;
  label: string;
  color: string;
  usd?: boolean;
  get: (c: Competitor) => number | null;
}

const ONCHAIN_SERIES: SeriesDef[] = [
  { key: "tvl", short: "TVL", label: "TVL", color: "#10b981", usd: true, get: (c) => c.onchain?.tvl ?? null },
  { key: "fees24h", short: "Fees", label: "Fees (24h)", color: "#f59e0b", usd: true, get: (c) => c.onchain?.fees24h ?? null },
  { key: "mcap", short: "Mcap", label: "Market cap", color: "#a78bfa", usd: true, get: (c) => c.onchain?.mcap ?? null },
];

const PLATFORM_SERIES: SeriesDef[] = PLATFORMS.map((p) => ({
  key: p,
  short: PLATFORM_META[p].short,
  label: `${PLATFORM_LABELS[p]} ${PLATFORM_METRIC_UNIT[p]}`,
  color: PLATFORM_META[p].color,
  get: (c) => c.platforms.find((m) => m.platform === p)?.value ?? null,
}));

const ALL_SERIES: SeriesDef[] = [...ONCHAIN_SERIES, ...PLATFORM_SERIES];

interface Datum {
  name: string;
  value: number;
  isSelf: boolean;
  pinned: boolean;
}

export default function CompetitorComparisonChart({ competitors }: { competitors: Competitor[] }) {
  const c = useChartColors();

  const available = useMemo(
    () => ALL_SERIES.filter((s) => competitors.some((comp) => s.get(comp) != null)),
    [competitors]
  );

  const [seriesKey, setSeriesKey] = useState<string>("tvl");
  const series = available.find((s) => s.key === seriesKey) ?? available[0];

  const data = useMemo<Datum[]>(() => {
    if (!series) return [];
    return competitors
      .map((comp): Datum | null => {
        const v = series.get(comp);
        return v != null ? { name: comp.name, value: v, isSelf: comp.isSelf, pinned: !!comp.pinned } : null;
      })
      .filter((d): d is Datum => d !== null)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.value - a.value);
  }, [competitors, series]);

  const fmt = (v: number) => (series?.usd ? formatUsd(v) : formatCount(v));
  // Only dim non-pinned bars when something is actually pinned.
  const anyPinned = data.some((d) => d.pinned);

  return (
    <div className="rounded-xl border border-makina-border bg-makina-card p-5 animate-fade-in-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-makina-muted">Reach &amp; size comparison</p>
          <h2 className="text-sm font-bold text-makina-text">{series?.label ?? "—"}</h2>
        </div>
        <div className="flex max-w-full flex-wrap gap-1">
          {available.map((s) => (
            <button
              key={s.key}
              onClick={() => setSeriesKey(s.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                series?.key === s.key
                  ? "border border-makina-border bg-makina-surface text-makina-text"
                  : "text-makina-subtle hover:text-makina-muted"
              }`}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: s.color }} />
              {s.short}
            </button>
          ))}
        </div>
      </div>

      {!series || data.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-makina-muted">
          No values yet for this metric — run a refresh.
        </div>
      ) : (
        <div style={{ height: Math.max(160, data.length * 38 + 24) }} className="mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, left: 8, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fontSize: 11, fill: c.tick }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: c.cursor, opacity: 0.15 }}
                contentStyle={{
                  backgroundColor: c.tooltipBg,
                  border: `1px solid ${c.tooltipBorder}`,
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: c.tooltipText,
                }}
                formatter={(v: number | string | undefined) => [
                  series.usd ? formatUsd(Number(v ?? 0)) : Number(v ?? 0).toLocaleString(),
                  series.label,
                ]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={series.color}
                    opacity={d.pinned || !anyPinned ? 1 : 0.4}
                    stroke={d.pinned ? "#93c5fd" : "none"}
                    strokeWidth={d.pinned ? 1.5 : 0}
                  />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(v) => (typeof v === "number" ? fmt(v) : "")}
                  style={{ fontSize: 11, fill: c.tick, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-[10px] text-makina-subtle">
        On-chain (TVL/fees/mcap) via DefiLlama. Discord/Telegram/GitHub auto-collected; X/LinkedIn best-effort scrape; values refresh on the cron or “Refresh now”.
      </p>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import {
  RefreshCw,
  Download,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Trophy,
  Crown,
  Minus,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import PasswordGate from "@/components/PasswordGate";
import Sparkline from "@/components/competitors/Sparkline";
import MetricsTrendChart, { type TrendSeries } from "@/components/competitors/MetricsTrendChart";
import { formatCount, signedPct, PLATFORM_META } from "@/components/competitors/platformMeta";
import { downloadCsv } from "@/components/competitors/exportCsv";
import {
  GRANULARITIES,
  type Granularity,
  periodStarts,
  periodValues,
  periodLabel,
  pointsFor,
} from "@/components/competitors/metricsBuckets";
import {
  type Competitor,
  type Snapshot,
  type Platform,
  PLATFORM_LABELS,
  PLATFORM_METRIC_UNIT,
} from "@/lib/competitors/types";

// Platforms offered on the Metrics page, in display order.
const PLATFORM_PICK: Platform[] = ["twitter", "telegram", "discord", "linkedin", "github", "website"];

const SELF_COLOR = "#5b9cf6";
const PALETTE = [
  "#f59e0b", "#22c55e", "#a78bfa", "#ec4899", "#14b8a6", "#ef4444",
  "#eab308", "#0ea5e9", "#f97316", "#8b5cf6", "#84cc16", "#06b6d4",
];

interface Row {
  c: Competitor;
  values: (number | null)[];
  current: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  spark: number[];
}

function DeltaTag({ abs, pct, size = "sm" }: { abs: number | null; pct: number | null; size?: "sm" | "lg" }) {
  if (abs == null) {
    return <span className="text-makina-subtle">— new</span>;
  }
  const flat = abs === 0;
  const up = abs > 0;
  const cls = flat ? "text-makina-muted" : up ? "text-makina-green" : "text-makina-red";
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 ${cls} ${size === "lg" ? "text-sm font-semibold" : "text-[11px] font-medium"}`}>
      <Icon size={size === "lg" ? 14 : 11} />
      {up ? "+" : ""}
      {formatCount(Math.abs(abs))}
      {pct != null && <span className="opacity-70">({signedPct(pct)})</span>}
    </span>
  );
}

function MetricsInner() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [platform, setPlatform] = useState<Platform>("twitter");
  const [gran, setGran] = useState<Granularity>("weekly");
  const [showDetails, setShowDetails] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cs, ss] = await Promise.all([
        fetch("/api/competitors").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/competitors/history").then((r) => (r.ok ? r.json() : [])),
      ]);
      if (Array.isArray(cs)) setCompetitors(cs);
      if (Array.isArray(ss)) setSnapshots(ss);
    } catch {
      setError("Failed to load metrics.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      await fetch("/api/competitors/refresh", { method: "POST" });
      await load();
    } catch {
      setError("Refresh failed.");
    }
    setRefreshing(false);
  };

  const active = useMemo(() => competitors.filter((c) => !c.hidden), [competitors]);

  // Which platforms actually have data (a live value or any snapshot).
  const platformsWithData = useMemo(() => {
    const set = new Set<Platform>();
    for (const s of snapshots) set.add(s.platform);
    for (const c of active) for (const p of c.platforms) if (p.value != null) set.add(p.platform);
    return set;
  }, [active, snapshots]);
  const platformOptions = PLATFORM_PICK.filter((p) => platformsWithData.has(p));

  const cfg = GRANULARITIES.find((g) => g.key === gran)!;
  const starts = useMemo(() => periodStarts(gran, cfg.periods), [gran, cfg.periods]);
  const labels = useMemo(() => starts.map((s) => periodLabel(gran, s)), [starts, gran]);

  // One row per competitor that has any data for the selected platform.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const c of active) {
      const points = pointsFor(c, platform, snapshots);
      if (points.length === 0) continue;
      const values = periodValues(gran, starts, points);
      const firstIdx = values.findIndex((v) => v != null);
      let lastIdx = -1;
      for (let i = values.length - 1; i >= 0; i--) {
        if (values[i] != null) {
          lastIdx = i;
          break;
        }
      }
      const current = lastIdx >= 0 ? values[lastIdx] : null;
      const first = firstIdx >= 0 ? values[firstIdx] : null;
      const deltaAbs = firstIdx >= 0 && lastIdx > firstIdx ? current! - first! : null;
      const deltaPct = deltaAbs != null && first ? (deltaAbs / first) * 100 : null;
      out.push({
        c,
        values,
        current,
        deltaAbs,
        deltaPct,
        spark: values.filter((v): v is number => v != null),
      });
    }
    return out;
  }, [active, platform, snapshots, gran, starts]);

  // Self / pinned float to the top, then by current value desc.
  const ranked = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          Number(!!b.c.isSelf) - Number(!!a.c.isSelf) ||
          Number(!!b.c.pinned) - Number(!!a.c.pinned) ||
          (b.current ?? -1) - (a.current ?? -1)
      ),
    [rows]
  );

  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    let p = 0;
    for (const r of ranked) map.set(r.c.id, r.c.isSelf ? SELF_COLOR : PALETTE[p++ % PALETTE.length]);
    return map;
  }, [ranked]);

  // Rank of each competitor by current value (1 = largest).
  const rankByValue = useMemo(() => {
    const map = new Map<string, number>();
    [...rows]
      .sort((a, b) => (b.current ?? -1) - (a.current ?? -1))
      .forEach((r, i) => map.set(r.c.id, i + 1));
    return map;
  }, [rows]);

  const unit = PLATFORM_METRIC_UNIT[platform];
  const selfRow = rows.find((r) => r.c.isSelf);
  const topMover = rows
    .filter((r) => r.deltaPct != null)
    .sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))[0];
  const largest = [...rows].sort((a, b) => (b.current ?? -1) - (a.current ?? -1))[0];

  // Details table shows the most recent periods only (chart shows the full window).
  const tableCount = Math.min(8, cfg.periods);
  const tStart = starts.length - tableCount;
  const tableLabels = labels.slice(tStart);

  const chartSeries: TrendSeries[] = ranked.map((r) => ({
    id: r.c.id,
    name: r.c.name,
    color: colorOf.get(r.c.id)!,
    values: r.values,
    emphasized: !!r.c.isSelf || !!r.c.pinned,
  }));

  const exportCsv = () => {
    const head = ["Protocol", ...tableLabels, "Net change", "Net %"];
    const lines = [head.join(",")];
    for (const r of ranked) {
      const cells = r.values.slice(tStart).map((v) => (v == null ? "" : String(v)));
      lines.push(
        [
          `"${r.c.name.replace(/"/g, '""')}"`,
          ...cells,
          r.deltaAbs ?? "",
          r.deltaPct != null ? r.deltaPct.toFixed(1) : "",
        ].join(",")
      );
    }
    downloadCsv(
      `metrics-${platform}-${gran}-${new Date().toISOString().slice(0, 10)}.csv`,
      lines.join("\n")
    );
  };

  const Kpi = ({
    icon: Icon,
    label,
    value,
    sub,
  }: {
    icon: typeof Trophy;
    label: string;
    value: string;
    sub?: ReactNode;
  }) => (
    <div className="rounded-xl border border-makina-border bg-makina-card p-4 hover-lift">
      <div className="flex items-center gap-2 text-makina-muted">
        <Icon size={14} />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 truncate text-2xl font-bold text-makina-text">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs">{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-in-up">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-makina-muted">
              Community & traffic momentum
            </p>
            <h1 className="text-xl font-bold">
              Metrics <span className="gradient-text">Tracker</span>
            </h1>
            <p className="mt-1 text-xs text-makina-muted">
              Where we stand at a glance — expand any section for the period-by-period detail.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg gradient-accent px-4 py-2 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 disabled:opacity-50 btn-tactile"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Capturing…" : "Capture now"}
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-makina-red/20 bg-makina-red/10 px-4 py-2 text-sm text-makina-red">
            {error}
          </div>
        )}

        {/* Controls: platform + granularity */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap rounded-lg border border-makina-border bg-makina-surface p-0.5">
            {(platformOptions.length ? platformOptions : PLATFORM_PICK).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  platform === p ? "bg-makina-card text-makina-text shadow-sm" : "text-makina-muted hover:text-makina-text"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLATFORM_META[p].color }} />
                {PLATFORM_META[p].short}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-makina-border bg-makina-surface p-0.5">
            {GRANULARITIES.map((g) => (
              <button
                key={g.key}
                onClick={() => setGran(g.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  gran === g.key ? "bg-makina-card text-makina-text shadow-sm" : "text-makina-muted hover:text-makina-text"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-makina-subtle">
            {PLATFORM_LABELS[platform]} · {unit}
          </span>
        </div>

        {loading ? (
          <div className="flex h-[60vh] items-center justify-center text-sm text-makina-muted animate-pulse">
            Loading metrics…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-makina-border bg-makina-card p-10 text-center text-sm text-makina-muted">
            No data yet for {PLATFORM_LABELS[platform]}. Hit “Capture now”, or wait for the daily cron — points
            accrue over time.
          </div>
        ) : (
          <>
            {/* ── GLANCE: KPI strip ── */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                icon={Crown}
                label="Makina (us)"
                value={selfRow?.current != null ? formatCount(selfRow.current) : "—"}
                sub={
                  selfRow ? (
                    <span className="flex items-center gap-2">
                      <DeltaTag abs={selfRow.deltaAbs} pct={selfRow.deltaPct} />
                      <span className="text-makina-subtle">
                        #{rankByValue.get(selfRow.c.id)} of {rows.length}
                      </span>
                    </span>
                  ) : (
                    <span className="text-makina-subtle">not tracked for this platform</span>
                  )
                }
              />
              <Kpi
                icon={TrendingUp}
                label={`Top mover · ${cfg.label.toLowerCase()} window`}
                value={topMover ? topMover.c.name : "—"}
                sub={topMover ? <DeltaTag abs={topMover.deltaAbs} pct={topMover.deltaPct} /> : undefined}
              />
              <Kpi
                icon={Trophy}
                label="Largest"
                value={largest ? largest.c.name : "—"}
                sub={
                  largest?.current != null ? (
                    <span className="text-makina-muted">{formatCount(largest.current)} {unit}</span>
                  ) : undefined
                }
              />
              <Kpi icon={TrendingUp} label="Tracked here" value={String(rows.length)} sub={<span className="text-makina-subtle">protocols with data</span>} />
            </div>

            {/* ── GLANCE: per-competitor scorecards ── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ranked.map((r, i) => {
                const accent = r.c.isSelf || r.c.pinned;
                return (
                  <div
                    key={r.c.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border bg-makina-card p-4 hover-lift animate-fade-in-up ${
                      accent ? "border-makina-accent/60 ring-1 ring-makina-accent/20" : "border-makina-border"
                    }`}
                    style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf.get(r.c.id) }} />
                        <span className="truncate text-sm font-bold text-makina-text">{r.c.name}</span>
                        {r.c.isSelf && (
                          <span className="rounded-full bg-makina-accent-dim px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-makina-accent">
                            You
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-makina-text">
                        {r.current != null ? formatCount(r.current) : "—"}
                      </p>
                      <div className="mt-0.5">
                        <DeltaTag abs={r.deltaAbs} pct={r.deltaPct} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] font-medium text-makina-subtle">#{rankByValue.get(r.c.id)}</span>
                      <Sparkline data={r.spark} width={90} height={32} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DETAILS (collapsed by default) ── */}
            <div className="rounded-xl border border-makina-border bg-makina-card animate-fade-in-up">
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-makina-text">
                  Details — trend & period-by-period
                </span>
                <span className="flex items-center gap-2 text-xs text-makina-muted">
                  {showDetails ? "Hide" : "Expand"}
                  <ChevronDown size={16} className={showDetails ? "rotate-180 transition-transform" : "transition-transform"} />
                </span>
              </button>

              {showDetails && (
                <div className="space-y-5 border-t border-makina-border p-4">
                  {/* Trend chart */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-makina-muted">
                        {PLATFORM_LABELS[platform]} · {cfg.label} trend
                      </span>
                      <button
                        onClick={exportCsv}
                        className="inline-flex items-center gap-1.5 rounded-md border border-makina-border bg-makina-surface px-2 py-1 text-[11px] font-medium text-makina-muted transition-colors hover:border-makina-accent/40 hover:text-makina-text"
                      >
                        <Download size={12} />
                        Export CSV
                      </button>
                    </div>
                    <MetricsTrendChart labels={labels} series={chartSeries} />
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {ranked.map((r) => (
                        <span key={r.c.id} className="inline-flex items-center gap-1.5 text-[11px] text-makina-muted">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorOf.get(r.c.id) }} />
                          {r.c.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Period table */}
                  <div className="overflow-x-auto rounded-lg border border-makina-border">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-makina-border">
                          <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-makina-muted">
                            Protocol
                          </th>
                          {tableLabels.map((l, j) => (
                            <th key={j} className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-makina-muted">
                              {l}
                            </th>
                          ))}
                          <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-makina-muted">
                            Net
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranked.map((r) => (
                          <tr key={r.c.id} className={`border-b border-makina-border/50 ${r.c.isSelf || r.c.pinned ? "bg-makina-accent-dim/15" : ""}`}>
                            <td className="px-2 py-2">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorOf.get(r.c.id) }} />
                                <span className="font-semibold text-makina-text">{r.c.name}</span>
                              </span>
                            </td>
                            {r.values.slice(tStart).map((v, j) => {
                              const absIdx = tStart + j;
                              const prev = absIdx > 0 ? r.values[absIdx - 1] : null;
                              const d = v != null && prev != null ? v - prev : null;
                              return (
                                <td key={j} className="px-2 py-2 text-right tabular-nums">
                                  <div className="text-makina-text/90">{v != null ? formatCount(v) : "—"}</div>
                                  {d != null && d !== 0 && (
                                    <div className={`text-[9px] ${d > 0 ? "text-makina-green" : "text-makina-red"}`}>
                                      {d > 0 ? "▲" : "▼"}
                                      {formatCount(Math.abs(d))}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-2 py-2 text-right">
                              <DeltaTag abs={r.deltaAbs} pct={r.deltaPct} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[10px] text-makina-subtle">
                    Values are the reading at each period’s end (carried forward between captures). Data is
                    collected automatically on the daily cron and on “Capture now”. Finer granularities fill in as
                    more points accrue.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function MetricsPage() {
  return (
    <PasswordGate>
      <MetricsInner />
    </PasswordGate>
  );
}

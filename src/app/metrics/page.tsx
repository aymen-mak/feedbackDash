"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import {
  RefreshCw,
  Download,
  ChevronDown,
  TrendingUp,
  Trophy,
  Crown,
  Activity,
  Check,
  Info,
  X as XIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import PasswordGate from "@/components/PasswordGate";
import Sparkline from "@/components/competitors/Sparkline";
import MetricsTrendChart, { type TrendSeries } from "@/components/competitors/MetricsTrendChart";
import { formatCount, signedPct, PLATFORM_META, PLATFORM_SOURCE } from "@/components/competitors/platformMeta";
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

const PLATFORM_PICK: Platform[] = ["twitter", "telegram", "discord", "linkedin", "github", "website"];

const SELF_COLOR = "#5b9cf6";
const PALETTE = [
  "#f59e0b", "#22c55e", "#a78bfa", "#ec4899", "#14b8a6", "#ef4444",
  "#eab308", "#0ea5e9", "#f97316", "#8b5cf6", "#84cc16", "#06b6d4",
];

type SortKey = "value" | "delta" | "name";

interface Row {
  c: Competitor;
  values: (number | null)[];
  current: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
  spark: number[];
}

function DeltaTag({ abs, pct }: { abs: number | null; pct: number | null }) {
  if (abs == null) return <span className="text-makina-subtle">— new</span>;
  const up = abs > 0;
  const flat = abs === 0;
  const cls = flat ? "text-makina-muted" : up ? "text-makina-green" : "text-makina-red";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${cls}`}>
      {flat ? "→" : up ? "▲" : "▼"}
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
  const [normalize, setNormalize] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("value");
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
      out.push({ c, values, current, deltaAbs, deltaPct, spark: values.filter((v): v is number => v != null) });
    }
    return out;
  }, [active, platform, snapshots, gran, starts]);

  // Canonical order (us / pinned first, then by current) — drives chart colors.
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

  const rankByValue = useMemo(() => {
    const map = new Map<string, number>();
    [...rows].sort((a, b) => (b.current ?? -1) - (a.current ?? -1)).forEach((r, i) => map.set(r.c.id, i + 1));
    return map;
  }, [rows]);

  // Keep the chart selection valid as the platform changes; default to us.
  useEffect(() => {
    if (ranked.length === 0) return;
    setSelected((prev) => {
      const valid = new Set([...prev].filter((id) => ranked.some((r) => r.c.id === id)));
      if (valid.size > 0) return valid;
      const self = ranked.find((r) => r.c.isSelf);
      return new Set([self ? self.c.id : ranked[0].c.id]);
    });
  }, [ranked]);

  // Leaderboard order (us pinned to top, then chosen sort).
  const board = useMemo(() => {
    const cmp =
      sortKey === "name"
        ? (a: Row, b: Row) => a.c.name.localeCompare(b.c.name)
        : sortKey === "delta"
        ? (a: Row, b: Row) => (b.deltaPct ?? -Infinity) - (a.deltaPct ?? -Infinity)
        : (a: Row, b: Row) => (b.current ?? -1) - (a.current ?? -1);
    return [...ranked].sort((a, b) => Number(!!b.c.isSelf) - Number(!!a.c.isSelf) || cmp(a, b));
  }, [ranked, sortKey]);

  const unit = PLATFORM_METRIC_UNIT[platform];
  const source = PLATFORM_SOURCE[platform];
  const selfRow = rows.find((r) => r.c.isSelf);
  const movers = rows.filter((r) => r.deltaPct != null);
  const topMover = [...movers].sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))[0];
  const largest = [...rows].sort((a, b) => (b.current ?? -1) - (a.current ?? -1))[0];
  const avgGrowth = movers.length ? movers.reduce((s, r) => s + (r.deltaPct ?? 0), 0) / movers.length : null;

  // % growth: index each series to its first in-window value (0 baseline).
  const toDisplay = (values: (number | null)[]): (number | null)[] => {
    if (!normalize) return values;
    const baseIdx = values.findIndex((v) => v != null);
    if (baseIdx < 0) return values;
    const base = values[baseIdx]!;
    if (!base) return values.map((v) => (v == null ? null : 0));
    return values.map((v) => (v == null ? null : ((v - base) / base) * 100));
  };

  const selectedRows = ranked.filter((r) => selected.has(r.c.id));
  const chartSeries: TrendSeries[] = selectedRows.map((r) => ({
    id: r.c.id,
    name: r.c.name,
    color: colorOf.get(r.c.id)!,
    values: toDisplay(r.values),
    emphasized: !!r.c.isSelf || !!r.c.pinned,
  }));
  const chartMode: "area" | "lines" = selectedRows.length === 1 && !normalize ? "area" : "lines";
  const valueFormat: "count" | "percent" = normalize ? "percent" : "count";

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const solo = (id: string) => setSelected(new Set([id]));
  const selfId = selfRow?.c.id;

  const tableCount = Math.min(8, cfg.periods);
  const tStart = starts.length - tableCount;
  const tableLabels = labels.slice(tStart);

  const exportCsv = () => {
    const head = ["Protocol", ...tableLabels, "Net change", "Net %", "Source"];
    const lines = [head.join(",")];
    for (const r of board) {
      const cells = r.values.slice(tStart).map((v) => (v == null ? "" : String(v)));
      lines.push(
        [
          `"${r.c.name.replace(/"/g, '""')}"`,
          ...cells,
          r.deltaAbs ?? "",
          r.deltaPct != null ? r.deltaPct.toFixed(1) : "",
          `"${source.short}"`,
        ].join(",")
      );
    }
    downloadCsv(`metrics-${platform}-${gran}-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"));
  };

  const Kpi = ({ icon: Icon, label, value, sub }: { icon: typeof Trophy; label: string; value: string; sub?: ReactNode }) => (
    <div className="rounded-xl border border-makina-border bg-makina-card p-4">
      <div className="flex items-center gap-2 text-makina-muted">
        <Icon size={14} />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1.5 truncate text-2xl font-bold text-makina-text">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs">{sub}</p>}
    </div>
  );

  const SortTh = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`px-3 py-2 ${right ? "text-right" : "text-left"}`}>
      <button
        onClick={() => setSortKey(k)}
        className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${
          sortKey === k ? "text-makina-text" : "text-makina-muted hover:text-makina-text"
        }`}
      >
        {label}
        {sortKey === k && " ↓"}
      </button>
    </th>
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 animate-fade-in-up">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-makina-muted">Competitive analytics</p>
            <h1 className="text-xl font-bold">
              Metrics <span className="gradient-text">Tracker</span>
            </h1>
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
          <div className="mb-4 rounded-md border border-makina-red/20 bg-makina-red/10 px-4 py-2 text-sm text-makina-red">
            {error}
          </div>
        )}

        {/* Sticky control bar: metric · timeframe · view mode */}
        <div className="sticky top-14 z-30 -mx-4 mb-5 border-y border-makina-border bg-makina-bg/95 px-4 py-3 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(platformOptions.length ? platformOptions : PLATFORM_PICK).map((p) => {
                const on = platform === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-all ${
                      on
                        ? "border-transparent text-white shadow-sm"
                        : "border-makina-border bg-makina-surface text-makina-muted hover:border-makina-accent/40 hover:text-makina-text"
                    }`}
                    style={on ? { backgroundColor: PLATFORM_META[p].color } : undefined}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: on ? "rgba(255,255,255,0.95)" : PLATFORM_META[p].color }}
                    />
                    {PLATFORM_META[p].short}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-makina-border bg-makina-surface p-1">
                {GRANULARITIES.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setGran(g.key)}
                    title={g.label}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold tabular-nums transition-all ${
                      gran === g.key ? "bg-makina-accent text-makina-bg shadow-sm" : "text-makina-muted hover:bg-makina-card hover:text-makina-text"
                    }`}
                  >
                    {g.short}
                  </button>
                ))}
              </div>
              <div className="inline-flex rounded-lg border border-makina-border bg-makina-surface p-1">
                {[
                  { k: false, label: "Abs" },
                  { k: true, label: "% growth" },
                ].map((m) => (
                  <button
                    key={String(m.k)}
                    onClick={() => setNormalize(m.k)}
                    title={m.k ? "Index each series to its window start — compare growth across sizes" : "Absolute values"}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                      normalize === m.k ? "bg-makina-accent text-makina-bg shadow-sm" : "text-makina-muted hover:bg-makina-card hover:text-makina-text"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <span
                title={source.detail}
                className="hidden items-center gap-1.5 rounded-lg border border-makina-border bg-makina-surface px-3 py-1.5 text-[11px] text-makina-muted sm:inline-flex"
              >
                <Info size={12} className="text-makina-subtle" />
                {source.short}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-[60vh] items-center justify-center text-sm text-makina-muted animate-pulse">
            Loading metrics…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-makina-border bg-makina-card p-10 text-center text-sm text-makina-muted">
            No data yet for {PLATFORM_LABELS[platform]}. Hit “Capture now”, or wait for the daily cron — points accrue over time.
          </div>
        ) : (
          <div className="space-y-5">
            {/* KPI strip — the at-a-glance read */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                icon={Crown}
                label="Makina (us)"
                value={selfRow?.current != null ? formatCount(selfRow.current) : "—"}
                sub={
                  selfRow ? (
                    <span className="flex items-center gap-2">
                      <DeltaTag abs={selfRow.deltaAbs} pct={selfRow.deltaPct} />
                      <span className="text-makina-subtle">#{rankByValue.get(selfRow.c.id)} of {rows.length}</span>
                    </span>
                  ) : (
                    <span className="text-makina-subtle">not tracked here</span>
                  )
                }
              />
              <Kpi
                icon={TrendingUp}
                label={`Top mover · ${cfg.short}`}
                value={topMover ? topMover.c.name : "—"}
                sub={topMover ? <DeltaTag abs={topMover.deltaAbs} pct={topMover.deltaPct} /> : undefined}
              />
              <Kpi
                icon={Trophy}
                label="Largest"
                value={largest ? largest.c.name : "—"}
                sub={largest?.current != null ? <span className="text-makina-muted">{formatCount(largest.current)} {unit}</span> : undefined}
              />
              <Kpi
                icon={Activity}
                label={`Field momentum · ${cfg.short}`}
                value={avgGrowth != null ? signedPct(avgGrowth) : "—"}
                sub={<span className="text-makina-subtle">avg across {movers.length || 0} tracked</span>}
              />
            </div>

            {/* Chart card */}
            <div className="rounded-xl border border-makina-border bg-makina-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-semibold text-makina-text">{PLATFORM_LABELS[platform]}</span>
                  <span className="text-makina-muted"> · {cfg.label} · {normalize ? "% change from start" : unit}</span>
                  <span className="ml-2 text-[11px] text-makina-subtle" title={source.detail}>via {source.short}</span>
                </div>
              </div>
              <MetricsTrendChart labels={labels} series={chartSeries} mode={chartMode} valueFormat={valueFormat} />
              {/* Plotted legend with quick-remove */}
              {chartSeries.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {chartSeries.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggle(s.id)}
                      title="Remove from chart"
                      className="inline-flex items-center gap-1.5 rounded-full border border-makina-border bg-makina-surface px-2.5 py-1 text-[11px] font-medium text-makina-text/80 transition-colors hover:border-makina-red/40 hover:text-makina-text"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                      <XIcon size={11} className="text-makina-subtle" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Watchlist / leaderboard — selector + glance in one */}
            <div className="rounded-xl border border-makina-border bg-makina-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-makina-border px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs text-makina-muted">
                  <span className="font-semibold text-makina-text">Comparing {selected.size}</span>
                  <span className="text-makina-subtle">· tick to compare, click a name to solo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setSelected(new Set(ranked.map((r) => r.c.id)))} className="rounded-md border border-makina-border px-2 py-1 text-[11px] font-medium text-makina-muted transition-colors hover:text-makina-text">All</button>
                  <button onClick={() => setSelected(new Set())} className="rounded-md border border-makina-border px-2 py-1 text-[11px] font-medium text-makina-muted transition-colors hover:text-makina-text">Clear</button>
                  {selfId && (
                    <button onClick={() => setSelected(new Set([selfId]))} className="rounded-md border border-makina-border px-2 py-1 text-[11px] font-medium text-makina-muted transition-colors hover:text-makina-text">Us only</button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-makina-border">
                      <th className="w-8 px-3 py-2" />
                      <SortTh k="name" label="Protocol" />
                      <SortTh k="value" label={unit} right />
                      <SortTh k="delta" label={`Δ ${cfg.short}`} right />
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-makina-muted">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.map((r) => {
                      const on = selected.has(r.c.id);
                      return (
                        <tr key={r.c.id} className={`border-b border-makina-border/50 transition-colors hover:bg-makina-surface/40 ${r.c.isSelf || r.c.pinned ? "bg-makina-accent-dim/10" : ""}`}>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => toggle(r.c.id)}
                              title={on ? "Remove from chart" : "Add to chart"}
                              className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                                on ? "border-makina-accent bg-makina-accent text-makina-bg" : "border-makina-border hover:border-makina-accent/50"
                              }`}
                            >
                              {on && <Check size={11} />}
                            </button>
                          </td>
                          <td className="px-3 py-2.5">
                            <button onClick={() => solo(r.c.id)} className="flex items-center gap-2 text-left" title="View solo">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf.get(r.c.id) }} />
                              <span className="font-semibold text-makina-text hover:text-makina-accent">{r.c.name}</span>
                              {r.c.isSelf && (
                                <span className="rounded-full bg-makina-accent-dim px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-makina-accent">You</span>
                              )}
                              <span className="text-[10px] text-makina-subtle">#{rankByValue.get(r.c.id)}</span>
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-makina-text">
                            {r.current != null ? formatCount(r.current) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <DeltaTag abs={r.deltaAbs} pct={r.deltaPct} />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end">
                              <Sparkline data={r.spark} width={88} height={26} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Details: period-by-period grid + export */}
            <div className="rounded-xl border border-makina-border bg-makina-card">
              <button onClick={() => setShowDetails((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
                <span className="text-sm font-semibold text-makina-text">Period-by-period detail</span>
                <span className="flex items-center gap-2 text-xs text-makina-muted">
                  {showDetails ? "Hide" : "Expand"}
                  <ChevronDown size={16} className={showDetails ? "rotate-180 transition-transform" : "transition-transform"} />
                </span>
              </button>
              {showDetails && (
                <div className="space-y-3 border-t border-makina-border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-makina-subtle">
                      Reading at each period’s end (carried forward between captures) · {PLATFORM_LABELS[platform]} via {source.short}
                    </span>
                    <button
                      onClick={exportCsv}
                      className="inline-flex items-center gap-1.5 rounded-md border border-makina-border bg-makina-surface px-2.5 py-1 text-[11px] font-medium text-makina-muted transition-colors hover:border-makina-accent/40 hover:text-makina-text"
                    >
                      <Download size={12} />
                      Export CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-makina-border">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-makina-border">
                          <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-makina-muted">Protocol</th>
                          {tableLabels.map((l, j) => (
                            <th key={j} className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-makina-muted">{l}</th>
                          ))}
                          <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-makina-muted">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {board.map((r) => (
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
                                      {d > 0 ? "▲" : "▼"}{formatCount(Math.abs(d))}
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
                </div>
              )}
            </div>
          </div>
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

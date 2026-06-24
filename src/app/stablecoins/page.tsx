"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Search, AlertTriangle, ShieldCheck, ArrowUp, ArrowDown } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PageLoader, Spinner } from "@/components/Spinner";
import { useLoadingBar } from "@/components/LoadingBar";
import { formatUsd, timeAgo } from "@/components/competitors/platformMeta";
import {
  type StablecoinReport,
  type StablecoinRow,
  type DepegStatus,
  DEPEG_THRESHOLD,
} from "@/lib/stablecoins/types";

const STATUS_META: Record<DepegStatus, { label: string; color: string }> = {
  depegged: { label: "Depegged", color: "#ef4444" },
  watch: { label: "Watch", color: "#f59e0b" },
  "on-peg": { label: "On peg", color: "#22c55e" },
  variable: { label: "Variable", color: "#a78bfa" },
  unknown: { label: "No price", color: "#64748b" },
};

const MECH_COLOR: Record<string, string> = {
  "Fiat-backed": "#5b9cf6",
  "Crypto-backed": "#a78bfa",
  Algorithmic: "#f59e0b",
};

type SortKey = "deviation" | "mcap" | "name";
type StatusFilter = "all" | "offpeg" | "onpeg" | "variable";

function fmtPrice(p: number | null): string {
  if (p == null) return "—";
  if (p >= 100) return "$" + p.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (p >= 1) return "$" + p.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return "$" + p.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function fmtDev(d: number | null): string {
  if (d == null) return "—";
  const pct = d * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function DeviationCell({ row }: { row: StablecoinRow }) {
  const { deviation, status } = row;
  if (deviation == null) return <span className="text-makina-subtle">—</span>;
  const color = STATUS_META[status].color;
  const up = deviation >= 0;
  // Bar fills toward 3% (1.5× the depeg threshold) = full width.
  const pct = Math.min(1, Math.abs(deviation) / (DEPEG_THRESHOLD * 1.5)) * 100;
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums" style={{ color }}>
        {Math.abs(deviation) < 0.0005 ? null : up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
        {fmtDev(deviation)}
      </span>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-makina-surface">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: DepegStatus }) {
  const { label, color } = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function StablecoinsInner() {
  const [data, setData] = useState<StablecoinReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("deviation");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { start: lbStart, done: lbDone } = useLoadingBar();

  const load = useCallback(
    async (manual = false) => {
      if (manual) {
        setRefreshing(true);
        lbStart();
      }
      try {
        const r = (await fetch("/api/stablecoins").then((res) => (res.ok ? res.json() : null))) as
          | (StablecoinReport & { error?: string })
          | null;
        if (r && Array.isArray(r.assets)) {
          setData(r);
          setError("");
        } else {
          setError(r?.error || "Failed to load stablecoins.");
        }
      } catch {
        setError("Failed to load stablecoins.");
      }
      setLoading(false);
      if (manual) {
        lbDone();
        setRefreshing(false);
      }
    },
    [lbStart, lbDone]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(), 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const source = showAll ? data.assets : data.assets.filter((a) => a.significant);
    const filtered = source.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q) && !a.symbol.toLowerCase().includes(q)) return false;
      if (statusFilter === "offpeg") return a.status === "depegged" || a.status === "watch";
      if (statusFilter === "onpeg") return a.status === "on-peg";
      if (statusFilter === "variable") return a.status === "variable";
      return true;
    });
    const dev = (a: StablecoinRow) => (a.deviation == null ? -1 : Math.abs(a.deviation));
    filtered.sort((a, b) => {
      if (sortKey === "name") return a.symbol.localeCompare(b.symbol);
      if (sortKey === "mcap") return (b.mcap ?? 0) - (a.mcap ?? 0);
      return dev(b) - dev(a);
    });
    return filtered;
  }, [data, query, statusFilter, sortKey, showAll]);

  const s = data?.summary;
  const tiles = s
    ? [
        { label: "Monitored", value: String(s.total), color: undefined },
        { label: "Depegged", value: String(s.depegged), color: s.depegged > 0 ? "#ef4444" : undefined },
        { label: "Watching", value: String(s.watch), color: s.watch > 0 ? "#f59e0b" : undefined },
        { label: "On peg", value: String(s.onPeg), color: "#22c55e" },
        { label: "Total market cap", value: s.totalMcap > 0 ? formatUsd(s.totalMcap) : "—", color: undefined },
      ]
    : [];

  // Headline banner: lead with the worst news.
  const banner = (() => {
    if (!s) return null;
    if (s.depegged > 0) {
      const names = s.worst.filter((w) => Math.abs(w.deviation) > DEPEG_THRESHOLD).slice(0, 4);
      return {
        tone: "#ef4444",
        icon: AlertTriangle,
        text: `${s.depegged} stablecoin${s.depegged > 1 ? "s" : ""} off peg right now`,
        detail: names.map((w) => `${w.symbol} ${fmtDev(w.deviation)}`).join(" · "),
      };
    }
    if (s.watch > 0) {
      return {
        tone: "#f59e0b",
        icon: AlertTriangle,
        text: `All majors holding — ${s.watch} wobbling within 0.5–2%`,
        detail: s.worst.slice(0, 4).map((w) => `${w.symbol} ${fmtDev(w.deviation)}`).join(" · "),
      };
    }
    return {
      tone: "#22c55e",
      icon: ShieldCheck,
      text: `All ${s.total} tracked stablecoins on peg`,
      detail: s.worst[0] ? `Widest move: ${s.worst[0].symbol} ${fmtDev(s.worst[0].deviation)}` : "",
    };
  })();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-in-up">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-makina-muted">Risk monitor</p>
            <h1 className="text-xl font-bold">
              Stablecoin <span className="gradient-text">Depeg</span> Monitor
            </h1>
            <p className="mt-1 text-xs text-makina-muted">
              Peg status across {data ? data.summary.total : "200+"} monitored stablecoins
              {data ? ` (of ${data.summary.catalog})` : ""} · DefiLlama · last data {timeAgo(data?.at)}
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg gradient-accent px-4 py-2 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 disabled:opacity-50 btn-tactile"
          >
            {refreshing ? <Spinner size={14} /> : <RefreshCw size={14} />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-makina-red/20 bg-makina-red/10 px-4 py-2 text-sm text-makina-red">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <PageLoader label="Loading stablecoins…" />
          </div>
        ) : (
          <>
            {/* Headline banner */}
            {banner && (
              <div
                className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 animate-fade-in-up"
                style={{ borderColor: `${banner.tone}40`, backgroundColor: `${banner.tone}0d` }}
              >
                <banner.icon size={18} style={{ color: banner.tone }} />
                <span className="text-sm font-semibold" style={{ color: banner.tone }}>
                  {banner.text}
                </span>
                {banner.detail && <span className="text-xs text-makina-muted">{banner.detail}</span>}
              </div>
            )}

            {/* Summary tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {tiles.map((t, i) => (
                <div
                  key={t.label}
                  className="rounded-xl border border-makina-border bg-makina-card p-4 hover-lift animate-fade-in-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <p className="text-[11px] font-medium uppercase tracking-wider text-makina-muted">{t.label}</p>
                  <p className="mt-2 truncate text-2xl font-bold tabular-nums" style={{ color: t.color ?? "var(--color-makina-text)" }}>
                    {t.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-makina-subtle" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or symbol…"
                  className="w-64 rounded-lg border border-makina-border bg-makina-surface py-2 pl-9 pr-3 text-sm text-makina-text placeholder:text-makina-subtle focus:border-makina-accent/40 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-makina-border bg-makina-surface p-0.5">
                  {(
                    [
                      ["all", "All"],
                      ["offpeg", "Off peg"],
                      ["onpeg", "On peg"],
                      ["variable", "Variable"],
                    ] as [StatusFilter, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setStatusFilter(v)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                        statusFilter === v ? "bg-makina-card text-makina-text shadow-sm" : "text-makina-muted hover:text-makina-text"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="rounded-lg border border-makina-border bg-makina-surface px-3 py-1.5 text-xs font-medium text-makina-muted focus:border-makina-accent/40 focus:outline-none"
                >
                  <option value="deviation">Sort: biggest deviation</option>
                  <option value="mcap">Sort: market cap</option>
                  <option value="name">Sort: symbol A–Z</option>
                </select>
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    showAll
                      ? "border-makina-accent/40 bg-makina-accent-dim text-makina-accent"
                      : "border-makina-border text-makina-muted hover:text-makina-text"
                  }`}
                  title="Include stablecoins below the $10M monitoring threshold"
                >
                  {showAll
                    ? `Showing all ${data?.summary.catalog ?? ""}`
                    : `Show all${data && data.summary.hidden ? ` (+${data.summary.hidden})` : ""}`}
                </button>
                <button
                  onClick={() => setAutoRefresh((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    autoRefresh ? "border-makina-green/40 bg-makina-green/5 text-makina-green" : "border-makina-border text-makina-muted hover:text-makina-text"
                  }`}
                  title="Re-check every 60s"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-makina-green animate-pulse-live" : "bg-makina-subtle"}`} />
                  {autoRefresh ? "Live" : "Auto-refresh off"}
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-makina-border bg-makina-card animate-fade-in-up">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-makina-border text-[10px] font-semibold uppercase tracking-wider text-makina-muted">
                    <th className="px-3 py-2.5 text-left">Stablecoin</th>
                    <th className="px-3 py-2.5 text-left">Peg</th>
                    <th className="px-3 py-2.5 text-right">Price</th>
                    <th className="px-3 py-2.5 text-right">Deviation</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-right">Market cap</th>
                    <th className="px-3 py-2.5 text-right">Chains</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr
                      key={a.id}
                      className={`border-b border-makina-border/50 transition-colors hover:bg-makina-surface/50 ${
                        a.status === "depegged" ? "bg-makina-red/[0.05]" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-makina-text">{a.symbol}</span>
                          <span className="truncate text-[11px] text-makina-subtle">{a.name}</span>
                        </div>
                        {a.mechanism !== "—" && (
                          <span
                            className="mt-0.5 inline-block rounded px-1 py-px text-[9px] font-medium"
                            style={{
                              color: MECH_COLOR[a.mechanism] ?? "#8d9bad",
                              backgroundColor: `${MECH_COLOR[a.mechanism] ?? "#8d9bad"}1a`,
                            }}
                          >
                            {a.mechanism}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-medium text-makina-muted">{a.pegLabel}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-makina-text/90">{fmtPrice(a.price)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end">
                          <DeviationCell row={a} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-center">
                          <StatusPill status={a.status} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-makina-muted">
                        {a.mcap != null && a.mcap > 0 ? formatUsd(a.mcap) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-xs tabular-nums text-makina-subtle" title={a.chains.join(", ")}>
                          {a.chains.length || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-makina-muted">
                        No stablecoins match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="px-1 text-[10px] leading-relaxed text-makina-subtle">
              Monitoring stablecoins with at least $10M market cap
              {data && data.summary.hidden ? `; ${data.summary.hidden} smaller / inactive ones hidden (use “Show all”)` : ""}.
              Peg status from DefiLlama prices. USD pegs are measured against $1; other fiat pegs against the median
              price of their peg group (no FX feed needed). On peg ≤ 0.5% · Watch 0.5–2% · Depegged &gt; 2%.
              Variable-peg assets (e.g. floating or algorithmic) are shown but not flagged.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

export default function StablecoinsPage() {
  return <StablecoinsInner />;
}

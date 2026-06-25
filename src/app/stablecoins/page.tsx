"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Search, AlertTriangle, ShieldCheck, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PageLoader, Spinner } from "@/components/Spinner";
import { useLoadingBar } from "@/components/LoadingBar";
import { formatUsd, timeAgo } from "@/lib/format";
import { type StablecoinReport, type StablecoinRow, type DepegStatus } from "@/lib/stablecoins/types";

const STATUS_META: Record<DepegStatus, { label: string; color: string }> = {
  "depegged-below": { label: "Below peg", color: "#ef4444" },
  "depegged-above": { label: "Above peg", color: "#22d3ee" },
  watch: { label: "Watch", color: "#f59e0b" },
  "on-peg": { label: "On peg", color: "#22c55e" },
  variable: { label: "Variable", color: "#a78bfa" },
  unknown: { label: "No price", color: "#64748b" },
};

const SEV_RANK: Record<string, number> = { "depegged-below": 0, "depegged-above": 1, watch: 2 };
const MAX_DEV = 0.03;
const isAttention = (s: DepegStatus) => s === "depegged-below" || s === "depegged-above" || s === "watch";

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

function Gauge({ deviation, color }: { deviation: number | null; color: string }) {
  const pos = deviation == null ? 50 : 50 + (Math.max(-MAX_DEV, Math.min(MAX_DEV, deviation)) / MAX_DEV) * 50;
  return (
    <div className="relative mt-3 h-1.5 w-full rounded-full bg-makina-surface">
      <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-makina-subtle/60" />
      {deviation != null && (
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-makina-card"
          style={{ left: `${pos}%`, backgroundColor: color }}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: DepegStatus }) {
  const { label, color } = STATUS_META[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function KindTag({ a }: { a: StablecoinRow }) {
  if (a.category === "base") return null;
  return (
    <span className="shrink-0 rounded bg-makina-surface px-1 py-px text-[9px] font-medium uppercase tracking-wide text-makina-subtle">
      {a.category === "staked" ? "staked" : "wrapped"}
      {a.underlying ? ` · ${a.underlying}` : ""}
    </span>
  );
}

function AttentionCard({ a }: { a: StablecoinRow }) {
  const m = STATUS_META[a.status];
  const up = (a.deviation ?? 0) >= 0;
  return (
    <div className="rounded-xl border bg-makina-card p-4 transition-colors hover:bg-makina-card-hover" style={{ borderColor: `${m.color}40` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-makina-text">{a.symbol}</span>
            <KindTag a={a} />
          </div>
          <div className="truncate text-[11px] text-makina-subtle">{a.name}</div>
        </div>
        <StatusPill status={a.status} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-lg font-bold tabular-nums text-makina-text">{fmtPrice(a.price)}</div>
          <div className="text-[10px] uppercase tracking-wider text-makina-subtle">
            {a.yieldBearing ? `tracks ${a.underlying} peg` : `price · ${a.pegLabel} peg`}
          </div>
        </div>
        <div className="inline-flex items-center gap-1 text-lg font-bold tabular-nums" style={{ color: m.color }}>
          {up ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          {fmtDev(a.deviation)}
        </div>
      </div>
      <Gauge deviation={a.deviation} color={m.color} />
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-makina-subtle">
        <span className="tabular-nums">{a.mcap && a.mcap > 0 ? `${formatUsd(a.mcap)} mcap` : a.yieldBearing ? "yield-bearing" : "—"}</span>
        <span className="truncate">
          {a.mechanism !== "—" ? a.mechanism : ""}
          {a.chains.length ? ` · ${a.chains.length} chain${a.chains.length > 1 ? "s" : ""}` : ""}
        </span>
      </div>
    </div>
  );
}

function Chip({ a }: { a: StablecoinRow }) {
  const m = STATUS_META[a.status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-makina-border bg-makina-surface px-2 py-1 text-[11px]"
      title={`${a.name}${a.underlying ? ` · tracks ${a.underlying}` : ""} · ${fmtPrice(a.price)}${a.mcap ? ` · ${formatUsd(a.mcap)} mcap` : ""}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
      <span className="font-semibold text-makina-text/90">{a.symbol}</span>
      {a.category !== "base" && a.underlying && <span className="text-makina-subtle">↳{a.underlying}</span>}
      <span className="tabular-nums text-makina-subtle">{fmtDev(a.deviation)}</span>
    </span>
  );
}

function HealthBar({ s }: { s: StablecoinReport["summary"] }) {
  const segs = [
    { key: "depegged-below" as DepegStatus, n: s.depeggedBelow },
    { key: "watch" as DepegStatus, n: s.watch },
    { key: "on-peg" as DepegStatus, n: s.onPeg },
    { key: "depegged-above" as DepegStatus, n: s.depeggedAbove },
    { key: "variable" as DepegStatus, n: s.variable },
    { key: "unknown" as DepegStatus, n: s.noPrice },
  ];
  const total = Math.max(1, segs.reduce((acc, x) => acc + x.n, 0));
  return (
    <div className="rounded-xl border border-makina-border bg-makina-card p-5 animate-fade-in-up">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-makina-muted">Peg health · {s.total} monitored</p>
        <p className="text-[11px] text-makina-subtle">{s.totalMcap > 0 ? `${formatUsd(s.totalMcap)} total market cap` : ""}</p>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-makina-surface">
        {segs.filter((x) => x.n > 0).map((x) => (
          <div key={x.key} title={`${x.n} ${STATUS_META[x.key].label}`} style={{ width: `${(x.n / total) * 100}%`, minWidth: 4, backgroundColor: STATUS_META[x.key].color }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segs.map((x) => (
          <span key={x.key} className={`inline-flex items-center gap-1.5 text-[11px] ${x.n > 0 ? "text-makina-muted" : "text-makina-subtle/40"}`}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[x.key].color }} />
            {STATUS_META[x.key].label} <span className="tabular-nums font-semibold text-makina-text">{x.n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Collapsible({ label, color, items, defaultOpen }: { label: string; color: string; items: StablecoinRow[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const show = open || defaultOpen;
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-makina-border bg-makina-card animate-fade-in-up">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-makina-text">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          {label} <span className="font-normal text-makina-subtle">({items.length})</span>
        </span>
        <ChevronDown size={16} className={`text-makina-muted transition-transform ${show ? "rotate-180" : ""}`} />
      </button>
      {show && (
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {items.map((a) => (
            <Chip key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function StablecoinsInner() {
  const [data, setData] = useState<StablecoinReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<"focus" | "all">("focus");
  const [autoRefresh, setAutoRefresh] = useState(false);
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

  const q = query.trim().toLowerCase();
  const { attention, onPeg, staked, other, baseAll, derivAll } = useMemo(() => {
    const empty = { attention: [], onPeg: [], staked: [], other: [], baseAll: [], derivAll: [] };
    if (!data) return empty as Record<string, StablecoinRow[]>;
    const visible = (showAll ? data.assets : data.assets.filter((a) => a.significant)).filter(
      (a) => !q || a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q) || (a.underlying ?? "").toLowerCase().includes(q)
    );
    const byDev = (a: StablecoinRow, b: StablecoinRow) => Math.abs(b.deviation ?? 0) - Math.abs(a.deviation ?? 0);
    const byMcap = (a: StablecoinRow, b: StablecoinRow) => (b.mcap ?? 0) - (a.mcap ?? 0);
    return {
      attention: visible
        .filter((a) => isAttention(a.status))
        .sort((a, b) => SEV_RANK[a.status] - SEV_RANK[b.status] || byDev(a, b)),
      onPeg: visible.filter((a) => a.category === "base" && a.status === "on-peg").sort(byMcap),
      staked: visible.filter((a) => a.category !== "base" && !isAttention(a.status)).sort((a, b) => a.symbol.localeCompare(b.symbol)),
      other: visible.filter((a) => a.category === "base" && (a.status === "variable" || a.status === "unknown")).sort(byMcap),
      baseAll: visible.filter((a) => a.category === "base").sort(byDev),
      derivAll: visible.filter((a) => a.category !== "base").sort((a, b) => a.symbol.localeCompare(b.symbol)),
    };
  }, [data, q, showAll]);

  const s = data?.summary;
  const banner = (() => {
    if (!s) return null;
    if (s.depeggedBelow > 0)
      return {
        tone: "#ef4444",
        Icon: AlertTriangle,
        text: `${s.depeggedBelow} stablecoin${s.depeggedBelow > 1 ? "s" : ""} trading below peg`,
        detail:
          s.worst.filter((w) => w.deviation < 0).slice(0, 4).map((w) => `${w.symbol} ${fmtDev(w.deviation)}`).join(" · ") +
          (s.depeggedAbove > 0 ? `  ·  +${s.depeggedAbove} above` : ""),
      };
    if (s.depeggedAbove > 0)
      return {
        tone: "#22d3ee",
        Icon: AlertTriangle,
        text: `${s.depeggedAbove} stablecoin${s.depeggedAbove > 1 ? "s" : ""} trading above peg (premium)`,
        detail: s.worst.filter((w) => w.deviation > 0).slice(0, 4).map((w) => `${w.symbol} ${fmtDev(w.deviation)}`).join(" · "),
      };
    if (s.watch > 0)
      return {
        tone: "#f59e0b",
        Icon: AlertTriangle,
        text: `All majors holding — ${s.watch} wobbling within 0.5–2%`,
        detail: s.worst.slice(0, 4).map((w) => `${w.symbol} ${fmtDev(w.deviation)}`).join(" · "),
      };
    return {
      tone: "#22c55e",
      Icon: ShieldCheck,
      text: `All ${s.total} monitored stablecoins on peg`,
      detail: s.worst[0] ? `Widest move: ${s.worst[0].symbol} ${fmtDev(s.worst[0].deviation)}` : "",
    };
  })();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-in-up">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-makina-muted">Risk monitor</p>
            <h1 className="text-xl font-bold">
              Stablecoin <span className="gradient-text">Depeg</span> Monitor
            </h1>
            <p className="mt-1 text-xs text-makina-muted">
              {data ? `${data.summary.total} monitored · ${data.summary.derivatives} staked/wrapped · ${data.summary.catalog} tracked` : "200+ stablecoins"} · DefiLlama · last data {timeAgo(data?.at)}
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

        {error && <div className="rounded-md border border-makina-red/20 bg-makina-red/10 px-4 py-2 text-sm text-makina-red">{error}</div>}

        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <PageLoader label="Loading stablecoins…" />
          </div>
        ) : (
          <>
            {banner && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 animate-fade-in-up" style={{ borderColor: `${banner.tone}40`, backgroundColor: `${banner.tone}0d` }}>
                <banner.Icon size={18} style={{ color: banner.tone }} />
                <span className="text-sm font-semibold" style={{ color: banner.tone }}>{banner.text}</span>
                {banner.detail && <span className="text-xs text-makina-muted">{banner.detail}</span>}
              </div>
            )}

            {s && <HealthBar s={s} />}

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-makina-subtle" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search name, symbol, underlying…"
                    className="w-64 rounded-lg border border-makina-border bg-makina-surface py-2 pl-9 pr-3 text-sm text-makina-text placeholder:text-makina-subtle focus:border-makina-accent/40 focus:outline-none"
                  />
                </div>
                <div className="inline-flex rounded-lg border border-makina-border bg-makina-surface p-0.5">
                  {(["focus", "all"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${view === v ? "bg-makina-card text-makina-text shadow-sm" : "text-makina-muted hover:text-makina-text"}`}
                      title={v === "focus" ? "Only what needs attention" : "Browse the full list"}
                    >
                      {v === "focus" ? "Focus" : "Browse all"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${showAll ? "border-makina-accent/40 bg-makina-accent-dim text-makina-accent" : "border-makina-border text-makina-muted hover:text-makina-text"}`}
                  title="Include base stablecoins below the $10M monitoring threshold"
                >
                  {showAll ? `Incl. small caps` : `Show small caps${data && data.summary.hidden ? ` (+${data.summary.hidden})` : ""}`}
                </button>
                <button
                  onClick={() => setAutoRefresh((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${autoRefresh ? "border-makina-green/40 bg-makina-green/5 text-makina-green" : "border-makina-border text-makina-muted hover:text-makina-text"}`}
                  title="Re-check every 60s"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-makina-green animate-pulse-live" : "bg-makina-subtle"}`} />
                  {autoRefresh ? "Live" : "Auto-refresh off"}
                </button>
              </div>
            </div>

            {view === "all" ? (
              <div className="space-y-5">
                {([["Base stablecoins", baseAll], ["Staked & wrapped", derivAll]] as [string, StablecoinRow[]][]).map(
                  ([label, items]) =>
                    items.length > 0 && (
                      <div key={label} className="animate-fade-in-up">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-makina-muted">
                          {label} <span className="text-makina-subtle">· {items.length}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {items.map((a) => (
                            <Chip key={a.id} a={a} />
                          ))}
                        </div>
                      </div>
                    )
                )}
                {baseAll.length === 0 && derivAll.length === 0 && (
                  <p className="py-8 text-center text-sm text-makina-muted">No matches.</p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-makina-muted">
                    Needs attention {attention.length > 0 && <span className="text-makina-subtle">· {attention.length}</span>}
                  </p>
                  {attention.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-xl border border-makina-green/30 bg-makina-green/[0.06] px-4 py-5">
                      <ShieldCheck size={18} className="text-makina-green" />
                      <span className="text-sm font-medium text-makina-green">
                        {q ? "No off-peg matches." : "Nothing off peg — every monitored stablecoin is holding."}
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {attention.map((a) => (
                        <AttentionCard key={a.id} a={a} />
                      ))}
                    </div>
                  )}
                </div>

                <Collapsible label="Staked & wrapped" color="#a78bfa" items={staked} defaultOpen={!!q} />
                <Collapsible label="On peg" color="#22c55e" items={onPeg} defaultOpen={!!q} />
                <Collapsible label="Variable & unrated" color="#64748b" items={other} defaultOpen={!!q} />
              </>
            )}

            <p className="px-1 text-[10px] leading-relaxed text-makina-subtle">
              Base stablecoins from DefiLlama (≥ $10M market cap monitored; toggle to include smaller).
              Staked/wrapped derivatives (sUSDe, sDAI, …) are curated and priced via the DefiLlama coins API — yield-bearing
              wrappers appreciate vs their underlying, so their peg risk is inherited from the underlying rather than measured
              against $1. USD pegs vs $1, other fiat pegs vs their group median. On peg ≤ 0.5% · Watch 0.5–2% · Below / Above peg &gt; 2%.
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

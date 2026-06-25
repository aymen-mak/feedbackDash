"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Search, AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PageLoader, Spinner } from "@/components/Spinner";
import { useLoadingBar } from "@/components/LoadingBar";
import { formatUsd, timeAgo } from "@/lib/format";
import { SEVERITY_COLOR, SEVERITY_RANK, type Severity } from "@/lib/risk/severity";
import { PROTOCOL_CATEGORIES, type ProtocolCategory } from "@/lib/protocols/watchlist";
import { type ProtocolReport, type ProtocolHealth, type ProtocolBrief } from "@/lib/protocols/types";

const SEV_LABEL: Record<Severity, string> = { ok: "Stable", info: "Unknown", warn: "Outflows", critical: "Sharp drop" };

/** Color a TVL change by direction/magnitude (a drop is the concern). */
function deltaColor(v: number | null): string {
  if (v == null) return "#8d9bad";
  if (v <= -3) return "#ef4444";
  if (v < 0) return "#f59e0b";
  if (v >= 3) return "#22c55e";
  return "#8d9bad";
}

function DeltaPct({ label, v }: { label: string; v: number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium uppercase tracking-wider text-makina-subtle">{label}</span>
      <span className="text-xs font-semibold tabular-nums" style={{ color: deltaColor(v) }}>
        {v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
      </span>
    </div>
  );
}

function SeverityPill({ severity }: { severity: Severity }) {
  const color = SEVERITY_COLOR[severity];
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${color}1f`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {SEV_LABEL[severity]}
    </span>
  );
}

function ProtocolCard({ p }: { p: ProtocolHealth }) {
  const color = SEVERITY_COLOR[p.severity];
  const flagged = p.severity === "warn" || p.severity === "critical";
  return (
    <div
      className="rounded-xl border bg-makina-card p-4 transition-colors hover:bg-makina-card-hover"
      style={{ borderColor: flagged ? `${color}55` : undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-makina-text">{p.name}</div>
          <div className="text-[11px] text-makina-subtle">
            {p.category}
            {p.chains.length ? ` · ${p.chains.length} chain${p.chains.length > 1 ? "s" : ""}` : ""}
          </div>
        </div>
        <SeverityPill severity={p.severity} />
      </div>
      <div className="mt-3 text-xl font-bold tabular-nums text-makina-text">
        {p.tvl != null ? formatUsd(p.tvl) : <span className="text-sm font-medium text-makina-subtle">{p.headline}</span>}
        {p.tvl != null && <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-makina-subtle">TVL</span>}
      </div>
      {p.matched && (
        <div className="mt-3 flex items-center gap-5 border-t border-makina-border/60 pt-3">
          <DeltaPct label="1d" v={p.change1d} />
          <DeltaPct label="7d" v={p.change7d} />
          <DeltaPct label="30d" v={p.change30d} />
        </div>
      )}
    </div>
  );
}

function BriefRow({ b }: { b: ProtocolBrief }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-makina-border bg-makina-surface px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-makina-text">{b.name}</span>
      <span className="hidden w-24 truncate text-[11px] text-makina-subtle sm:block">{b.category}</span>
      <span className="w-20 text-right text-xs font-semibold tabular-nums text-makina-text/90">{b.tvl != null ? formatUsd(b.tvl) : "—"}</span>
      <span className="w-16 text-right text-xs font-semibold tabular-nums" style={{ color: deltaColor(b.change7d) }}>
        {b.change7d == null ? "—" : `${b.change7d > 0 ? "+" : ""}${b.change7d.toFixed(1)}%`}
      </span>
    </div>
  );
}

function ProtocolsInner() {
  const [data, setData] = useState<ProtocolReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"focus" | "all">("focus");
  const [query, setQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const { start: lbStart, done: lbDone } = useLoadingBar();

  const load = useCallback(
    async (manual = false) => {
      if (manual) {
        setRefreshing(true);
        lbStart();
      }
      try {
        const r = (await fetch("/api/protocols").then((res) => (res.ok ? res.json() : null))) as
          | (ProtocolReport & { error?: string })
          | null;
        if (r && Array.isArray(r.watched)) {
          setData(r);
          setError("");
        } else {
          setError(r?.error || "Failed to load protocols.");
        }
      } catch {
        setError("Failed to load protocols.");
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
    const id = setInterval(() => load(), 120_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  // Watched protocols grouped by category, severity-first within each group.
  const grouped = useMemo(() => {
    if (!data) return [] as { category: ProtocolCategory; items: ProtocolHealth[] }[];
    return PROTOCOL_CATEGORIES.map((category) => ({
      category,
      items: data.watched
        .filter((p) => p.category === category)
        .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || (b.tvl ?? 0) - (a.tvl ?? 0)),
    })).filter((g) => g.items.length > 0);
  }, [data]);

  const browse = useMemo(() => {
    if (!data) return [] as ProtocolBrief[];
    const q = query.trim().toLowerCase();
    return data.all.filter((b) => !q || b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q));
  }, [data, query]);

  const s = data?.summary;
  const banner = (() => {
    if (!s) return null;
    const crit = data!.watched.filter((p) => p.severity === "critical");
    const warn = data!.watched.filter((p) => p.severity === "warn");
    if (crit.length)
      return { tone: "#ef4444", Icon: AlertTriangle, text: `${crit.length} protocol${crit.length > 1 ? "s" : ""} with sharp TVL drops`, detail: crit.map((p) => p.name).join(" · ") };
    if (warn.length)
      return { tone: "#f59e0b", Icon: AlertTriangle, text: `${warn.length} protocol${warn.length > 1 ? "s" : ""} seeing outflows`, detail: warn.map((p) => p.name).join(" · ") };
    return { tone: "#22c55e", Icon: ShieldCheck, text: `All ${s.watched} watched protocols stable`, detail: s.totalTvl > 0 ? `${formatUsd(s.totalTvl)} TVL across watched venues` : "" };
  })();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-in-up">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-makina-muted">Risk monitor</p>
            <h1 className="text-xl font-bold">
              Protocol <span className="gradient-text">Risk</span> Monitor
            </h1>
            <p className="mt-1 text-xs text-makina-muted">
              TVL health of the venues vaults depend on
              {data ? ` · ${data.summary.watched} watched · ${formatUsd(data.summary.totalTvl)} TVL` : ""} · DefiLlama · {timeAgo(data?.at)}
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
            <PageLoader label="Loading protocols…" />
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

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-makina-border bg-makina-surface p-0.5">
                {(["focus", "all"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${view === v ? "bg-makina-card text-makina-text shadow-sm" : "text-makina-muted hover:text-makina-text"}`}
                    title={v === "focus" ? "Protocols vaults depend on" : "Browse the top protocols by TVL"}
                  >
                    {v === "focus" ? "Watched" : "Browse all"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {view === "all" && (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-makina-subtle" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search protocols…"
                      className="w-56 rounded-lg border border-makina-border bg-makina-surface py-2 pl-9 pr-3 text-sm text-makina-text placeholder:text-makina-subtle focus:border-makina-accent/40 focus:outline-none"
                    />
                  </div>
                )}
                <button
                  onClick={() => setAutoRefresh((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${autoRefresh ? "border-makina-green/40 bg-makina-green/5 text-makina-green" : "border-makina-border text-makina-muted hover:text-makina-text"}`}
                  title="Re-check every 2 min"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-makina-green animate-pulse-live" : "bg-makina-subtle"}`} />
                  {autoRefresh ? "Live" : "Auto-refresh off"}
                </button>
              </div>
            </div>

            {view === "focus" ? (
              <div className="space-y-6">
                {grouped.map((g) => (
                  <div key={g.category} className="animate-fade-in-up">
                    <p className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-makina-muted">
                      <Activity size={12} /> {g.category} <span className="text-makina-subtle">· {g.items.length}</span>
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {g.items.map((p) => (
                        <ProtocolCard key={p.slug + p.name} p={p} />
                      ))}
                    </div>
                  </div>
                ))}
                {data && data.summary.unmatched.length > 0 && (
                  <p className="px-1 text-[10px] text-makina-subtle">
                    Couldn&apos;t match on DefiLlama (fix the slug in the watchlist): {data.summary.unmatched.join(", ")}.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2 animate-fade-in-up">
                <div className="flex items-center gap-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-makina-subtle">
                  <span className="min-w-0 flex-1">Protocol</span>
                  <span className="hidden w-24 sm:block">Category</span>
                  <span className="w-20 text-right">TVL</span>
                  <span className="w-16 text-right">7d</span>
                </div>
                {browse.map((b) => (
                  <BriefRow key={b.slug + b.name} b={b} />
                ))}
                {browse.length === 0 && <p className="py-8 text-center text-sm text-makina-muted">No matches.</p>}
              </div>
            )}

            <p className="px-1 text-[10px] leading-relaxed text-makina-subtle">
              Health from DefiLlama TVL trend: a sharp 1d/7d drop is the first sign of an exploit or exodus. Watched =
              the venues vaults depend on (edit the watchlist to match real exposure). Next: on-chain utilization /
              withdrawable-liquidity and an incident feed will layer in as additional signals.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

export default function ProtocolsPage() {
  return <ProtocolsInner />;
}

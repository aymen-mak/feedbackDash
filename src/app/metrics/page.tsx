"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw,
  Plus,
  Download,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Pencil,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Sparkline from "@/components/competitors/Sparkline";
import MetricsTrendChart from "@/components/competitors/MetricsTrendChart";
import WeekEntryModal from "@/components/makina/WeekEntryModal";
import LatestTweets from "@/components/makina/LatestTweets";
import { formatCount, signedPct, PLATFORM_META } from "@/components/competitors/platformMeta";
import { downloadCsv } from "@/components/competitors/exportCsv";
import {
  ACCOUNTS,
  accountDef,
  defaultWeekStart,
  periodLabel,
  pctChange,
  type AccountDef,
  type JournalEntry,
  type MakinaJournal,
  type MakinaTweets,
  type MetricKind,
} from "@/lib/makina/journal";

interface CollectSummary {
  periodStart: string;
  accounts: { key: string; label: string; ok: boolean; error: string | null; filled: number }[];
}

interface Diag {
  apify: { ok: boolean; message: string; fix?: string; detail?: { usage?: number; limit?: number; resetAt?: string } };
}

/** Map a collector error string to a one-line suggested fix. */
function suggestFor(err: string): string {
  const e = err.toLowerCase();
  if (e.includes("not set")) return "Env var missing on this deployment. Add it in Vercel and redeploy.";
  if (e.includes("approval") || e.includes("approve") || e.includes("permission")) return "Approve the actor's permissions on this Apify account using the link.";
  if (e.includes("402") || e.includes("credit") || e.includes("payment") || e.includes("usage limit"))
    return "Apify monthly credit is used up. Add a payment method or wait for the cycle reset.";
  if (e.includes("401") || e.includes("403") || e.includes("token")) return "Token rejected. Regenerate APIFY_TOKEN and redeploy.";
  if (e.includes("429") || e.includes("rate")) return "Rate-limited; retried automatically and should clear shortly.";
  if (e.includes("timed out")) return "Scrape timed out. Usually transient; retry.";
  if (e.includes("no tweets") || e.includes("no posts") || e.includes("no data")) return "Connected fine, nothing in the window. Not a failure.";
  return "Retry; if it persists, check the Apify token and credit.";
}

/** Render text, turning the first URL into a clickable link. */
function Linkify({ text }: { text: string }) {
  const m = text.match(/(https?:\/\/[^\s]+)/);
  if (!m) return <>{text}</>;
  const [before, after] = text.split(m[1]);
  return (
    <>
      {before}
      <a href={m[1]} target="_blank" rel="noopener noreferrer" className="text-makina-accent underline">
        {m[1]}
      </a>
      {after}
    </>
  );
}

function fmtMetric(v: number | null | undefined, kind: MetricKind): string {
  if (v == null) return "-";
  return kind === "ratio" ? `${Math.round(v * 10) / 10}%` : formatCount(v);
}

function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-[11px] text-makina-subtle">-</span>;
  const up = pct > 0;
  const flat = Math.abs(pct) < 0.05;
  const cls = flat ? "text-makina-muted" : up ? "text-makina-green" : "text-makina-red";
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${cls}`}>
      <Icon size={11} />
      {signedPct(pct)}
    </span>
  );
}

const clampDesc = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
};

/** Plain-language one-liner summarizing the latest known figures for an account. */
function weekSummary(accDef: AccountDef, v: Record<string, number | null>): string | null {
  if (accDef.platform !== "twitter") return null;
  const imp = v.impressions;
  if (imp == null) return null;
  const eng = (v.likes ?? 0) + (v.replies ?? 0) + (v.reposts ?? 0) + (v.bookmarks ?? 0) + (v.shares ?? 0);
  const parts = [
    `${accDef.short} earned ${formatCount(imp)} impressions`,
    `${formatCount(eng)} engagements${v.engagementRate != null ? ` (${Math.round(v.engagementRate * 10) / 10}% rate)` : ""}`,
  ];
  if (v.newFollows != null) parts.push(`${v.newFollows >= 0 ? "+" : "−"}${formatCount(Math.abs(v.newFollows))} followers`);
  return `${parts.join(", ")}.`;
}

/** Latest non-null value for a metric across periods, with its period and the prior non-null (for deltas). */
function stickyMetric(entries: JournalEntry[], key: string): { value: number | null; asOf: string | null; prev: number | null } {
  let value: number | null = null;
  let asOf: string | null = null;
  let prev: number | null = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const v = entries[i].values[key];
    if (v == null) continue;
    if (value === null) {
      value = v;
      asOf = entries[i].periodStart;
    } else {
      prev = v;
      break;
    }
  }
  return { value, asOf, prev };
}

/** Short UTC stamp for a collection timestamp. */
function fmtStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC`;
}

/** Always-on pill showing Apify usage this billing cycle. */
function ApifyPill({ usage, limit }: { usage: number; limit: number }) {
  const pct = limit > 0 ? usage / limit : 0;
  const color = pct >= 1 ? "#f87171" : pct >= 0.8 ? "#f59e0b" : "#34d399";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border border-makina-border bg-makina-surface px-2.5 py-2 text-xs font-medium text-makina-muted"
      title={`Apify usage this billing cycle: $${usage.toFixed(2)} of $${limit}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      Apify ${usage.toFixed(2)}/${limit}
    </span>
  );
}

function MetricsInner() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [account, setAccount] = useState("makinafi");
  const [chartMetric, setChartMetric] = useState("impressions");
  const [collecting, setCollecting] = useState(false);
  const [summary, setSummary] = useState<CollectSummary | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [modal, setModal] = useState<{ entry: JournalEntry | null } | null>(null);
  const [tweets, setTweets] = useState<MakinaTweets>({ byAccount: {} });
  const [apifyHealth, setApifyHealth] = useState<Diag["apify"] | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [j, t] = await Promise.all([
        fetch("/api/makina/journal").then((r) => (r.ok ? r.json() : null)) as Promise<MakinaJournal | null>,
        fetch("/api/makina/tweets").then((r) => (r.ok ? r.json() : null)) as Promise<MakinaTweets | null>,
      ]);
      if (j && Array.isArray(j.entries)) setEntries(j.entries);
      if (t && t.byAccount) setTweets(t);
    } catch {
      setError("Failed to load journal.");
    }
    setLoading(false);
  }, []);

  const runDiagnostics = useCallback(async (open = true) => {
    setDiagBusy(true);
    try {
      const d = (await fetch("/api/makina/diagnose").then((r) => (r.ok ? r.json() : null))) as Diag | null;
      if (d?.apify) setApifyHealth(d.apify);
    } catch {
      /* ignore */
    }
    if (open) setDiagOpen(true);
    setDiagBusy(false);
  }, []);

  useEffect(() => {
    load();
    runDiagnostics(false);
  }, [load, runDiagnostics]);

  const collectNow = async () => {
    setCollecting(true);
    setError("");
    try {
      const res = await fetch("/api/makina/collect", { method: "POST" });
      const data = (await res.json().catch(() => null)) as CollectSummary | null;
      if (data?.accounts) {
        setSummary(data);
        runDiagnostics(data.accounts.some((a) => !a.ok));
      }
      await load();
    } catch {
      setError("Collection failed.");
    }
    setCollecting(false);
  };

  const accDef = accountDef(account)!;
  const accEntries = useMemo(
    () => entries.filter((e) => e.account === account).sort((a, b) => a.periodStart.localeCompare(b.periodStart)),
    [entries, account]
  );
  const labels = accEntries.map((e) => periodLabel(e.periodStart));
  const latest = accEntries[accEntries.length - 1];
  const prev = accEntries[accEntries.length - 2];
  // Carry-forward the latest known value per metric so nothing goes blank when a collection fails.
  const stickyVals: Record<string, number | null> = {};
  for (const m of accDef.metrics) stickyVals[m.key] = stickyMetric(accEntries, m.key).value;
  const summaryText = latest ? weekSummary(accDef, stickyVals) : null;
  const lastCollectAt = accEntries.reduce<string | null>(
    (mx, e) => (e.updatedAt && (!mx || e.updatedAt > mx) ? e.updatedAt : mx),
    null
  );

  // Keep the charted metric valid for the account.
  useEffect(() => {
    if (!accDef.metrics.some((m) => m.key === chartMetric)) {
      setChartMetric(accDef.metrics[0]?.key ?? "");
    }
  }, [accDef, chartMetric]);

  const accentColor = PLATFORM_META[accDef.platform].color;
  const seriesOf = (key: string) => accEntries.map((e) => e.values[key] ?? null);
  const chartDef = accDef.metrics.find((m) => m.key === chartMetric) ?? accDef.metrics[0];

  const exportCsv = () => {
    const head = ["Period", ...accDef.metrics.map((m) => m.label)];
    const lines = [head.join(",")];
    for (const e of [...accEntries].reverse()) {
      lines.push([e.periodStart, ...accDef.metrics.map((m) => e.values[m.key] ?? "")].join(","));
    }
    downloadCsv(`makina-${account}-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"));
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 animate-fade-in-up">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-makina-muted">Performance</p>
            <h1 className="text-xl font-bold">
              Makina <span className="gradient-text">Analytics</span>
            </h1>
            <p className="mt-1 text-xs text-makina-muted">Auto-collected from Makina&apos;s accounts</p>
          </div>
          <div className="flex items-center gap-2">
            {apifyHealth?.detail?.usage != null && apifyHealth.detail.limit != null && (
              <ApifyPill usage={apifyHealth.detail.usage} limit={apifyHealth.detail.limit} />
            )}
            <button
              onClick={() => runDiagnostics()}
              disabled={diagBusy}
              className="inline-flex items-center gap-2 rounded-lg border border-makina-border bg-makina-surface px-3 py-2 text-sm font-medium text-makina-muted transition-colors hover:border-makina-accent/40 hover:text-makina-text btn-tactile disabled:opacity-50"
              title="Check why collection failed"
            >
              <Wrench size={14} className={diagBusy ? "animate-pulse" : ""} />
              Diagnose
            </button>
            <button
              onClick={() => setModal({ entry: null })}
              className="inline-flex items-center gap-2 rounded-lg border border-makina-border bg-makina-surface px-3 py-2 text-sm font-medium text-makina-muted transition-colors hover:border-makina-accent/40 hover:text-makina-text btn-tactile"
            >
              <Plus size={14} />
              Add / backfill
            </button>
            <button
              onClick={collectNow}
              disabled={collecting}
              className="inline-flex items-center gap-2 rounded-lg gradient-accent px-4 py-2 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 disabled:opacity-50 btn-tactile"
            >
              <RefreshCw size={14} className={collecting ? "animate-spin" : ""} />
              {collecting ? "Collecting…" : "Collect now"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-makina-red/20 bg-makina-red/10 px-4 py-2 text-sm text-makina-red">{error}</div>
        )}

        {/* Collection status */}
        {summary && (
          <div className="mb-4 rounded-xl border border-makina-border bg-makina-card p-3 animate-fade-in-up">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-makina-muted">
                Last collection · {periodLabel(summary.periodStart)}
              </span>
              <button onClick={() => setSummary(null)} className="text-[11px] text-makina-subtle hover:text-makina-text">
                dismiss
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.accounts.map((a) => (
                <span
                  key={a.key}
                  title={a.error ?? `${a.filled} metrics`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-makina-border bg-makina-surface px-2 py-1 text-[11px]"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${a.ok ? "bg-makina-green" : a.filled > 0 ? "bg-amber-500" : "bg-makina-red"}`} />
                  <span className="font-medium text-makina-text/80">{a.label}</span>
                  <span className="text-makina-subtle">{a.ok ? `${a.filled}` : a.error ? "needs setup" : `${a.filled}`}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Diagnostics (auto-runs on a failed collection) */}
        {(diagOpen || summary?.accounts.some((a) => !a.ok)) && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 animate-fade-in-up">
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-500">
                <AlertTriangle size={12} /> Diagnostics
              </span>
              <button onClick={() => setDiagOpen(false)} className="text-[11px] text-makina-subtle transition-colors hover:text-makina-text">
                dismiss
              </button>
            </div>
            <div className="space-y-1.5 text-xs">
              {apifyHealth && (
                <div className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${apifyHealth.ok ? "bg-makina-green" : "bg-makina-red"}`} />
                  <p className="text-makina-text/90">
                    <span className="font-semibold">Apify:</span> {apifyHealth.message}
                    {apifyHealth.fix && <span className="text-makina-muted"> {apifyHealth.fix}</span>}
                  </p>
                </div>
              )}
              {summary?.accounts
                .filter((a) => !a.ok && a.error)
                .map((a) => (
                  <div key={a.key} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-makina-red" />
                    <p className="text-makina-text/90">
                      <span className="font-semibold">{a.label}:</span> <Linkify text={a.error || ""} />.{" "}
                      <span className="text-makina-muted">{suggestFor(a.error || "")}</span>
                    </p>
                  </div>
                ))}
              {!apifyHealth && (
                <button onClick={() => runDiagnostics()} disabled={diagBusy} className="text-[11px] font-medium text-makina-accent hover:underline disabled:opacity-50">
                  {diagBusy ? "Checking Apify…" : "Run Apify health check"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Account tabs */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {ACCOUNTS.map((a) => {
            const on = account === a.key;
            return (
              <button
                key={a.key}
                onClick={() => setAccount(a.key)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-all ${
                  on ? "border-transparent text-white shadow-sm" : "border-makina-border bg-makina-surface text-makina-muted hover:border-makina-accent/40 hover:text-makina-text"
                }`}
                style={on ? { backgroundColor: PLATFORM_META[a.platform].color } : undefined}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: on ? "rgba(255,255,255,0.95)" : PLATFORM_META[a.platform].color }} />
                {a.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex h-[50vh] items-center justify-center text-sm text-makina-muted animate-pulse">Loading…</div>
        ) : accEntries.length === 0 ? (
          <div className="rounded-xl border border-makina-border bg-makina-card p-10 text-center">
            <p className="text-sm text-makina-muted">No data yet for {accDef.label}.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-makina-subtle">
              Set the account&apos;s env vars in Vercel, then Collect now. Or use Add / backfill to enter a period
              manually. Hover the ⓘ for the exact vars.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Period + plain-language summary, one cohesive band */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-makina-text">
                    Latest: <span className="text-makina-accent">{periodLabel(latest.periodStart)}</span>
                    {prev && <span className="ml-2 text-xs font-normal text-makina-subtle">vs {periodLabel(prev.periodStart)}</span>}
                  </h2>
                  {lastCollectAt && (
                    <span className="rounded-md bg-makina-accent-dim px-2 py-0.5 text-[11px] font-medium text-makina-accent">
                      Data as of {fmtStamp(lastCollectAt)}
                    </span>
                  )}
                </div>
                {summaryText && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-makina-muted">{summaryText}</p>}
              </div>
              <button
                onClick={() => setModal({ entry: latest })}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-makina-border px-2.5 py-1 text-[11px] font-medium text-makina-muted transition-colors hover:text-makina-text"
              >
                <Pencil size={12} />
                Edit this week
              </button>
            </div>

            {/* KPIs, one dense grid; click a card to chart it */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {accDef.metrics.map((m) => {
                const { value: cur, asOf, prev: pv } = stickyMetric(accEntries, m.key);
                const on = chartMetric === m.key;
                const spark = seriesOf(m.key).filter((v): v is number => v != null);
                const hasHistory = spark.length >= 2;
                const stale = asOf != null && asOf < latest.periodStart;
                return (
                  <button
                    key={m.key}
                    onClick={() => setChartMetric(m.key)}
                    title={m.description}
                    className={`flex flex-col rounded-xl border bg-makina-card p-3 text-left transition-all hover-lift ${
                      on ? "border-makina-accent ring-1 ring-makina-accent/30" : "border-makina-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[11px] text-makina-muted">{m.label}</span>
                      {m.auto && <span className="text-[8px] font-bold uppercase text-makina-green">auto</span>}
                    </div>
                    <p className="mt-1 text-xl font-bold tabular-nums text-makina-text">{fmtMetric(cur, m.kind)}</p>
                    <div className="mt-0.5 flex h-[18px] items-center justify-between gap-1">
                      {stale ? (
                        <span className="text-[10px] font-medium text-amber-500">as of {periodLabel(asOf!)}</span>
                      ) : hasHistory ? (
                        <Delta pct={pctChange(cur, pv)} />
                      ) : (
                        <span className="text-[10px] text-makina-subtle">first tracked week</span>
                      )}
                      {hasHistory && <Sparkline data={spark} width={56} height={18} color={on ? accentColor : undefined} />}
                    </div>
                    <p className="mt-1.5 text-[10px] leading-snug text-makina-subtle" style={clampDesc}>
                      {m.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Trend + latest posts side by side, uses the width, less up/down scrolling */}
            <div className={`grid gap-4 ${accDef.platform === "twitter" ? "lg:grid-cols-2" : ""}`}>
              <div className="rounded-xl border border-makina-border bg-makina-card p-4">
                <div className="mb-3 text-sm">
                  <span className="font-semibold text-makina-text">{chartDef?.label}</span>
                  <span className="text-makina-muted"> · {accEntries.length} periods</span>
                </div>
                <MetricsTrendChart
                  labels={labels}
                  series={[{ id: chartMetric, name: chartDef?.label ?? "", color: accentColor, values: seriesOf(chartMetric) }]}
                  mode="area"
                  valueFormat={chartDef?.kind === "ratio" ? "ratio" : "count"}
                />
              </div>

              {accDef.platform === "twitter" && (
                <LatestTweets
                  tweets={tweets.byAccount[account]?.tweets ?? []}
                  accent={accentColor}
                  updatedAt={tweets.byAccount[account]?.updatedAt}
                />
              )}
            </div>

            {/* History table */}
            <div className="rounded-xl border border-makina-border bg-makina-card">
              <div className="flex items-center justify-between px-4 py-3">
                <button onClick={() => setShowHistory((v) => !v)} className="inline-flex items-center gap-2 text-sm font-semibold text-makina-text">
                  Period-by-period history
                  <ChevronDown size={16} className={`text-makina-muted ${showHistory ? "rotate-180 transition-transform" : "transition-transform"}`} />
                </button>
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1.5 rounded-md border border-makina-border bg-makina-surface px-2.5 py-1 text-[11px] font-medium text-makina-muted transition-colors hover:border-makina-accent/40 hover:text-makina-text"
                >
                  <Download size={12} />
                  Export CSV
                </button>
              </div>
              {showHistory && (
                <div className="overflow-x-auto border-t border-makina-border">
                  <table className="w-full min-w-[680px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-makina-border">
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-makina-muted">Period</th>
                        {accDef.metrics.map((m) => (
                          <th key={m.key} className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-makina-muted">
                            {m.label}
                          </th>
                        ))}
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {[...accEntries].reverse().map((e, ri, arr) => {
                        const pe = arr[ri + 1]; // previous period (older)
                        return (
                          <tr key={e.periodStart} className="border-b border-makina-border/50 hover:bg-makina-surface/40">
                            <td className="px-3 py-2 font-medium text-makina-text">{periodLabel(e.periodStart)}</td>
                            {accDef.metrics.map((m) => {
                              const cur = e.values[m.key] ?? null;
                              const pv = pe?.values[m.key] ?? null;
                              const ch = pctChange(cur, pv);
                              return (
                                <td key={m.key} className="px-3 py-2 text-right tabular-nums">
                                  <div className="text-makina-text/90">{fmtMetric(cur, m.kind)}</div>
                                  {ch != null && Math.abs(ch) >= 0.05 && (
                                    <div className={`text-[9px] ${ch > 0 ? "text-makina-green" : "text-makina-red"}`}>{signedPct(ch)}</div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-2 py-2 text-right">
                              <button onClick={() => setModal({ entry: e })} className="text-makina-subtle hover:text-makina-accent" title="Edit">
                                <Pencil size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {modal && (
        <WeekEntryModal
          account={accDef}
          entry={modal.entry}
          defaultPeriodStart={defaultWeekStart()}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function MetricsPage() {
  return <MetricsInner />;
}

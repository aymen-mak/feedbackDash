"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Trophy, Users, TrendingUp, Database, Plus, Download } from "lucide-react";
import Navbar from "@/components/Navbar";
import PasswordGate from "@/components/PasswordGate";
import CompetitorComparisonChart from "@/components/competitors/CompetitorComparisonChart";
import CompetitorCard from "@/components/competitors/CompetitorCard";
import MonitoringTable from "@/components/competitors/MonitoringTable";
import CompetitorDetail from "@/components/competitors/CompetitorDetail";
import CompetitorEditor from "@/components/competitors/CompetitorEditor";
import { competitorsToCsv, downloadCsv } from "@/components/competitors/exportCsv";
import { formatCount, formatUsd, timeAgo } from "@/components/competitors/platformMeta";
import { type Competitor, type Snapshot, type Platform } from "@/lib/competitors/types";

function CompetitorsInner() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cs, ss] = await Promise.all([
        fetch("/api/competitors").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/competitors/history").then((r) => (r.ok ? r.json() : [])),
      ]);
      if (Array.isArray(cs)) setCompetitors(cs);
      if (Array.isArray(ss)) setSnapshots(ss);
    } catch {
      setError("Failed to load competitors.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live mode: re-read data every 60s so cron-updated values surface on their own.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(), 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

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

  // Per-competitor, per-platform change vs. the previous snapshot.
  const trends = useMemo(() => {
    const byKey: Record<string, number[]> = {};
    for (const s of snapshots) {
      (byKey[`${s.competitorId}:${s.platform}`] ??= []).push(s.value);
    }
    const out: Record<string, Partial<Record<Platform, number>>> = {};
    for (const [key, vals] of Object.entries(byKey)) {
      if (vals.length < 2) continue;
      const [id, platform] = key.split(":") as [string, Platform];
      (out[id] ??= {})[platform] = vals[vals.length - 1] - vals[vals.length - 2];
    }
    return out;
  }, [snapshots]);

  // Ranked: self first (reference), then by community strength.
  const ranked = useMemo(
    () =>
      [...competitors].sort((a, b) => {
        if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
        return b.communityStrength - a.communityStrength;
      }),
    [competitors]
  );

  const peers = competitors.filter((c) => !c.isSelf);
  const strongest = [...peers].sort((a, b) => b.communityStrength - a.communityStrength)[0];
  const totalX = peers.reduce(
    (sum, c) => sum + (c.platforms.find((p) => p.platform === "twitter")?.value ?? 0),
    0
  );
  const totalTvl = peers.reduce((sum, c) => sum + (c.onchain?.tvl ?? 0), 0);
  const lastUpdated = competitors
    .flatMap((c) => [...c.platforms.map((p) => p.lastUpdated), c.onchain?.lastUpdated])
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;

  const stats = [
    { icon: Users, label: "Competitors tracked", value: String(peers.length) },
    { icon: Database, label: "Total TVL tracked", value: totalTvl > 0 ? formatUsd(totalTvl) : "—" },
    { icon: Trophy, label: "Strongest community", value: strongest?.name ?? "—" },
    { icon: TrendingUp, label: "Combined X reach", value: totalX > 0 ? formatCount(totalX) : "—" },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 animate-fade-in-up">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-makina-muted">
              Competitive intel
            </p>
            <h1 className="text-xl font-bold">
              Competitor <span className="gradient-text">Community</span> Tracker
            </h1>
            <p className="mt-1 text-xs text-makina-muted">
              Community footprint across X, Discord, Telegram, LinkedIn & GitHub · last data{" "}
              {timeAgo(lastUpdated)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                downloadCsv(
                  `competitor-community-${new Date().toISOString().slice(0, 10)}.csv`,
                  competitorsToCsv(competitors)
                )
              }
              disabled={competitors.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-makina-border bg-makina-surface px-3 py-2 text-sm font-medium text-makina-muted transition-colors hover:border-makina-accent/40 hover:text-makina-text disabled:opacity-50 btn-tactile"
              title="Export the current table as CSV"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-makina-border bg-makina-surface px-3 py-2 text-sm font-medium text-makina-muted transition-colors hover:border-makina-accent/40 hover:text-makina-text btn-tactile"
            >
              <Plus size={14} />
              Add
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg gradient-accent px-4 py-2 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 disabled:opacity-50 btn-tactile"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing…" : "Refresh now"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-makina-red/20 bg-makina-red/10 px-4 py-2 text-sm text-makina-red">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-[60vh] items-center justify-center text-sm text-makina-muted animate-pulse">
            Loading competitors…
          </div>
        ) : (
          <>
            {/* Summary tiles */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-makina-border bg-makina-card p-4 hover-lift animate-fade-in-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-center gap-2 text-makina-muted">
                    <s.icon size={14} />
                    <span className="text-[11px] font-medium uppercase tracking-wider">{s.label}</span>
                  </div>
                  <p className="mt-2 truncate text-2xl font-bold text-makina-text">{s.value}</p>
                </div>
              ))}
            </div>

            {/* View controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-makina-border bg-makina-surface p-0.5">
                {(["table", "cards"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${
                      view === v ? "bg-makina-card text-makina-text shadow-sm" : "text-makina-muted hover:text-makina-text"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAutoRefresh((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  autoRefresh
                    ? "border-makina-green/40 bg-makina-green/5 text-makina-green"
                    : "border-makina-border text-makina-muted hover:text-makina-text"
                }`}
                title="Re-read data every 60s to surface cron updates"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-makina-green animate-pulse-live" : "bg-makina-subtle"}`}
                />
                {autoRefresh ? "Live" : "Auto-refresh off"}
              </button>
            </div>

            {/* Comparison chart */}
            <CompetitorComparisonChart competitors={competitors} />

            {/* Monitoring view */}
            {view === "table" ? (
              <MonitoringTable competitors={competitors} trends={trends} onSelect={setSelectedId} />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {ranked.map((c, i) => (
                  <CompetitorCard
                    key={c.id}
                    competitor={c}
                    trends={trends[c.id]}
                    index={i}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {selectedId && (() => {
        const selected = competitors.find((c) => c.id === selectedId);
        if (!selected) return null;
        return (
          <CompetitorDetail
            competitor={selected}
            snapshots={snapshots.filter((s) => s.competitorId === selected.id)}
            onClose={() => setSelectedId(null)}
            onChanged={load}
          />
        );
      })()}

      {adding && (
        <CompetitorEditor
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function CompetitorsPage() {
  return (
    <PasswordGate>
      <CompetitorsInner />
    </PasswordGate>
  );
}

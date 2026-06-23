"use client";

import { useMemo, useState } from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import Sparkline from "./Sparkline";
import { type Competitor } from "@/lib/competitors/types";
import { formatUsd } from "./platformMeta";

// Momentum is the only thing that earns color on this board: green when TVL is
// rising over 7d, red when it's bleeding. Everything else stays in the azure /
// neutral palette so the eye lands on direction first.
const GREEN = "#22c55e";
const RED = "#ef4444";

type SortKey = "tvl" | "move";

interface Row {
  c: Competitor;
  tvl: number;
  chg7d: number | null;
  fees24h: number | null;
  rev24h: number | null;
  series: number[];
}

function MomentumPill({ chg }: { chg: number | null }) {
  if (chg == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums text-makina-subtle">
        <Minus size={12} strokeWidth={2.5} />
      </span>
    );
  }
  const up = chg >= 0;
  const color = up ? GREEN : RED;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-semibold tabular-nums"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <Icon size={12} strokeWidth={2.75} />
      {Math.abs(chg).toFixed(1)}%
    </span>
  );
}

// Shared lane widths so the column header and every row line up exactly.
const L = {
  rank: "w-7 shrink-0 text-right",
  name: "flex-1 min-w-0",
  tvl: "hidden sm:block w-[6.5rem] shrink-0",
  spark: "hidden lg:block w-[88px] shrink-0",
  pill: "flex w-[4.75rem] shrink-0 justify-end",
  sec: "hidden xl:block w-[8.5rem] shrink-0 text-right",
};

export default function OnChainBoard({ competitors }: { competitors: Competitor[] }) {
  const [sort, setSort] = useState<SortKey>("tvl");

  const rows = useMemo<Row[]>(() => {
    const base = competitors
      .filter((c) => c.onchain?.tvl != null)
      .map((c): Row => ({
        c,
        tvl: c.onchain!.tvl as number,
        chg7d: c.onchain!.tvlChange7d,
        fees24h: c.onchain!.fees24h,
        rev24h: c.onchain!.revenue24h,
        series: (c.onchain!.tvlSeries ?? [])
          .map((p) => p.v)
          .filter((v) => Number.isFinite(v)),
      }));
    base.sort((a, b) =>
      sort === "tvl" ? b.tvl - a.tvl : (b.chg7d ?? -Infinity) - (a.chg7d ?? -Infinity)
    );
    return base;
  }, [competitors, sort]);

  const maxTvl = Math.max(1, ...rows.map((r) => r.tvl));

  return (
    <div className="rounded-xl border border-makina-border bg-makina-card p-5 animate-fade-in-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-makina-muted">
            On-chain momentum
          </p>
          <h2 className="text-sm font-bold text-makina-text">
            How tracked protocols are trending
          </h2>
        </div>
        <div className="inline-flex rounded-lg border border-makina-border bg-makina-surface p-0.5">
          {(["tvl", "move"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                sort === k
                  ? "bg-makina-card text-makina-text shadow-sm"
                  : "text-makina-muted hover:text-makina-text"
              }`}
            >
              {k === "tvl" ? "By TVL" : "By 7d move"}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-makina-muted">
          No on-chain data yet, run a refresh.
        </div>
      ) : (
        <div className="mt-4">
          {/* Column header */}
          <div className="flex items-center gap-3 border-b border-makina-border px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-makina-subtle md:gap-4">
            <div className={L.rank}>#</div>
            <div className={L.name}>Protocol</div>
            <div className={`${L.tvl} text-right`}>TVL</div>
            <div className={L.spark}>30d trend</div>
            <div className={`${L.pill} justify-end`}>7d</div>
            <div className={L.sec}>Fees · Rev 24h</div>
          </div>

          <div className="mt-1 space-y-0.5">
            {rows.map((r, i) => {
              const isSelf = r.c.isSelf;
              const pct = Math.max(2, (r.tvl / maxTvl) * 100);
              return (
                <div
                  key={r.c.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors md:gap-4 ${
                    isSelf
                      ? "bg-makina-accent-dim ring-1 ring-inset ring-makina-accent/30"
                      : "hover:bg-makina-surface"
                  }`}
                >
                  {/* Rank */}
                  <div
                    className={`${L.rank} text-xs font-semibold tabular-nums ${
                      i === 0 ? "text-makina-accent" : "text-makina-subtle"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>

                  {/* Identity */}
                  <div className={L.name}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${
                          isSelf ? "text-makina-accent" : "text-makina-text"
                        }`}
                      >
                        {r.c.name}
                      </span>
                      {isSelf && (
                        <span className="shrink-0 rounded bg-makina-accent/20 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-makina-accent">
                          You
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-makina-subtle">
                      <span className="truncate">{r.c.segment}</span>
                      {r.c.token && (
                        <span className="shrink-0 rounded border border-makina-border px-1 py-px text-[10px] font-medium text-makina-muted">
                          {r.c.token}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* TVL + size rail */}
                  <div className={L.tvl}>
                    <div className="text-right text-sm font-semibold tabular-nums text-makina-text">
                      {formatUsd(r.tvl)}
                    </div>
                    <div className="mt-1 flex h-1 w-full justify-end overflow-hidden rounded-full bg-makina-border/50">
                      <div
                        className="h-full rounded-full bg-makina-accent/70 transition-[width] duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* 30d trend sparkline, colored by 7d direction */}
                  <div className={L.spark}>
                    <Sparkline
                      data={r.series.length >= 2 ? r.series : []}
                      width={88}
                      height={26}
                      fill
                      color={r.chg7d == null ? undefined : r.chg7d >= 0 ? GREEN : RED}
                    />
                  </div>

                  {/* 7d momentum */}
                  <div className={L.pill}>
                    <MomentumPill chg={r.chg7d} />
                  </div>

                  {/* Fees / revenue 24h */}
                  <div className={`${L.sec} text-[11px] tabular-nums`}>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-makina-subtle">Fees</span>
                      <span className="text-makina-muted">
                        {r.fees24h != null ? formatUsd(r.fees24h) : "—"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-end gap-1.5">
                      <span className="text-makina-subtle">Rev</span>
                      <span className="text-makina-muted">
                        {r.rev24h != null ? formatUsd(r.rev24h) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-makina-subtle">
        Ranked by {sort === "tvl" ? "TVL" : "7-day TVL move"}. The bar under each TVL shows its size
        against the largest tracked protocol; the sparkline traces ~30 days and turns green when TVL
        is up over 7 days, red when it&apos;s down. Fees and revenue are trailing 24h. Source: DefiLlama.
      </p>
    </div>
  );
}

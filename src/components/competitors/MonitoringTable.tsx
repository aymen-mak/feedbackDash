"use client";

import { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, Eye, EyeOff, Pin } from "lucide-react";
import { type Competitor, type Platform, type PlatformMetric } from "@/lib/competitors/types";
import { formatCount, formatUsd, signedPct, freshness, HEALTH_COLOR, audience } from "./platformMeta";
import Sparkline from "./Sparkline";

type SortKey =
  | "name"
  | "audience"
  | "tvl"
  | "fees"
  | "rev"
  | "twitter"
  | "linkedin"
  | "discord"
  | "telegram"
  | "github"
  | "website"
  | "updated";

const SOCIAL_COLS: Platform[] = ["twitter", "linkedin", "discord", "telegram", "github", "website"];

const metricOf = (c: Competitor, p: Platform) => c.platforms.find((x) => x.platform === p);
const valOf = (c: Competitor, p: Platform) => metricOf(c, p)?.value ?? null;
function lastUpdatedOf(c: Competitor): string | null {
  return (
    ([...c.platforms.map((p) => p.lastUpdated), c.onchain?.lastUpdated].filter(Boolean) as string[])
      .sort()
      .pop() ?? null
  );
}

const ACCESSORS: Record<SortKey, (c: Competitor) => number | string> = {
  name: (c) => c.name.toLowerCase(),
  audience: (c) => audience(c),
  tvl: (c) => c.onchain?.tvl ?? -1,
  fees: (c) => c.onchain?.fees24h ?? -1,
  rev: (c) => c.onchain?.revenue24h ?? -1,
  twitter: (c) => valOf(c, "twitter") ?? -1,
  linkedin: (c) => valOf(c, "linkedin") ?? -1,
  discord: (c) => valOf(c, "discord") ?? -1,
  telegram: (c) => valOf(c, "telegram") ?? -1,
  github: (c) => valOf(c, "github") ?? -1,
  website: (c) => valOf(c, "website") ?? -1,
  updated: (c) => new Date(lastUpdatedOf(c) ?? 0).getTime(),
};

function SocialCell({ m, trend }: { m?: PlatformMetric; trend?: number }) {
  if (!m) return <td className="px-2 py-2.5 text-right text-makina-subtle">—</td>;
  if (m.value != null) {
    return (
      <td className="px-2 py-2.5 text-right">
        <span
          className="inline-flex items-center justify-end gap-1"
          title={m.reachExcluded ? `${m.tag || "excluded"} — not counted in reach` : undefined}
        >
          <span
            className={`font-medium tabular-nums ${
              m.reachExcluded ? "text-makina-muted line-through decoration-makina-subtle/50" : "text-makina-text/90"
            }`}
          >
            {formatCount(m.value)}
          </span>
          <span className={`h-1 w-1 rounded-full ${m.source === "auto" ? "bg-makina-green" : "bg-makina-muted"}`} />
        </span>
        {m.reachExcluded && m.tag && <div className="text-[8px] font-medium text-amber-500">{m.tag}</div>}
        {typeof trend === "number" && trend !== 0 && !m.reachExcluded && (
          <div className={`text-[9px] tabular-nums ${trend > 0 ? "text-makina-green" : "text-makina-red"}`}>
            {trend > 0 ? "▲" : "▼"}
            {formatCount(Math.abs(trend))}
          </div>
        )}
      </td>
    );
  }
  let glyph = "—";
  let cls = "text-makina-subtle";
  if (m.lastError) (glyph = "⚠"), (cls = "text-makina-red");
  else if (m.presence === "inactive") (glyph = "dormant"), (cls = "text-amber-500");
  else if (m.presence === "external") (glyph = "ext"), (cls = "text-violet-400");
  else if (m.presence === "private") (glyph = "private"), (cls = "text-makina-subtle");
  else if (m.presence === "none") (glyph = "—"), (cls = "text-makina-subtle");
  else if (m.autoKey) (glyph = "sync"), (cls = "text-makina-accent/80");
  else (glyph = "N/A"), (cls = "text-makina-muted");
  return (
    <td className={`px-2 py-2.5 text-right text-[11px] ${cls}`} title={m.lastError || m.presence}>
      {glyph}
    </td>
  );
}

interface Props {
  competitors: Competitor[];
  trends?: Record<string, Partial<Record<Platform, number>>>;
  onSelect: (id: string) => void;
  onToggleHidden?: (id: string, hidden: boolean) => void;
  onTogglePin?: (id: string, pinned: boolean) => void;
}

export default function MonitoringTable({ competitors, trends, onSelect, onToggleHidden, onTogglePin }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("tvl");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const acc = ACCESSORS[sortKey];
    return [...competitors].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1; // pinned to top
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      const av = acc(a);
      const bv = acc(b);
      const cmp =
        typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return dir === "asc" ? cmp : -cmp;
    });
  }, [competitors, sortKey, dir]);

  const maxAud = useMemo(() => Math.max(1, ...competitors.map(audience)), [competitors]);

  const toggle = (k: SortKey) => {
    if (sortKey === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setDir(k === "name" ? "asc" : "desc");
    }
  };

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`px-2 py-2 ${right ? "text-right" : "text-left"}`}>
      <button
        onClick={() => toggle(k)}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
          sortKey === k ? "text-makina-text" : "text-makina-muted hover:text-makina-text"
        } ${right ? "flex-row-reverse" : ""}`}
      >
        {label}
        {sortKey === k && (dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-makina-border bg-makina-card animate-fade-in-up">
      <table className="w-full min-w-[1060px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-makina-border">
            <Th k="name" label="Protocol" />
            <Th k="audience" label="Community reach" />
            <Th k="tvl" label="TVL" right />
            <Th k="fees" label="Fees 24h" right />
            <Th k="rev" label="Rev 24h" right />
            <Th k="twitter" label="X" right />
            <Th k="linkedin" label="LinkedIn" right />
            <Th k="discord" label="Discord" right />
            <Th k="telegram" label="Telegram" right />
            <Th k="github" label="GitHub" right />
            <Th k="website" label="Web visits" right />
            <Th k="updated" label="Updated" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const f = freshness(lastUpdatedOf(c));
            const oc = c.onchain;
            return (
              <tr
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`cursor-pointer border-b border-makina-border/50 transition-colors hover:bg-makina-surface/50 ${
                  c.pinned ? "border-l-2 border-l-makina-accent bg-makina-accent-dim/15" : ""
                } ${c.hidden ? "opacity-50" : ""}`}
              >
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-makina-text">{c.name}</span>
                    {c.isSelf && (
                      <span className="rounded-full bg-makina-accent-dim px-1 py-0.5 text-[8px] font-bold uppercase text-makina-accent">
                        You
                      </span>
                    )}
                    {c.token && <span className="text-[10px] font-medium text-makina-accent">{c.token}</span>}
                    {onTogglePin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(c.id, !c.pinned);
                        }}
                        className={`transition-colors ${c.pinned ? "text-makina-accent" : "text-makina-subtle hover:text-makina-text"}`}
                        title={c.pinned ? "Unpin" : "Pin to top"}
                      >
                        <Pin size={12} className={c.pinned ? "fill-current" : ""} />
                      </button>
                    )}
                    {onToggleHidden && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleHidden(c.id, !c.hidden);
                        }}
                        className="text-makina-subtle transition-colors hover:text-makina-text"
                        title={c.hidden ? "Un-hide" : "Hide"}
                      >
                        {c.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] text-makina-subtle">{c.segment}</div>
                </td>

                <td className="px-2 py-2.5">
                  {(() => {
                    const a = audience(c);
                    return (
                      <div className="flex items-center gap-1.5" title="X + Discord + Telegram + LinkedIn">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-makina-surface">
                          <div
                            className="h-full rounded-full bg-makina-accent"
                            style={{ width: `${Math.min(100, (a / maxAud) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] tabular-nums text-makina-muted">
                          {a > 0 ? formatCount(a) : "—"}
                        </span>
                      </div>
                    );
                  })()}
                </td>

                <td className="px-2 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {(oc?.tvlSeries?.length ?? 0) >= 2 && (
                      <Sparkline data={oc!.tvlSeries.map((p) => p.v)} width={48} height={16} />
                    )}
                    <div>
                      <div className="font-semibold tabular-nums text-makina-text">
                        {oc?.tvl != null ? formatUsd(oc.tvl) : "—"}
                      </div>
                      {oc?.tvlChange1d != null && (
                        <div
                          className={`text-[10px] tabular-nums ${oc.tvlChange1d >= 0 ? "text-makina-green" : "text-makina-red"}`}
                        >
                          {signedPct(oc.tvlChange1d)}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                <td className="px-2 py-2.5 text-right tabular-nums text-makina-text/80">
                  {oc?.fees24h != null ? formatUsd(oc.fees24h) : <span className="text-makina-subtle">—</span>}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-makina-text/80">
                  {oc?.revenue24h != null ? formatUsd(oc.revenue24h) : <span className="text-makina-subtle">—</span>}
                </td>

                {SOCIAL_COLS.map((p) => (
                  <SocialCell key={p} m={metricOf(c, p)} trend={trends?.[c.id]?.[p]} />
                ))}

                <td className="px-2 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-makina-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: HEALTH_COLOR[f.health] }} />
                    {f.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

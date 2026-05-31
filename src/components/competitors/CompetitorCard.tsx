"use client";

import { useState } from "react";
import { ExternalLink, ChevronDown, BarChart3 } from "lucide-react";
import { type Competitor, type Platform } from "@/lib/competitors/types";
import PlatformBadge from "./PlatformBadge";
import OnchainRow from "./OnchainRow";
import { freshness, HEALTH_COLOR, audience, formatCount } from "./platformMeta";

const PLATFORM_ORDER: Platform[] = [
  "twitter",
  "discord",
  "telegram",
  "linkedin",
  "github",
  "reddit",
  "youtube",
  "other",
];

interface Props {
  competitor: Competitor;
  /** Per-platform change vs. previous snapshot, keyed by platform. */
  trends?: Partial<Record<Platform, number>>;
  /** Open the detail/edit view. */
  onSelect?: (id: string) => void;
  index?: number;
  /** Largest community reach in the set, for the relative bar. */
  maxAudience?: number;
}

export default function CompetitorCard({ competitor: c, trends, onSelect, index = 0, maxAudience = 1 }: Props) {
  const aud = audience(c);
  const [expanded, setExpanded] = useState(false);
  const platforms = [...c.platforms].sort(
    (a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform)
  );
  const lastUpdated = [...c.platforms.map((p) => p.lastUpdated), c.onchain?.lastUpdated]
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;

  return (
    <div
      className="flex flex-col rounded-xl border border-makina-border bg-makina-card p-4 hover-lift animate-fade-in-up"
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-bold text-makina-text">{c.name}</h3>
            {c.isSelf && (
              <span className="rounded-full bg-makina-accent-dim px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-makina-accent">
                You
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-makina-muted">{c.segment}</p>
        </div>
        {c.website && (
          <a
            href={c.website}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-makina-subtle transition-colors hover:text-makina-accent"
            title={c.website}
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {/* Meta chips */}
      {(c.tvl || c.token) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.tvl && (
            <span className="rounded-md bg-makina-surface px-1.5 py-0.5 text-[10px] text-makina-muted">
              TVL {c.tvl}
            </span>
          )}
          {c.token && (
            <span className="rounded-md bg-makina-surface px-1.5 py-0.5 text-[10px] font-medium text-makina-accent">
              {c.token}
            </span>
          )}
        </div>
      )}

      {/* Community reach = X + Discord + Telegram + LinkedIn */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-makina-muted">
            Community reach
          </span>
          <span className="text-[11px] font-bold text-makina-text">{aud > 0 ? formatCount(aud) : "—"}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-makina-surface">
          <div
            className="h-full rounded-full bg-makina-accent transition-all"
            style={{ width: `${Math.min(100, (aud / maxAudience) * 100)}%` }}
          />
        </div>
      </div>

      {/* Platform badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {platforms.map((p) => (
          <PlatformBadge key={p.platform} metric={p} trend={trends?.[p.platform]} />
        ))}
      </div>

      {/* On-chain (DefiLlama) */}
      <OnchainRow c={c} />

      {/* Remark */}
      {c.remark && (
        <div className="mt-3">
          <p className={`text-[11px] leading-relaxed text-makina-muted ${expanded ? "" : "line-clamp-3"}`}>
            {c.remark}
          </p>
          {c.remark.length > 150 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-makina-accent hover:underline"
            >
              {expanded ? "Show less" : "Read more"}
              <ChevronDown size={11} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-3">
        {(() => {
          const f = freshness(lastUpdated);
          return (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-makina-subtle">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: HEALTH_COLOR[f.health] }} />
              {f.label}
            </span>
          );
        })()}
        {onSelect && (
          <button
            onClick={() => onSelect(c.id)}
            className="inline-flex items-center gap-1 rounded-md border border-makina-border bg-makina-surface px-2 py-1 text-[10px] font-medium text-makina-muted transition-colors hover:border-makina-accent/40 hover:text-makina-text"
          >
            <BarChart3 size={11} />
            History & edit
          </button>
        )}
      </div>
    </div>
  );
}

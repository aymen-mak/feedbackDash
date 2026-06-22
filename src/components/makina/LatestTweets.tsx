"use client";

import { useMemo, useState, type ComponentType } from "react";
import { Eye, Heart, MessageCircle, Repeat2, Quote, Bookmark, ExternalLink } from "lucide-react";
import { formatCount } from "@/components/competitors/platformMeta";
import { type TweetMetric } from "@/lib/makina/journal";

type MetricKey = "impressions" | "likes" | "replies" | "reposts" | "quotes" | "bookmarks";
type SortKey = "createdAt" | MetricKey;

const ENGAGE: { key: Exclude<MetricKey, "impressions">; label: string; Icon: ComponentType<{ size?: number }>; color: string }[] = [
  { key: "likes", label: "Likes", Icon: Heart, color: "#f43f5e" },
  { key: "replies", label: "Replies", Icon: MessageCircle, color: "#38bdf8" },
  { key: "reposts", label: "Reposts", Icon: Repeat2, color: "#22c55e" },
  { key: "quotes", label: "Quotes", Icon: Quote, color: "#a78bfa" },
  { key: "bookmarks", label: "Bookmarks", Icon: Bookmark, color: "#f59e0b" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "createdAt", label: "Most recent" },
  { key: "impressions", label: "Most impressions" },
  { key: "likes", label: "Most likes" },
  { key: "replies", label: "Most replies" },
  { key: "reposts", label: "Most reposts" },
  { key: "quotes", label: "Most quotes" },
  { key: "bookmarks", label: "Most bookmarks" },
];

function relTime(iso: string): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Author handle from a tweet URL (x.com/<handle>/status/...). */
function handleFromUrl(url: string): string | null {
  const m = url.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})(?:[/?#]|$)/i);
  return m ? m[1] : null;
}

const clamp2 = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
};

export default function LatestTweets({
  tweets,
  accent,
  updatedAt,
}: {
  tweets: TweetMetric[];
  accent: string;
  updatedAt?: string;
}) {
  const [sort, setSort] = useState<SortKey>("createdAt");

  const sorted = useMemo(() => {
    const arr = [...tweets];
    arr.sort((a, b) =>
      sort === "createdAt"
        ? b.createdAt > a.createdAt
          ? 1
          : b.createdAt < a.createdAt
            ? -1
            : 0
        : (b[sort] ?? 0) - (a[sort] ?? 0)
    );
    return arr;
  }, [tweets, sort]);

  return (
    <div className="flex flex-col rounded-xl border border-makina-border bg-makina-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-makina-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-makina-text">Latest posts &amp; metrics</h3>
          <p className="text-[11px] text-makina-subtle">
            Real per-post numbers{updatedAt ? ` · ${relTime(updatedAt)}` : ""}
          </p>
        </div>
        {tweets.length > 0 && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-makina-border bg-makina-surface px-2 py-1 text-[11px] text-makina-text outline-none transition-colors hover:border-makina-accent/40 focus:border-makina-accent/60"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {tweets.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-makina-muted">
          No posts captured yet. Run Collect now.
        </div>
      ) : (
        <ul className="divide-y divide-makina-border/60 overflow-y-auto" style={{ maxHeight: 380 }}>
          {sorted.map((t) => {
            const handle = handleFromUrl(t.url || "");
            return (
            <li key={t.id}>
              <a
                href={t.url || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="group block px-4 py-3 transition-colors hover:bg-makina-surface/40"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {handle && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-makina-surface px-1.5 py-0.5 text-[10px] font-semibold text-makina-text/80">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
                        @{handle}
                      </span>
                    )}
                    <span className="truncate text-[11px] text-makina-subtle">{relTime(t.createdAt)}</span>
                  </div>
                  <ExternalLink size={12} className="shrink-0 text-makina-subtle transition-colors group-hover:text-makina-accent" />
                </div>
                <p className="mb-2.5 text-[13px] leading-snug text-makina-text/90" style={clamp2}>
                  {t.text || "(no text)"}
                </p>
                <div
                  className="mb-2 flex items-center gap-1.5 rounded-md px-1.5 py-1"
                  style={{ backgroundColor: `${accent}14`, boxShadow: sort === "impressions" ? `inset 0 0 0 1px ${accent}` : undefined }}
                >
                  <Eye size={14} style={{ color: accent }} />
                  <span className="text-base font-bold leading-none tabular-nums" style={{ color: accent }}>
                    {formatCount(t.impressions || 0)}
                  </span>
                  <span className="text-[11px] text-makina-subtle">impressions</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {ENGAGE.map((m) => {
                    const on = sort === m.key;
                    return (
                      <span
                        key={m.key}
                        title={m.label}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                        style={{
                          backgroundColor: `${m.color}1f`,
                          color: m.color,
                          boxShadow: on ? `inset 0 0 0 1px ${m.color}` : undefined,
                        }}
                      >
                        <m.Icon size={11} />
                        {formatCount(t[m.key] ?? 0)}
                      </span>
                    );
                  })}
                </div>
              </a>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

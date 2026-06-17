"use client";

import { useMemo, useState, type ComponentType } from "react";
import { Eye, Heart, MessageCircle, Repeat2, Quote, Bookmark, ExternalLink } from "lucide-react";
import { formatCount } from "@/components/competitors/platformMeta";
import { type TweetMetric } from "@/lib/makina/journal";

type MetricKey = "impressions" | "likes" | "replies" | "reposts" | "quotes" | "bookmarks";
type SortKey = "createdAt" | MetricKey;

const METRICS: { key: MetricKey; label: string; Icon: ComponentType<{ size?: number }> }[] = [
  { key: "impressions", label: "Impressions", Icon: Eye },
  { key: "likes", label: "Likes", Icon: Heart },
  { key: "replies", label: "Replies", Icon: MessageCircle },
  { key: "reposts", label: "Reposts", Icon: Repeat2 },
  { key: "quotes", label: "Quotes", Icon: Quote },
  { key: "bookmarks", label: "Bookmarks", Icon: Bookmark },
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
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const clamp3 = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
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
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-makina-muted">Latest posts</p>
          <p className="mt-0.5 text-[11px] text-makina-subtle">
            Real per-post numbers from the last scrape{updatedAt ? ` · ${relTime(updatedAt)}` : ""}.
          </p>
        </div>
        {tweets.length > 0 && (
          <label className="inline-flex items-center gap-1.5 text-[11px] text-makina-muted">
            Sort
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
          </label>
        )}
      </div>

      {tweets.length === 0 ? (
        <div className="rounded-xl border border-makina-border bg-makina-card p-6 text-center text-sm text-makina-muted">
          No posts captured yet — hit “Collect now” and they’ll appear here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((t, i) => (
            <a
              key={t.id}
              href={t.url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-xl border border-makina-border bg-makina-card p-3.5 transition-all hover-lift hover:border-makina-accent/40 animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i * 30, 240)}ms` }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-makina-subtle">{relTime(t.createdAt)}</span>
                <ExternalLink size={12} className="shrink-0 text-makina-subtle transition-colors group-hover:text-makina-accent" />
              </div>
              <p className="mb-3 text-[13px] leading-snug text-makina-text/90" style={clamp3}>
                {t.text || "(no text)"}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-makina-border/50 pt-2.5">
                {METRICS.map((m) => {
                  const on = sort === m.key;
                  return (
                    <span
                      key={m.key}
                      title={m.label}
                      className={`inline-flex items-center gap-1 text-[11px] tabular-nums ${on ? "font-semibold" : "text-makina-muted"}`}
                      style={on ? { color: accent } : undefined}
                    >
                      <m.Icon size={12} />
                      {formatCount(t[m.key] ?? 0)}
                    </span>
                  );
                })}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

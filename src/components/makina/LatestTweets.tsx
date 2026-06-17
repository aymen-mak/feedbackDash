"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Quote,
  Bookmark,
  ExternalLink,
  ArrowUpDown,
} from "lucide-react";
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

function relTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
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
    <div className="rounded-xl border border-makina-border bg-makina-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-makina-text">Latest posts &amp; their metrics</h3>
          <p className="text-[11px] text-makina-subtle">
            Each post from the most recent scrape{updatedAt ? ` · refreshed ${relTime(updatedAt)}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-0.5 inline-flex items-center gap-1 text-[11px] text-makina-muted">
            <ArrowUpDown size={11} /> Sort
          </span>
          <SortChip active={sort === "createdAt"} accent={accent} onClick={() => setSort("createdAt")}>
            Recent
          </SortChip>
          {METRICS.map((m) => (
            <SortChip key={m.key} active={sort === m.key} accent={accent} onClick={() => setSort(m.key)}>
              {m.label}
            </SortChip>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="border-t border-makina-border px-4 py-8 text-center text-sm text-makina-muted">
          No posts captured yet — hit “Collect now”.
        </div>
      ) : (
        <ul className="divide-y divide-makina-border/60 border-t border-makina-border">
          {sorted.map((t) => (
            <li key={t.id} className="px-4 py-3 transition-colors hover:bg-makina-surface/40">
              <div className="mb-1 flex items-center gap-2 text-[11px] text-makina-subtle">
                <span>{relTime(t.createdAt) || "—"}</span>
                {t.url && (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-makina-accent"
                  >
                    View on X <ExternalLink size={10} />
                  </a>
                )}
              </div>
              <p className="mb-2 text-sm text-makina-text/90" style={clamp2}>
                {t.text || "(no text)"}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SortChip({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  accent: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
        active ? "border-transparent text-makina-bg" : "border-makina-border text-makina-muted hover:text-makina-text"
      }`}
      style={active ? { backgroundColor: accent } : undefined}
    >
      {children}
    </button>
  );
}

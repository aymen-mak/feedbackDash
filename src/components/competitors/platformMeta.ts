import { type Platform, type Presence, type Competitor } from "@/lib/competitors/types";

// Platforms that represent a human audience (GitHub = devs, on-chain = capital
// are excluded). Their sum is a concrete, data-driven "community reach" — the
// informative replacement for the old arbitrary 0–100 strength score.
const AUDIENCE_PLATFORMS: Platform[] = ["twitter", "discord", "telegram", "linkedin"];

export function audience(c: Competitor): number {
  return c.platforms.reduce(
    (sum, p) =>
      sum +
      (AUDIENCE_PLATFORMS.includes(p.platform) && p.value != null && !p.reachExcluded ? p.value : 0),
    0
  );
}

// Brand colours + short labels for each platform (no brand-icon imports, which
// lucide has been deprecating — colour + label is stable and on-theme).
export const PLATFORM_META: Record<Platform, { short: string; color: string }> = {
  twitter: { short: "X", color: "#1d9bf0" },
  linkedin: { short: "LinkedIn", color: "#0a66c2" },
  discord: { short: "Discord", color: "#5865f2" },
  telegram: { short: "Telegram", color: "#229ed9" },
  reddit: { short: "Reddit", color: "#ff4500" },
  github: { short: "GitHub", color: "#8b949e" },
  youtube: { short: "YouTube", color: "#ff0000" },
  website: { short: "Web", color: "#10b981" },
  other: { short: "Other", color: "#94a3b8" },
};

/** 33300 → "33.3K", 125700 → "125.7K", 70000 → "70K", 53 → "53". */
export function formatCount(v: number | null | undefined): string {
  if (v == null) return "N/A";
  if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1) + "K";
  return String(v);
}

/** Short label when there is no numeric value, based on presence. */
export function presenceShort(presence: Presence): string {
  switch (presence) {
    case "none":
      return "None";
    case "external":
      return "Ext.";
    case "inactive":
      return "Dormant";
    default:
      return "N/A";
  }
}

/** Whether a platform with no value should render in a muted/struck style. */
export function isAbsent(presence: Presence): boolean {
  return presence === "none" || presence === "inactive" || presence === "external";
}

const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 700000000 → "$700M", 1500000000 → "$1.5B", 53 → "$53". */
export function formatUsd(v: number | null | undefined): string {
  return v == null ? "N/A" : USD_COMPACT.format(v);
}

/** Signed percentage, e.g. "+3.2%", "-1.0%", "" when null. */
export function signedPct(v: number | null | undefined): string {
  if (v == null) return "";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export type Health = "fresh" | "recent" | "stale" | "error" | "none";

export const HEALTH_COLOR: Record<Health, string> = {
  fresh: "#22c55e",
  recent: "#5b9cf6",
  stale: "#f59e0b",
  error: "#ef4444",
  none: "#64748b",
};

/** Monitoring freshness/health from a last-updated timestamp + optional error. */
export function freshness(
  lastUpdated: string | null | undefined,
  lastError?: string | null
): { health: Health; label: string } {
  if (lastError) return { health: "error", label: "error" };
  if (!lastUpdated) return { health: "none", label: "no data" };
  const ageH = (Date.now() - new Date(lastUpdated).getTime()) / 3_600_000;
  if (Number.isNaN(ageH)) return { health: "none", label: "no data" };
  if (ageH < 24) return { health: "fresh", label: timeAgo(lastUpdated) };
  if (ageH < 24 * 7) return { health: "recent", label: timeAgo(lastUpdated) };
  return { health: "stale", label: timeAgo(lastUpdated) };
}

/** Compact relative time, e.g. "3h ago", "2d ago", "just now". */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

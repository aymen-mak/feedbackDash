import { type Platform, type Presence } from "@/lib/competitors/types";

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

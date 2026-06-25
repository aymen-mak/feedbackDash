// Neutral formatting helpers shared across every tool. Lives here (not under a
// feature folder) so no tool has to import from another tool's module.

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

/** 33300 → "33.3K", 70000 → "70K", 53 → "53". */
export function formatCount(v: number | null | undefined): string {
  if (v == null) return "N/A";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1) + "K";
  return String(v);
}

/** Signed percentage, e.g. "+3.2%", "-1.0%", "" when null. Input is already a percent. */
export function signedPct(v: number | null | undefined, digits = 1): string {
  if (v == null) return "";
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
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

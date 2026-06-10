import { type Platform } from "@/lib/competitors/types";

// ── Makina in-depth performance journal ──
// Weekly (or any-period) entries of the metrics we track for our own accounts.
// The headline counts (followers, members, visits) are auto-collected; the deep
// engagement metrics come from each platform's native analytics (X Analytics,
// Telegram channel stats) which are owner-only, so they're entered by hand.

export type MetricKind = "count" | "ratio"; // ratio = a percentage value (e.g. engagement rate)
export type MetricCategory = "Audience" | "Reach" | "Engagement" | "Activity";

export const CATEGORY_ORDER: MetricCategory[] = ["Audience", "Reach", "Engagement", "Activity"];

export interface MetricDef {
  key: string;
  label: string;
  kind: MetricKind;
  category: MetricCategory;
  /** Auto-collected elsewhere (prefilled in the entry form). */
  auto?: boolean;
}

export interface AccountDef {
  key: string;
  label: string;
  short: string;
  platform: Platform;
  handle?: string;
  /** The matching competitor platform whose live value can prefill `auto` metrics. */
  autoMetric?: string;
  metrics: MetricDef[];
}

const X_METRICS: MetricDef[] = [
  { key: "followers", label: "Followers", kind: "count", category: "Audience", auto: true },
  { key: "newFollows", label: "New follows", kind: "count", category: "Audience" },
  { key: "impressions", label: "Impressions", kind: "count", category: "Reach" },
  { key: "profileVisits", label: "Profile visits", kind: "count", category: "Reach" },
  { key: "engagementRate", label: "Engagement rate", kind: "ratio", category: "Engagement" },
  { key: "replies", label: "Replies", kind: "count", category: "Engagement" },
  { key: "likes", label: "Likes", kind: "count", category: "Engagement" },
  { key: "reposts", label: "Reposts", kind: "count", category: "Engagement" },
  { key: "bookmarks", label: "Bookmarks", kind: "count", category: "Engagement" },
  { key: "shares", label: "Shares", kind: "count", category: "Engagement" },
];

export const ACCOUNTS: AccountDef[] = [
  { key: "makinafi", label: "X · @makinafi", short: "@makinafi", platform: "twitter", handle: "@makinafi", autoMetric: "followers", metrics: X_METRICS },
  { key: "makintern", label: "X · @makintern", short: "@makintern", platform: "twitter", handle: "@makintern", metrics: X_METRICS },
  {
    key: "telegram",
    label: "Telegram",
    short: "Telegram",
    platform: "telegram",
    handle: "t.me/makinafinance",
    autoMetric: "members",
    metrics: [
      { key: "members", label: "Member count", kind: "count", category: "Audience", auto: true },
      { key: "messages", label: "Messages", kind: "count", category: "Activity" },
      { key: "viewingMembers", label: "Viewing members", kind: "count", category: "Activity" },
      { key: "postingMembers", label: "Posting members", kind: "count", category: "Activity" },
    ],
  },
  {
    key: "discord",
    label: "Discord",
    short: "Discord",
    platform: "discord",
    handle: "discord.gg/makinafi",
    autoMetric: "members",
    metrics: [
      { key: "members", label: "Member count", kind: "count", category: "Audience", auto: true },
      { key: "online", label: "Online", kind: "count", category: "Audience" },
      { key: "messages", label: "Messages", kind: "count", category: "Activity" },
    ],
  },
  {
    key: "website",
    label: "Website",
    short: "Website",
    platform: "website",
    handle: "makina.finance",
    autoMetric: "monthlyVisits",
    metrics: [
      { key: "monthlyVisits", label: "Monthly visits", kind: "count", category: "Audience", auto: true },
      { key: "uniqueVisitors", label: "Unique visitors", kind: "count", category: "Audience" },
      { key: "avgVisitSec", label: "Avg visit (sec)", kind: "count", category: "Engagement" },
      { key: "signups", label: "App sign-ups", kind: "count", category: "Engagement" },
    ],
  },
];

export interface JournalEntry {
  account: string;
  /** ISO date (YYYY-MM-DD) marking the start of the tracked period. */
  periodStart: string;
  values: Record<string, number | null>;
  note?: string | null;
  updatedAt: string;
}

export interface MakinaJournal {
  entries: JournalEntry[];
}

export function accountDef(key: string): AccountDef | undefined {
  return ACCOUNTS.find((a) => a.key === key);
}

/** Monday (UTC) of the week containing `d`, as YYYY-MM-DD — the default period. */
export function defaultWeekStart(d: Date = new Date()): string {
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff))
    .toISOString()
    .slice(0, 10);
}

/** "Dec 1" / "Dec 1, '24" label for a period start. */
export function periodLabel(periodStart: string): string {
  const d = new Date(periodStart + "T00:00:00Z");
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions =
    d.getUTCFullYear() === now.getUTCFullYear()
      ? { month: "short", day: "numeric", timeZone: "UTC" }
      : { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" };
  return d.toLocaleDateString("en-US", opts);
}

/** Relative % change cur vs prev, null when not computable. */
export function pctChange(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

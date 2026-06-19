import { type Platform } from "@/lib/competitors/types";

// ── Makina in-depth performance journal ──
// Weekly (or any-period) entries of the metrics we track for our own accounts.
// X metrics are auto-collected (followers + per-post engagement scraped via
// Apify/scweet; new-follows and engagement-rate derived). No X metric is manual.

export type MetricKind = "count" | "ratio"; // ratio = a percentage value (e.g. engagement rate)
export type MetricCategory = "Audience" | "Reach" | "Engagement" | "Activity";

export const CATEGORY_ORDER: MetricCategory[] = ["Audience", "Reach", "Engagement", "Activity"];

/** One-line, plain-language intro shown under each section heading. */
export const CATEGORY_INFO: Record<MetricCategory, string> = {
  Audience: "Who follows you, and how that base is growing.",
  Reach: "How many people your content reached this week.",
  Engagement: "How people interacted with what you posted.",
  Activity: "How active the community itself is.",
};

export interface MetricDef {
  key: string;
  label: string;
  kind: MetricKind;
  category: MetricCategory;
  /** Plain-language explanation of what the number means. */
  description: string;
  /** Auto-collected (never entered by hand). */
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
  { key: "followers", label: "Followers", kind: "count", category: "Audience", auto: true, description: "Accounts following this handle." },
  { key: "newFollows", label: "Net new follows", kind: "count", category: "Audience", auto: true, description: "Net follower change vs the previous period." },
  { key: "impressions", label: "Impressions", kind: "count", category: "Reach", auto: true, description: "Views across posts published this period." },
  { key: "engagementRate", label: "Engagement rate", kind: "ratio", category: "Engagement", auto: true, description: "Engagements ÷ impressions." },
  { key: "likes", label: "Likes", kind: "count", category: "Engagement", auto: true, description: "Likes on this period's posts." },
  { key: "replies", label: "Replies", kind: "count", category: "Engagement", auto: true, description: "Replies on this period's posts." },
  { key: "reposts", label: "Reposts", kind: "count", category: "Engagement", auto: true, description: "Reposts of this period's posts." },
  { key: "shares", label: "Quotes", kind: "count", category: "Engagement", auto: true, description: "Quote-posts of this period's posts." },
  { key: "bookmarks", label: "Bookmarks", kind: "count", category: "Engagement", auto: true, description: "Bookmarks on this period's posts." },
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
      { key: "members", label: "Member count", kind: "count", category: "Audience", auto: true, description: "Total members in the channel." },
      { key: "newMembers", label: "Net new members", kind: "count", category: "Audience", auto: true, description: "Net member change vs the previous period." },
      { key: "views", label: "Views", kind: "count", category: "Reach", auto: true, description: "Total views on posts published this period." },
      { key: "posts", label: "Posts", kind: "count", category: "Activity", auto: true, description: "Posts published this period." },
      { key: "avgViews", label: "Avg views / post", kind: "count", category: "Reach", auto: true, description: "Average views per post this period." },
      { key: "reachRate", label: "Reach rate", kind: "ratio", category: "Reach", auto: true, description: "Average post views as a share of members." },
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
      { key: "members", label: "Member count", kind: "count", category: "Audience", auto: true, description: "Total members in the server." },
      { key: "online", label: "Online", kind: "count", category: "Audience", description: "Members online right now." },
      { key: "messages", label: "Messages", kind: "count", category: "Activity", description: "Messages posted in the server this period." },
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
      { key: "monthlyVisits", label: "Monthly visits", kind: "count", category: "Audience", auto: true, description: "Total visits over the trailing month." },
      { key: "uniqueVisitors", label: "Unique visitors", kind: "count", category: "Audience", description: "Distinct people who visited this period." },
      { key: "avgVisitSec", label: "Avg visit (sec)", kind: "count", category: "Engagement", description: "Average time on site per visit, in seconds." },
      { key: "signups", label: "App sign-ups", kind: "count", category: "Engagement", description: "New app sign-ups this period." },
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

// ── Latest per-post metrics (cached from the last scrape, not live) ──
export interface TweetMetric {
  id: string;
  url: string;
  text: string;
  createdAt: string; // ISO
  impressions: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  bookmarks: number;
}

export interface MakinaTweets {
  /** Keyed by account key, e.g. "makinafi". */
  byAccount: Record<string, { tweets: TweetMetric[]; updatedAt: string }>;
}

export function accountDef(key: string): AccountDef | undefined {
  return ACCOUNTS.find((a) => a.key === key);
}

/** Monday (UTC) of the week containing `d`, as YYYY-MM-DD, the default period. */
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

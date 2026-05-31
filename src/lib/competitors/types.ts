// ── Competitor community tracker — shared types ──

export type Platform =
  | "twitter"
  | "linkedin"
  | "discord"
  | "telegram"
  | "reddit"
  | "github"
  | "youtube"
  | "other";

export const PLATFORMS: Platform[] = [
  "twitter",
  "linkedin",
  "discord",
  "telegram",
  "reddit",
  "github",
  "youtube",
  "other",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  discord: "Discord",
  telegram: "Telegram",
  reddit: "Reddit",
  github: "GitHub",
  youtube: "YouTube",
  other: "Other",
};

/** The unit a platform's headline metric represents (for labels). */
export const PLATFORM_METRIC_UNIT: Record<Platform, string> = {
  twitter: "followers",
  linkedin: "followers",
  discord: "members",
  telegram: "subscribers",
  reddit: "members",
  github: "followers",
  youtube: "subscribers",
  other: "followers",
};

/** Whether a platform supports free auto-collection (see collectors.ts). */
export const PLATFORM_AUTO_SUPPORTED: Record<Platform, boolean> = {
  twitter: true, // best-effort web scrape via reader proxy (no free API)
  linkedin: true, // best-effort web scrape of the public company page
  discord: true, // invite endpoint with_counts
  telegram: true, // public channel page scrape
  reddit: true, // about.json
  github: true, // public users API
  youtube: false, // needs API key
  other: false,
};

/** Hint shown in the editor for what to put in `autoKey` per platform. */
export const PLATFORM_AUTOKEY_HINT: Record<Platform, string> = {
  twitter: "handle without @ (best-effort web scrape)",
  linkedin: "company slug (best-effort web scrape)",
  discord: "invite code (the part after discord.gg/)",
  telegram: "channel username (no @)",
  reddit: "subreddit (no r/)",
  github: "org or user slug",
  youtube: "manual only",
  other: "manual only",
};

export type MetricSource = "auto" | "manual";

/**
 * Presence quality for a platform:
 * - active:   real, in-use channel
 * - inactive: exists but dormant / sunsetted
 * - none:     no presence at all
 * - external: rolls up under a parent/other entity (e.g. Flux under Ondo DAO)
 * - unknown:  not yet assessed
 */
export type Presence = "active" | "inactive" | "none" | "external" | "unknown";

export const PRESENCE_LABELS: Record<Presence, string> = {
  active: "Active",
  inactive: "Dormant",
  none: "None",
  external: "External",
  unknown: "Unknown",
};

export interface PlatformMetric {
  platform: Platform;
  /** Display handle/identifier (e.g. @MidasRWA, channel name, invite, org). */
  handle: string | null;
  /** Canonical URL. */
  url: string | null;
  /**
   * Key passed to the auto-collector to fetch a live value. When null, this
   * platform is manual-only. Meaning depends on platform — see
   * PLATFORM_AUTOKEY_HINT and collectors.ts.
   */
  autoKey: string | null;
  /** Latest headline metric value; null = N/A. */
  value: number | null;
  presence: Presence;
  source: MetricSource;
  /** Per-platform qualitative note. */
  note: string | null;
  /** ISO timestamp of last value update. */
  lastUpdated: string | null;
  /** Last auto-collector error message, if any. */
  lastError: string | null;
}

/** On-chain metrics sourced from DefiLlama (free API). */
export interface OnchainMetrics {
  tvl: number | null;
  tvlChange1d: number | null; // percent
  tvlChange7d: number | null; // percent
  mcap: number | null;
  fees24h: number | null;
  fees7d: number | null;
  fees30d: number | null;
  revenue24h: number | null;
  revenue30d: number | null;
  /** Recent daily TVL points for the sparkline (capped, oldest→newest). */
  tvlSeries: { t: string; v: number }[];
  lastUpdated: string | null;
  lastError: string | null;
}

export function emptyOnchain(): OnchainMetrics {
  return {
    tvl: null,
    tvlChange1d: null,
    tvlChange7d: null,
    mcap: null,
    fees24h: null,
    fees7d: null,
    fees30d: null,
    revenue24h: null,
    revenue30d: null,
    tvlSeries: [],
    lastUpdated: null,
    lastError: null,
  };
}

export interface Competitor {
  id: string;
  name: string;
  /** True for Makina itself (the reference row). */
  isSelf: boolean;
  /** Positioning tag, e.g. "Bitcoin LST", "Vault infra", "RWA". */
  segment: string;
  tvl: string | null;
  token: string | null;
  website: string | null;
  /** DefiLlama protocol slug for on-chain metrics; null = none / not listed. */
  defillamaSlug: string | null;
  /** On-chain metrics (DefiLlama); null until first fetch. */
  onchain: OnchainMetrics | null;
  /** Overall qualitative remark (the analyst's read). */
  remark: string;
  /** Community-strength score 0–100 (curated). */
  communityStrength: number;
  platforms: PlatformMetric[];
  createdAt: string;
  updatedAt: string;
}

export interface Snapshot {
  id: string;
  competitorId: string;
  platform: Platform;
  value: number;
  source: MetricSource;
  capturedAt: string;
}

/** Result of a refresh run, per platform that was attempted. */
export interface RefreshResult {
  competitorId: string;
  competitorName: string;
  platform: Platform;
  ok: boolean;
  value: number | null;
  previous: number | null;
  error: string | null;
}

/** Build a PlatformMetric with sane defaults (keeps seed data concise). */
export function makeMetric(
  p: Partial<PlatformMetric> & { platform: Platform }
): PlatformMetric {
  return {
    platform: p.platform,
    handle: p.handle ?? null,
    url: p.url ?? null,
    autoKey: p.autoKey ?? null,
    value: p.value ?? null,
    presence: p.presence ?? "unknown",
    source: p.source ?? "manual",
    note: p.note ?? null,
    lastUpdated: p.lastUpdated ?? null,
    lastError: p.lastError ?? null,
  };
}

/** Fields a client is allowed to change on a competitor via PATCH. */
export interface CompetitorUpdate {
  name?: string;
  segment?: string;
  tvl?: string | null;
  token?: string | null;
  website?: string | null;
  defillamaSlug?: string | null;
  remark?: string;
  communityStrength?: number;
  platforms?: PlatformMetric[];
}

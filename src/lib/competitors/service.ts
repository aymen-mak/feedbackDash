import { hasPostgres } from "@/lib/db";
import {
  type Competitor,
  type CompetitorUpdate,
  type PlatformMetric,
  type Platform,
  type Presence,
  type Snapshot,
  type RefreshResult,
  type OnchainMetrics,
  PLATFORMS,
  makeMetric,
  emptyOnchain,
} from "./types";
import { competitorSeed, SEED_DATE } from "./seed";
import { COLLECTORS, fetchDefillama } from "./collectors";

export interface OnchainRefresh {
  competitorId: string;
  competitorName: string;
  slug: string;
  ok: boolean;
  tvl: number | null;
  error: string | null;
}

export interface RefreshSummary {
  results: RefreshResult[];
  onchain: OnchainRefresh[];
}

const TVL_SERIES_CAP = 90;

/** Merge a DefiLlama fetch into a competitor's onchain block (in place). */
function applyDefillama(
  c: Competitor,
  res: Awaited<ReturnType<typeof fetchDefillama>>,
  now: string,
  today: string
): OnchainMetrics {
  const oc = c.onchain ?? emptyOnchain();
  if (!res.ok) {
    oc.lastError = res.error;
    return oc;
  }
  oc.tvl = res.tvl;
  oc.tvlChange1d = res.tvlChange1d;
  oc.tvlChange7d = res.tvlChange7d;
  oc.mcap = res.mcap;
  oc.fees24h = res.fees24h;
  oc.fees7d = res.fees7d;
  oc.fees30d = res.fees30d;
  oc.revenue24h = res.revenue24h;
  oc.revenue30d = res.revenue30d;
  oc.lastUpdated = now;
  oc.lastError = res.error; // may carry a soft note like "no TVL history"

  // Seed the sparkline from history on first fetch, else append today's point.
  if (oc.tvlSeries.length === 0 && res.history.length) {
    oc.tvlSeries = res.history.slice(-TVL_SERIES_CAP);
  } else if (res.tvl != null) {
    const last = oc.tvlSeries[oc.tvlSeries.length - 1];
    if (!last || last.t !== today) oc.tvlSeries.push({ t: today, v: res.tvl });
    else last.v = res.tvl;
    if (oc.tvlSeries.length > TVL_SERIES_CAP) oc.tvlSeries = oc.tvlSeries.slice(-TVL_SERIES_CAP);
  }
  return oc;
}
import {
  fileSeedIfEmpty,
  fileListCompetitors,
  fileGetCompetitor,
  fileUpsertCompetitor,
  fileDeleteCompetitor,
  fileGetSnapshots,
  fileAddSnapshots,
  fileGetVersion,
  fileSetVersion,
} from "./store";
import {
  pgSeedCompetitorsIfEmpty,
  pgListCompetitors,
  pgGetCompetitor,
  pgUpsertCompetitor,
  pgDeleteCompetitor,
  pgGetCompetitorSnapshots,
  pgAddCompetitorSnapshots,
  pgGetVersion,
  pgSetVersion,
} from "./db";

// Backend-agnostic facade. Chooses Postgres when configured, file/memory
// otherwise, and owns id generation, seeding, and snapshot-on-change logic so
// the API routes stay thin.

let idCounter = 0;
function genId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || genId("c")
  );
}

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function defaultPlatforms(): PlatformMetric[] {
  return (["twitter", "linkedin", "discord", "telegram"] as Platform[]).map((platform) =>
    makeMetric({ platform, presence: "unknown" })
  );
}

const PRESENCES: Presence[] = ["active", "inactive", "none", "external", "unknown"];

/** Coerce untrusted client input into well-formed PlatformMetric[]. */
export function sanitizePlatforms(input: unknown): PlatformMetric[] {
  if (!Array.isArray(input)) return [];
  const out: PlatformMetric[] = [];
  const seen = new Set<Platform>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const platform = r.platform as Platform;
    if (!PLATFORMS.includes(platform) || seen.has(platform)) continue;
    seen.add(platform);
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    out.push(
      makeMetric({
        platform,
        handle: str(r.handle),
        url: str(r.url),
        autoKey: str(r.autoKey),
        value:
          typeof r.value === "number" && Number.isFinite(r.value)
            ? Math.max(0, Math.round(r.value))
            : null,
        presence: PRESENCES.includes(r.presence as Presence)
          ? (r.presence as Presence)
          : "unknown",
        source: r.source === "auto" ? "auto" : "manual",
        note: str(r.note),
        lastUpdated: str(r.lastUpdated),
        lastError: str(r.lastError),
      })
    );
  }
  return out;
}

/** Derive initial snapshots from any seeded non-null platform values. */
function seedSnapshots(competitors: Competitor[]): Snapshot[] {
  const snaps: Snapshot[] = [];
  for (const c of competitors) {
    for (const p of c.platforms) {
      if (p.value == null) continue;
      snaps.push({
        id: genId("snap"),
        competitorId: c.id,
        platform: p.platform,
        value: p.value,
        source: p.source,
        capturedAt: p.lastUpdated ?? c.createdAt,
      });
    }
  }
  return snaps;
}

// Bump to force a one-time reset of auto-collected values on next boot
// (used to flush values captured by older buggy collectors).
const DATA_VERSION = 2;

let bootstrapped = false;
async function ensureSeeded() {
  if (bootstrapped) return;
  const seed = competitorSeed();
  const snaps = seedSnapshots(seed);
  if (hasPostgres()) await pgSeedCompetitorsIfEmpty(seed, snaps);
  else fileSeedIfEmpty(seed, snaps);
  await migrate(seed);
  bootstrapped = true;
}

/**
 * Heal already-seeded stores so older rows pick up new identifiers without
 * losing collected values. Idempotent & safe to run on every cold start:
 *  - removes the obsolete self/reference row (Makina),
 *  - backfills `defillamaSlug` and per-platform `autoKey` from the seed,
 *  - adds platforms present in the seed but missing on the stored row,
 *  - ensures the `onchain` key exists.
 */
async function migrate(seed: Competitor[]) {
  const all = hasPostgres() ? await pgListCompetitors() : fileListCompetitors();
  const ver = hasPostgres() ? await pgGetVersion() : fileGetVersion();
  const needsReset = ver < DATA_VERSION;
  const seedById = new Map(seed.map((s) => [s.id, s]));

  for (const c of all) {
    if (c.isSelf || c.id === "makina") {
      if (hasPostgres()) await pgDeleteCompetitor(c.id);
      else fileDeleteCompetitor(c.id);
      continue;
    }
    let changed = false;

    // One-time reset: drop auto-collected values captured by older buggy
    // parsers (e.g. "208 members" → 208M) so they re-collect cleanly.
    if (needsReset) {
      for (const p of c.platforms) {
        if (p.source === "auto" && p.value != null) {
          p.value = null;
          p.lastUpdated = null;
          p.lastError = null;
          changed = true;
        }
      }
    }

    const s = seedById.get(c.id);
    if (s) {
      if (!c.defillamaSlug && s.defillamaSlug) {
        c.defillamaSlug = s.defillamaSlug;
        changed = true;
      }
      if (c.onchain === undefined) {
        c.onchain = null;
        changed = true;
      }
      for (const sp of s.platforms) {
        const cp = c.platforms.find((p) => p.platform === sp.platform);
        if (!cp) {
          c.platforms.push(sp);
          changed = true;
          continue;
        }
        if (!cp.autoKey && sp.autoKey) {
          cp.autoKey = sp.autoKey;
          changed = true;
        }
        // Scrub stale hardcoded seed counts (never freshly collected or edited).
        if (cp.value != null && cp.source === "manual" && cp.lastUpdated === SEED_DATE) {
          cp.value = null;
          cp.lastUpdated = null;
          changed = true;
        }
      }
    }

    if (changed) {
      if (hasPostgres()) await pgUpsertCompetitor(c);
      else fileUpsertCompetitor(c);
    }
  }

  if (needsReset) {
    if (hasPostgres()) await pgSetVersion(DATA_VERSION);
    else fileSetVersion(DATA_VERSION);
  }
}

// ── Reads ──

export async function listCompetitors(): Promise<Competitor[]> {
  await ensureSeeded();
  return hasPostgres() ? pgListCompetitors() : fileListCompetitors();
}

export async function getCompetitor(id: string): Promise<Competitor | null> {
  await ensureSeeded();
  return hasPostgres() ? pgGetCompetitor(id) : fileGetCompetitor(id);
}

export async function getHistory(id?: string, platform?: Platform): Promise<Snapshot[]> {
  await ensureSeeded();
  return hasPostgres()
    ? pgGetCompetitorSnapshots(id, platform)
    : fileGetSnapshots(id, platform);
}

// ── Writes ──

async function persist(c: Competitor): Promise<Competitor> {
  return hasPostgres() ? pgUpsertCompetitor(c) : Promise.resolve(fileUpsertCompetitor(c));
}

async function addSnapshots(snaps: Snapshot[]) {
  if (snaps.length === 0) return;
  if (hasPostgres()) await pgAddCompetitorSnapshots(snaps);
  else fileAddSnapshots(snaps);
}

/** Append a snapshot for each platform whose numeric value changed. */
async function recordChangedSnapshots(c: Competitor, oldPlatforms: PlatformMetric[]) {
  const snaps: Snapshot[] = [];
  const now = new Date().toISOString();
  for (const p of c.platforms) {
    if (p.value == null) continue;
    const old = oldPlatforms.find((o) => o.platform === p.platform);
    if (old && old.value === p.value) continue;
    snaps.push({
      id: genId("snap"),
      competitorId: c.id,
      platform: p.platform,
      value: p.value,
      source: p.source,
      capturedAt: p.lastUpdated ?? now,
    });
  }
  await addSnapshots(snaps);
}

export async function createCompetitor(input: {
  name: string;
  segment?: string;
  tvl?: string | null;
  token?: string | null;
  website?: string | null;
  defillamaSlug?: string | null;
  remark?: string;
  communityStrength?: number;
  platforms?: PlatformMetric[];
}): Promise<Competitor> {
  await ensureSeeded();
  const now = new Date().toISOString();
  let id = slugify(input.name);
  const clash = hasPostgres() ? await pgGetCompetitor(id) : fileGetCompetitor(id);
  if (clash) id = `${id}-${genId("x").slice(-4)}`;

  const platforms = input.platforms ? sanitizePlatforms(input.platforms) : [];
  const c: Competitor = {
    id,
    name: input.name.trim() || "Untitled",
    isSelf: false,
    segment: input.segment ?? "",
    tvl: input.tvl ?? null,
    token: input.token ?? null,
    website: input.website ?? null,
    defillamaSlug: input.defillamaSlug ?? null,
    onchain: null,
    remark: input.remark ?? "",
    communityStrength: clampScore(input.communityStrength ?? 0),
    platforms: platforms.length ? platforms : defaultPlatforms(),
    createdAt: now,
    updatedAt: now,
  };
  await persist(c);
  await recordChangedSnapshots(c, []);
  return c;
}

export async function patchCompetitor(
  id: string,
  update: CompetitorUpdate
): Promise<Competitor | null> {
  await ensureSeeded();
  const existing = hasPostgres() ? await pgGetCompetitor(id) : fileGetCompetitor(id);
  if (!existing) return null;
  const oldPlatforms = existing.platforms;
  const now = new Date().toISOString();
  const incomingPlatforms = update.platforms ? sanitizePlatforms(update.platforms) : undefined;

  const merged: Competitor = {
    ...existing,
    name: update.name ?? existing.name,
    segment: update.segment ?? existing.segment,
    tvl: update.tvl !== undefined ? update.tvl : existing.tvl,
    token: update.token !== undefined ? update.token : existing.token,
    website: update.website !== undefined ? update.website : existing.website,
    defillamaSlug: update.defillamaSlug !== undefined ? update.defillamaSlug : existing.defillamaSlug,
    remark: update.remark ?? existing.remark,
    communityStrength:
      update.communityStrength !== undefined
        ? clampScore(update.communityStrength)
        : existing.communityStrength,
    platforms: incomingPlatforms ?? existing.platforms,
    updatedAt: now,
  };

  // Stamp lastUpdated on platforms whose value changed in this edit.
  if (incomingPlatforms) {
    merged.platforms = incomingPlatforms.map((p) => {
      const old = oldPlatforms.find((o) => o.platform === p.platform);
      const valueChanged = (old?.value ?? null) !== (p.value ?? null);
      return {
        ...p,
        lastUpdated:
          valueChanged && p.value != null
            ? now
            : p.lastUpdated ?? old?.lastUpdated ?? null,
      };
    });
  }

  await persist(merged);
  await recordChangedSnapshots(merged, oldPlatforms);
  return merged;
}

export async function removeCompetitor(id: string): Promise<boolean> {
  await ensureSeeded();
  return hasPostgres() ? pgDeleteCompetitor(id) : Promise.resolve(fileDeleteCompetitor(id));
}

// ── Auto-collection ──

/**
 * Run every available collector for every platform that has an `autoKey`,
 * update the stored value, and append a snapshot for each successful fetch so
 * the time series grows. Failure-tolerant: on error the previous value is kept
 * and `lastError` is recorded. Returns a per-platform summary of the run.
 */
export async function refreshAll(): Promise<RefreshSummary> {
  await ensureSeeded();
  const competitors = hasPostgres() ? await pgListCompetitors() : fileListCompetitors();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Social tasks: every auto-enabled (competitor, platform). `p` is a live
  // reference into `c.platforms`, so writing to it updates the competitor.
  const socialTasks: { c: Competitor; p: PlatformMetric }[] = [];
  for (const c of competitors) {
    for (const p of c.platforms) {
      if (p.autoKey && COLLECTORS[p.platform]) socialTasks.push({ c, p });
    }
  }
  const llamaTasks = competitors.filter((c) => c.defillamaSlug);

  // Collectors never throw — run everything in parallel; wall time is bounded
  // by the slowest single request.
  const [socialSettled, llamaSettled] = await Promise.all([
    Promise.all(socialTasks.map(async (t) => ({ t, res: await COLLECTORS[t.p.platform]!(t.p.autoKey!) }))),
    Promise.all(llamaTasks.map(async (c) => ({ c, res: await fetchDefillama(c.defillamaSlug!) }))),
  ]);

  const results: RefreshResult[] = [];
  const onchain: OnchainRefresh[] = [];
  const newSnaps: Snapshot[] = [];
  const touched = new Map<string, Competitor>();

  for (const { t, res } of socialSettled) {
    const { c, p } = t;
    const previous = p.value;
    touched.set(c.id, c);

    if (res.error || res.value == null) {
      p.lastError = res.error ?? "no value returned";
      results.push({ competitorId: c.id, competitorName: c.name, platform: p.platform, ok: false, value: null, previous, error: p.lastError });
      continue;
    }

    p.value = res.value;
    p.source = "auto";
    p.lastUpdated = now;
    p.lastError = null;
    newSnaps.push({ id: genId("snap"), competitorId: c.id, platform: p.platform, value: res.value, source: "auto", capturedAt: now });
    results.push({ competitorId: c.id, competitorName: c.name, platform: p.platform, ok: true, value: res.value, previous, error: null });
  }

  for (const { c, res } of llamaSettled) {
    touched.set(c.id, c);
    c.onchain = applyDefillama(c, res, now, today);
    onchain.push({ competitorId: c.id, competitorName: c.name, slug: c.defillamaSlug!, ok: res.ok, tvl: res.tvl, error: res.error });
  }

  for (const c of touched.values()) {
    c.updatedAt = now;
    await persist(c);
  }
  await addSnapshots(newSnaps);

  return { results, onchain };
}

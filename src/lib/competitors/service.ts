import { hasPostgres } from "@/lib/db";
import {
  type Competitor,
  type CompetitorUpdate,
  type PlatformMetric,
  type Platform,
  type Snapshot,
  type RefreshResult,
  makeMetric,
} from "./types";
import { competitorSeed } from "./seed";
import { COLLECTORS } from "./collectors";
import {
  fileSeedIfEmpty,
  fileListCompetitors,
  fileGetCompetitor,
  fileUpsertCompetitor,
  fileDeleteCompetitor,
  fileGetSnapshots,
  fileAddSnapshots,
} from "./store";
import {
  pgSeedCompetitorsIfEmpty,
  pgListCompetitors,
  pgGetCompetitor,
  pgUpsertCompetitor,
  pgDeleteCompetitor,
  pgGetCompetitorSnapshots,
  pgAddCompetitorSnapshots,
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

let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  const seed = competitorSeed();
  const snaps = seedSnapshots(seed);
  if (hasPostgres()) await pgSeedCompetitorsIfEmpty(seed, snaps);
  else fileSeedIfEmpty(seed, snaps);
  seeded = true;
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
  remark?: string;
  communityStrength?: number;
  platforms?: PlatformMetric[];
}): Promise<Competitor> {
  await ensureSeeded();
  const now = new Date().toISOString();
  let id = slugify(input.name);
  const clash = hasPostgres() ? await pgGetCompetitor(id) : fileGetCompetitor(id);
  if (clash) id = `${id}-${genId("x").slice(-4)}`;

  const c: Competitor = {
    id,
    name: input.name.trim() || "Untitled",
    isSelf: false,
    segment: input.segment ?? "",
    tvl: input.tvl ?? null,
    token: input.token ?? null,
    website: input.website ?? null,
    remark: input.remark ?? "",
    communityStrength: clampScore(input.communityStrength ?? 0),
    platforms:
      input.platforms && input.platforms.length ? input.platforms : defaultPlatforms(),
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

  const merged: Competitor = {
    ...existing,
    name: update.name ?? existing.name,
    segment: update.segment ?? existing.segment,
    tvl: update.tvl !== undefined ? update.tvl : existing.tvl,
    token: update.token !== undefined ? update.token : existing.token,
    website: update.website !== undefined ? update.website : existing.website,
    remark: update.remark ?? existing.remark,
    communityStrength:
      update.communityStrength !== undefined
        ? clampScore(update.communityStrength)
        : existing.communityStrength,
    platforms: update.platforms ?? existing.platforms,
    updatedAt: now,
  };

  // Stamp lastUpdated on platforms whose value changed in this edit.
  if (update.platforms) {
    merged.platforms = update.platforms.map((p) => {
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
export async function refreshAll(): Promise<RefreshResult[]> {
  await ensureSeeded();
  const competitors = hasPostgres() ? await pgListCompetitors() : fileListCompetitors();
  const results: RefreshResult[] = [];
  const now = new Date().toISOString();

  for (const c of competitors) {
    let touched = false;
    const newSnaps: Snapshot[] = [];

    for (const p of c.platforms) {
      const collector = p.autoKey ? COLLECTORS[p.platform] : undefined;
      if (!collector || !p.autoKey) continue;

      const previous = p.value;
      const { value, error } = await collector(p.autoKey);
      touched = true;

      if (error || value == null) {
        p.lastError = error ?? "no value returned";
        results.push({
          competitorId: c.id,
          competitorName: c.name,
          platform: p.platform,
          ok: false,
          value: null,
          previous,
          error: p.lastError,
        });
        continue;
      }

      p.value = value;
      p.source = "auto";
      p.lastUpdated = now;
      p.lastError = null;
      newSnaps.push({
        id: genId("snap"),
        competitorId: c.id,
        platform: p.platform,
        value,
        source: "auto",
        capturedAt: now,
      });
      results.push({
        competitorId: c.id,
        competitorName: c.name,
        platform: p.platform,
        ok: true,
        value,
        previous,
        error: null,
      });
    }

    if (touched) {
      c.updatedAt = now;
      await persist(c);
      await addSnapshots(newSnaps);
    }
  }

  return results;
}

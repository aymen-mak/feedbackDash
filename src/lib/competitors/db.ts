import { sql } from "@vercel/postgres";
import { type Competitor, type Snapshot, type Platform } from "./types";
import { type MakinaJournal, type MakinaTweets } from "@/lib/makina/journal";
import { type MakinaDiag } from "@/lib/makina/diagnostics";

// Postgres backend for the competitor tracker. The competitor document is
// stored as JSONB (schema-flexible as the model evolves); snapshots get their
// own typed table for efficient time-series queries.

export async function pgEnsureCompetitorSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS competitors (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS competitor_snapshots (
      id TEXT PRIMARY KEY,
      competitor_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      value INTEGER NOT NULL,
      source TEXT NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_competitor_snapshots
    ON competitor_snapshots (competitor_id, platform, captured_at)
  `;
  await sql`CREATE TABLE IF NOT EXISTS competitor_meta (key TEXT PRIMARY KEY, value TEXT)`;
}

export async function pgGetVersion(): Promise<number> {
  await pgEnsureCompetitorSchema();
  const { rows } = await sql`SELECT value FROM competitor_meta WHERE key = 'version'`;
  return rows.length ? parseInt(rows[0].value as string, 10) || 0 : 0;
}

export async function pgSetVersion(v: number): Promise<void> {
  await pgEnsureCompetitorSchema();
  await sql`
    INSERT INTO competitor_meta (key, value) VALUES ('version', ${String(v)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

// ── Makina performance journal (stored as a single JSON blob in meta) ──
export async function pgGetMakinaJournal(): Promise<MakinaJournal> {
  await pgEnsureCompetitorSchema();
  const { rows } = await sql`SELECT value FROM competitor_meta WHERE key = 'makina_journal'`;
  if (!rows.length) return { entries: [] };
  try {
    return JSON.parse(rows[0].value as string) as MakinaJournal;
  } catch {
    return { entries: [] };
  }
}

export async function pgSetMakinaJournal(journal: MakinaJournal): Promise<void> {
  await pgEnsureCompetitorSchema();
  await sql`
    INSERT INTO competitor_meta (key, value) VALUES ('makina_journal', ${JSON.stringify(journal)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

// ── Latest per-post metrics (single JSON blob in meta) ──
export async function pgGetMakinaTweets(): Promise<MakinaTweets> {
  await pgEnsureCompetitorSchema();
  const { rows } = await sql`SELECT value FROM competitor_meta WHERE key = 'makina_tweets'`;
  if (!rows.length) return { byAccount: {} };
  try {
    return JSON.parse(rows[0].value as string) as MakinaTweets;
  } catch {
    return { byAccount: {} };
  }
}

export async function pgSetMakinaTweets(tweets: MakinaTweets): Promise<void> {
  await pgEnsureCompetitorSchema();
  await sql`
    INSERT INTO competitor_meta (key, value) VALUES ('makina_tweets', ${JSON.stringify(tweets)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

// ── Makina diagnostics (last collection report, single JSON blob) ──
export async function pgGetMakinaDiag(): Promise<MakinaDiag | null> {
  await pgEnsureCompetitorSchema();
  const { rows } = await sql`SELECT value FROM competitor_meta WHERE key = 'makina_diag'`;
  if (!rows.length) return null;
  try {
    return JSON.parse(rows[0].value as string) as MakinaDiag;
  } catch {
    return null;
  }
}

export async function pgSetMakinaDiag(diag: MakinaDiag): Promise<void> {
  await pgEnsureCompetitorSchema();
  await sql`
    INSERT INTO competitor_meta (key, value) VALUES ('makina_diag', ${JSON.stringify(diag)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

function rowToCompetitor(row: Record<string, unknown>): Competitor {
  return row.data as Competitor;
}

function rowToSnapshot(row: Record<string, unknown>): Snapshot {
  return {
    id: row.id as string,
    competitorId: row.competitor_id as string,
    platform: row.platform as Platform,
    value: row.value as number,
    source: row.source as Snapshot["source"],
    capturedAt: (row.captured_at as Date).toISOString(),
  };
}

export async function pgSeedCompetitorsIfEmpty(
  competitors: Competitor[],
  snapshots: Snapshot[]
) {
  await pgEnsureCompetitorSchema();
  const { rows } = await sql`SELECT COUNT(*) AS count FROM competitors`;
  if (parseInt(rows[0].count as string, 10) > 0) return;

  for (const c of competitors) {
    await sql`
      INSERT INTO competitors (id, data, updated_at)
      VALUES (${c.id}, ${JSON.stringify(c)}::jsonb, ${c.updatedAt})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  await pgAddCompetitorSnapshots(snapshots);
}

export async function pgListCompetitors(): Promise<Competitor[]> {
  await pgEnsureCompetitorSchema();
  const { rows } = await sql`SELECT data FROM competitors`;
  return rows.map(rowToCompetitor);
}

export async function pgGetCompetitor(id: string): Promise<Competitor | null> {
  await pgEnsureCompetitorSchema();
  const { rows } = await sql`SELECT data FROM competitors WHERE id = ${id}`;
  return rows.length ? rowToCompetitor(rows[0]) : null;
}

export async function pgUpsertCompetitor(c: Competitor): Promise<Competitor> {
  await pgEnsureCompetitorSchema();
  await sql`
    INSERT INTO competitors (id, data, updated_at)
    VALUES (${c.id}, ${JSON.stringify(c)}::jsonb, ${c.updatedAt})
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
  `;
  return c;
}

export async function pgDeleteCompetitor(id: string): Promise<boolean> {
  await pgEnsureCompetitorSchema();
  await sql`DELETE FROM competitor_snapshots WHERE competitor_id = ${id}`;
  const { rowCount } = await sql`DELETE FROM competitors WHERE id = ${id}`;
  return (rowCount ?? 0) > 0;
}

export async function pgGetCompetitorSnapshots(
  competitorId?: string,
  platform?: Platform
): Promise<Snapshot[]> {
  await pgEnsureCompetitorSchema();
  let rows: Record<string, unknown>[];
  if (competitorId && platform) {
    ({ rows } = await sql`
      SELECT * FROM competitor_snapshots
      WHERE competitor_id = ${competitorId} AND platform = ${platform}
      ORDER BY captured_at ASC
    `);
  } else if (competitorId) {
    ({ rows } = await sql`
      SELECT * FROM competitor_snapshots
      WHERE competitor_id = ${competitorId}
      ORDER BY captured_at ASC
    `);
  } else if (platform) {
    ({ rows } = await sql`
      SELECT * FROM competitor_snapshots
      WHERE platform = ${platform}
      ORDER BY captured_at ASC
    `);
  } else {
    ({ rows } = await sql`
      SELECT * FROM competitor_snapshots
      ORDER BY captured_at ASC
    `);
  }
  return rows.map(rowToSnapshot);
}

export async function pgAddCompetitorSnapshots(snaps: Snapshot[]) {
  if (snaps.length === 0) return;
  await pgEnsureCompetitorSchema();
  for (const s of snaps) {
    await sql`
      INSERT INTO competitor_snapshots (id, competitor_id, platform, value, source, captured_at)
      VALUES (${s.id}, ${s.competitorId}, ${s.platform}, ${s.value}, ${s.source}, ${s.capturedAt})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

import { sql } from "@vercel/postgres";
import type { StoredFeedback, Reply, CategoryId, FeedbackType, FeedbackStatus, Priority } from "./store";

/** Returns true if Postgres is configured */
export function hasPostgres(): boolean {
  return !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

/** Create tables if they don't exist */
export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      user_avatar TEXT NOT NULL DEFAULT '?',
      category TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      quick_action TEXT,
      anonymous BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'new',
      priority TEXT NOT NULL DEFAULT 'none',
      starred BOOLEAN NOT NULL DEFAULT FALSE,
      escalated BOOLEAN NOT NULL DEFAULT FALSE,
      dismissed BOOLEAN NOT NULL DEFAULT FALSE,
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      deleted_at TIMESTAMPTZ,
      upvotes INTEGER NOT NULL DEFAULT 0,
      upvoted_by TEXT[] NOT NULL DEFAULT '{}',
      tags TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS replies (
      id TEXT PRIMARY KEY,
      feedback_id TEXT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function rowToFeedback(row: Record<string, unknown>): StoredFeedback {
  return {
    id: row.id as string,
    userName: row.user_name as string,
    userAvatar: row.user_avatar as string,
    category: row.category as CategoryId,
    type: row.type as FeedbackType,
    message: row.message as string,
    quickAction: (row.quick_action as string) || null,
    anonymous: row.anonymous as boolean,
    status: row.status as FeedbackStatus,
    priority: row.priority as Priority,
    starred: row.starred as boolean,
    escalated: row.escalated as boolean,
    dismissed: row.dismissed as boolean,
    archived: row.archived as boolean,
    deletedAt: row.deleted_at ? (row.deleted_at as Date).toISOString() : null,
    upvotes: row.upvotes as number,
    upvotedBy: (row.upvoted_by as string[]) || [],
    tags: (row.tags as string[]) || [],
    replies: [], // loaded separately
    createdAt: (row.created_at as Date).toISOString(),
  };
}

async function loadReplies(feedbackIds: string[]): Promise<Record<string, Reply[]>> {
  if (feedbackIds.length === 0) return {};
  const idList = feedbackIds as unknown as string;
  const { rows } = await sql`
    SELECT id, feedback_id, message, created_at
    FROM replies
    WHERE feedback_id = ANY(${idList}::text[])
    ORDER BY created_at ASC
  `;
  const map: Record<string, Reply[]> = {};
  for (const r of rows) {
    const fid = r.feedback_id as string;
    if (!map[fid]) map[fid] = [];
    map[fid].push({
      id: r.id as string,
      message: r.message as string,
      createdAt: (r.created_at as Date).toISOString(),
    });
  }
  return map;
}

async function enrichWithReplies(items: StoredFeedback[]): Promise<StoredFeedback[]> {
  const ids = items.map((i) => i.id);
  const repliesMap = await loadReplies(ids);
  return items.map((i) => ({ ...i, replies: repliesMap[i.id] || [] }));
}

// ── Queries ──

export async function pgGetAllFeedback(): Promise<StoredFeedback[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM feedback
    WHERE archived = FALSE AND deleted_at IS NULL
    ORDER BY created_at DESC
  `;
  return enrichWithReplies(rows.map(rowToFeedback));
}

export async function pgGetArchivedFeedback(): Promise<StoredFeedback[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM feedback
    WHERE archived = TRUE AND deleted_at IS NULL
    ORDER BY created_at DESC
  `;
  return enrichWithReplies(rows.map(rowToFeedback));
}

export async function pgGetTrashFeedback(): Promise<StoredFeedback[]> {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM feedback
    WHERE deleted_at IS NOT NULL AND deleted_at > NOW() - INTERVAL '30 days'
    ORDER BY deleted_at DESC
  `;
  return enrichWithReplies(rows.map(rowToFeedback));
}

export async function pgCleanupTrash(): Promise<number> {
  await ensureSchema();
  const { rowCount } = await sql`
    DELETE FROM feedback
    WHERE deleted_at IS NOT NULL AND deleted_at <= NOW() - INTERVAL '30 days'
  `;
  return rowCount ?? 0;
}

export async function pgGetFeedbackById(id: string): Promise<StoredFeedback | null> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM feedback WHERE id = ${id}`;
  if (rows.length === 0) return null;
  const items = await enrichWithReplies([rowToFeedback(rows[0])]);
  return items[0];
}

export async function pgCreateFeedback(data: {
  userName: string;
  userAvatar: string;
  category: CategoryId;
  type: FeedbackType;
  message: string;
  quickAction: string | null;
  anonymous: boolean;
}): Promise<StoredFeedback> {
  await ensureSchema();
  const id = "fb-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const { rows } = await sql`
    INSERT INTO feedback (id, user_name, user_avatar, category, type, message, quick_action, anonymous)
    VALUES (${id}, ${data.userName}, ${data.userAvatar}, ${data.category}, ${data.type}, ${data.message}, ${data.quickAction}, ${data.anonymous})
    RETURNING *
  `;
  return { ...rowToFeedback(rows[0]), replies: [] };
}

export async function pgUpdateFeedback(
  id: string,
  updates: Partial<Pick<StoredFeedback, "status" | "priority" | "starred" | "escalated" | "dismissed" | "archived" | "deletedAt" | "tags">>
): Promise<StoredFeedback | null> {
  await ensureSchema();
  // Build dynamic SET clauses
  const setClauses: string[] = [];
  const vals: unknown[] = [];

  if (updates.status !== undefined) { setClauses.push("status"); vals.push(updates.status); }
  if (updates.priority !== undefined) { setClauses.push("priority"); vals.push(updates.priority); }
  if (updates.starred !== undefined) { setClauses.push("starred"); vals.push(updates.starred); }
  if (updates.escalated !== undefined) { setClauses.push("escalated"); vals.push(updates.escalated); }
  if (updates.dismissed !== undefined) { setClauses.push("dismissed"); vals.push(updates.dismissed); }
  if (updates.archived !== undefined) { setClauses.push("archived"); vals.push(updates.archived); }
  if ("deletedAt" in updates) { setClauses.push("deleted_at"); vals.push(updates.deletedAt ? new Date(updates.deletedAt) : null); }
  if (updates.tags !== undefined) { setClauses.push("tags"); vals.push(updates.tags); }

  if (setClauses.length === 0) return pgGetFeedbackById(id);

  // Use individual updates since @vercel/postgres doesn't support dynamic column names easily
  for (let i = 0; i < setClauses.length; i++) {
    const col = setClauses[i];
    const val = vals[i];
    if (col === "status") await sql`UPDATE feedback SET status = ${val as string} WHERE id = ${id}`;
    else if (col === "priority") await sql`UPDATE feedback SET priority = ${val as string} WHERE id = ${id}`;
    else if (col === "starred") await sql`UPDATE feedback SET starred = ${val as boolean} WHERE id = ${id}`;
    else if (col === "escalated") await sql`UPDATE feedback SET escalated = ${val as boolean} WHERE id = ${id}`;
    else if (col === "dismissed") await sql`UPDATE feedback SET dismissed = ${val as boolean} WHERE id = ${id}`;
    else if (col === "archived") await sql`UPDATE feedback SET archived = ${val as boolean} WHERE id = ${id}`;
    else if (col === "deleted_at") {
      const tsVal = val ? (val as Date).toISOString() : null;
      await sql`UPDATE feedback SET deleted_at = ${tsVal} WHERE id = ${id}`;
    }
    else if (col === "tags") {
      const tagsVal = val as unknown as string;
      await sql`UPDATE feedback SET tags = ${tagsVal}::text[] WHERE id = ${id}`;
    }
  }

  return pgGetFeedbackById(id);
}

export async function pgToggleUpvote(id: string, sessionId: string): Promise<StoredFeedback | null> {
  await ensureSchema();
  const item = await pgGetFeedbackById(id);
  if (!item) return null;

  if (item.upvotedBy.includes(sessionId)) {
    await sql`
      UPDATE feedback
      SET upvoted_by = array_remove(upvoted_by, ${sessionId}),
          upvotes = GREATEST(0, upvotes - 1)
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE feedback
      SET upvoted_by = array_append(upvoted_by, ${sessionId}),
          upvotes = upvotes + 1
      WHERE id = ${id}
    `;
  }

  return pgGetFeedbackById(id);
}

export async function pgAddReply(id: string, message: string): Promise<StoredFeedback | null> {
  await ensureSchema();
  const item = await pgGetFeedbackById(id);
  if (!item) return null;

  const replyId = "re-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await sql`
    INSERT INTO replies (id, feedback_id, message)
    VALUES (${replyId}, ${id}, ${message})
  `;

  return pgGetFeedbackById(id);
}

export async function pgGetStats() {
  await ensureSchema();
  // Reuse the logic from store.ts but with Postgres data
  const items = await pgGetAllFeedback();
  return items; // Return raw items — caller will compute stats
}

/** Seed the database if empty */
export async function pgSeedIfEmpty(seedData: StoredFeedback[]) {
  await ensureSchema();
  const { rows } = await sql`SELECT COUNT(*) as count FROM feedback`;
  const count = parseInt(rows[0].count as string, 10);
  if (count > 0) return;

  for (const item of seedData) {
    await sql`
      INSERT INTO feedback (id, user_name, user_avatar, category, type, message, quick_action, anonymous, status, priority, starred, escalated, dismissed, archived, deleted_at, upvotes, upvoted_by, tags, created_at)
      VALUES (${item.id}, ${item.userName}, ${item.userAvatar}, ${item.category}, ${item.type}, ${item.message}, ${item.quickAction}, ${item.anonymous}, ${item.status}, ${item.priority}, ${item.starred}, ${item.escalated}, ${item.dismissed}, ${item.archived}, ${item.deletedAt || null}, ${item.upvotes}, ${item.upvotedBy as unknown as string}::text[], ${item.tags as unknown as string}::text[], ${item.createdAt})
    `;
  }
}

import fs from "fs";
import path from "path";
import { sql } from "@vercel/postgres";
import { hasPostgres } from "@/lib/db";
import { type TrafficStore, type TrafficWeek, type ActionItem } from "./types";
import { seedTraffic } from "./seed";

// Persistence for the web-traffic tracker. Mirrors the makina journal: a single
// JSON blob in Postgres (competitor_meta key) when configured, else a local
// file with an in-memory fallback.
const KEY = "web_traffic";
let memory: TrafficStore | null = null;

function resolveFile(): string {
  const local = path.join(process.cwd(), "data", "traffic.json");
  try {
    fs.mkdirSync(path.dirname(local), { recursive: true });
    const t = path.join(path.dirname(local), ".write-test-traffic");
    fs.writeFileSync(t, ""); fs.unlinkSync(t);
    return local;
  } catch {
    return path.join("/tmp", "traffic.json");
  }
}
const FILE = resolveFile();

function fileRead(): TrafficStore | null {
  try { if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, "utf-8")) as TrafficStore; } catch { /* fall through */ }
  return memory;
}
function fileWrite(s: TrafficStore) { memory = s; try { fs.writeFileSync(FILE, JSON.stringify(s, null, 2)); } catch { /* read-only fs */ } }

async function pgEnsure() { await sql`CREATE TABLE IF NOT EXISTS competitor_meta (key TEXT PRIMARY KEY, value TEXT)`; }
async function pgRead(): Promise<TrafficStore | null> {
  await pgEnsure();
  const { rows } = await sql`SELECT value FROM competitor_meta WHERE key = ${KEY}`;
  if (!rows.length) return null;
  try { return JSON.parse(rows[0].value as string) as TrafficStore; } catch { return null; }
}
async function pgWrite(s: TrafficStore) {
  await pgEnsure();
  await sql`INSERT INTO competitor_meta (key, value) VALUES (${KEY}, ${JSON.stringify(s)})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

function normalize(s: TrafficStore | null): TrafficStore | null {
  if (!s || !Array.isArray(s.weeks)) return null;
  return { weeks: s.weeks, actionItems: Array.isArray(s.actionItems) ? s.actionItems : [] };
}

export async function getTraffic(): Promise<TrafficStore> {
  const raw = normalize(hasPostgres() ? await pgRead() : fileRead());
  if (raw && raw.weeks.length) return raw;
  // First use: seed with the first uploaded report + a current, tailored backlog.
  const seeded = seedTraffic();
  try { await saveTraffic(seeded); } catch { /* best effort */ }
  return seeded;
}

export async function saveTraffic(s: TrafficStore): Promise<void> {
  if (hasPostgres()) await pgWrite(s); else fileWrite(s);
}

function sortWeeks(weeks: TrafficWeek[]) {
  weeks.sort((a, b) => (a.weekStart < b.weekStart ? 1 : a.weekStart > b.weekStart ? -1 : 0)); // newest first
}

export async function upsertWeek(week: TrafficWeek): Promise<TrafficStore> {
  const s = await getTraffic();
  const now = new Date().toISOString();
  const idx = s.weeks.findIndex((w) => w.id === week.id);
  const full: TrafficWeek = { ...week, createdAt: idx >= 0 ? s.weeks[idx].createdAt : now, updatedAt: now };
  if (idx >= 0) s.weeks[idx] = full; else s.weeks.push(full);
  sortWeeks(s.weeks);
  await saveTraffic(s);
  return s;
}

export async function deleteWeek(id: string): Promise<TrafficStore> {
  const s = await getTraffic();
  s.weeks = s.weeks.filter((w) => w.id !== id);
  await saveTraffic(s);
  return s;
}

const aid = () => "ai-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export async function addActionItem(text: string): Promise<TrafficStore> {
  const s = await getTraffic();
  const clean = text.replace(/<[^>]*>/g, "").trim().slice(0, 600);
  if (clean) s.actionItems.unshift({ id: aid(), text: clean, done: false, source: "manual", createdAt: new Date().toISOString() });
  await saveTraffic(s);
  return s;
}

export async function updateActionItem(id: string, patch: Partial<Pick<ActionItem, "text" | "done">>): Promise<TrafficStore> {
  const s = await getTraffic();
  const it = s.actionItems.find((a) => a.id === id);
  if (it) {
    if (typeof patch.done === "boolean") it.done = patch.done;
    if (typeof patch.text === "string") it.text = patch.text.replace(/<[^>]*>/g, "").trim().slice(0, 600);
  }
  await saveTraffic(s);
  return s;
}

export async function deleteActionItem(id: string): Promise<TrafficStore> {
  const s = await getTraffic();
  s.actionItems = s.actionItems.filter((a) => a.id !== id);
  await saveTraffic(s);
  return s;
}

/** Replace the auto (research-generated) action items for one week, leaving
 *  manual items and other weeks' auto items untouched. Used on each ingest. */
export async function replaceAutoActions(weekId: string, texts: string[]): Promise<TrafficStore> {
  const s = await getTraffic();
  s.actionItems = s.actionItems.filter((a) => !(a.source === "auto" && a.weekId === weekId));
  const now = new Date().toISOString();
  const fresh: ActionItem[] = texts
    .map((t) => t.replace(/<[^>]*>/g, "").trim().slice(0, 600))
    .filter(Boolean)
    .map((text) => ({ id: aid(), text, done: false, source: "auto" as const, weekId, createdAt: now }));
  s.actionItems = [...fresh, ...s.actionItems];
  await saveTraffic(s);
  return s;
}

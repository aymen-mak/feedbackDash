import fs from "fs";
import path from "path";
import { type Competitor, type Snapshot, type Platform } from "./types";

// File-backed + in-memory store for the competitor tracker. Mirrors the
// feedback store's strategy: project-local data/ when writable, /tmp on
// read-only serverless filesystems, in-memory as the last resort.

interface Store {
  competitors: Competitor[];
  snapshots: Snapshot[];
}

let memoryStore: Store | null = null;

function resolveDataFile(): string {
  const local = path.join(process.cwd(), "data", "competitors.json");
  const localDir = path.dirname(local);
  try {
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    const testFile = path.join(localDir, ".write-test-competitors");
    fs.writeFileSync(testFile, "");
    fs.unlinkSync(testFile);
    return local;
  } catch {
    return path.join("/tmp", "competitors.json");
  }
}

const DATA_FILE = resolveDataFile();

function read(): Store {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as Partial<Store>;
      const store: Store = {
        competitors: data.competitors ?? [],
        snapshots: data.snapshots ?? [],
      };
      memoryStore = store;
      return store;
    }
  } catch {
    // fall through to memory / fresh
  }
  if (memoryStore) return memoryStore;
  const fresh: Store = { competitors: [], snapshots: [] };
  memoryStore = fresh;
  return fresh;
}

function write(store: Store) {
  memoryStore = store;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch {
    // read-only fs — data lives in memory only
  }
}

export function fileSeedIfEmpty(competitors: Competitor[], snapshots: Snapshot[]) {
  const store = read();
  if (store.competitors.length > 0) return;
  store.competitors = competitors;
  store.snapshots = snapshots;
  write(store);
}

export function fileListCompetitors(): Competitor[] {
  return read().competitors;
}

export function fileGetCompetitor(id: string): Competitor | null {
  return read().competitors.find((c) => c.id === id) ?? null;
}

/** Insert or replace a competitor by id. */
export function fileUpsertCompetitor(c: Competitor): Competitor {
  const store = read();
  const idx = store.competitors.findIndex((x) => x.id === c.id);
  if (idx === -1) store.competitors.push(c);
  else store.competitors[idx] = c;
  write(store);
  return c;
}

export function fileDeleteCompetitor(id: string): boolean {
  const store = read();
  const before = store.competitors.length;
  store.competitors = store.competitors.filter((c) => c.id !== id);
  store.snapshots = store.snapshots.filter((s) => s.competitorId !== id);
  write(store);
  return store.competitors.length < before;
}

export function fileGetSnapshots(competitorId?: string, platform?: Platform): Snapshot[] {
  return read()
    .snapshots.filter(
      (s) =>
        (!competitorId || s.competitorId === competitorId) &&
        (!platform || s.platform === platform)
    )
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
}

export function fileAddSnapshots(snaps: Snapshot[]) {
  if (snaps.length === 0) return;
  const store = read();
  store.snapshots.push(...snaps);
  write(store);
}

import { hasPostgres } from "@/lib/db";
import { fileGetJournal, fileSetJournal, fileGetMakinaTweets, fileSetMakinaTweets } from "@/lib/competitors/store";
import { pgGetMakinaJournal, pgSetMakinaJournal, pgGetMakinaTweets, pgSetMakinaTweets } from "@/lib/competitors/db";
import { getCompetitor } from "@/lib/competitors/service";
import { type Competitor } from "@/lib/competitors/types";
import {
  ACCOUNTS,
  accountDef,
  defaultWeekStart,
  type JournalEntry,
  type MakinaJournal,
  type MakinaTweets,
} from "./journal";
import { collectTelegramViaBot, collectXProfiles } from "./collectors";

export async function getJournal(): Promise<MakinaJournal> {
  return hasPostgres() ? pgGetMakinaJournal() : fileGetJournal();
}

async function saveJournal(journal: MakinaJournal): Promise<void> {
  if (hasPostgres()) await pgSetMakinaJournal(journal);
  else fileSetJournal(journal);
}

export async function getLatestTweets(): Promise<MakinaTweets> {
  return hasPostgres() ? pgGetMakinaTweets() : fileGetMakinaTweets();
}

async function saveLatestTweets(tweets: MakinaTweets): Promise<void> {
  if (hasPostgres()) await pgSetMakinaTweets(tweets);
  else fileSetMakinaTweets(tweets);
}

/** Keep only known metric keys; coerce to finite numbers or null. */
function sanitizeValues(account: string, raw: unknown): Record<string, number | null> {
  const def = accountDef(account);
  const out: Record<string, number | null> = {};
  if (!def || !raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const m of def.metrics) {
    const v = r[m.key];
    out[m.key] = typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  return out;
}

export async function upsertEntry(input: {
  account: string;
  periodStart: string;
  values: unknown;
  note?: unknown;
}): Promise<JournalEntry | null> {
  if (!accountDef(input.account)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart)) return null;
  const journal = await getJournal();
  const idx = journal.entries.findIndex(
    (e) => e.account === input.account && e.periodStart === input.periodStart
  );
  const merged = {
    ...(idx >= 0 ? journal.entries[idx].values : {}),
    ...sanitizeValues(input.account, input.values),
  };
  const entry: JournalEntry = {
    account: input.account,
    periodStart: input.periodStart,
    values: merged,
    note: typeof input.note === "string" ? input.note.slice(0, 2000) : idx >= 0 ? journal.entries[idx].note ?? null : null,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) journal.entries[idx] = entry;
  else journal.entries.push(entry);
  journal.entries.sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.account.localeCompare(b.account));
  await saveJournal(journal);
  return entry;
}

export async function deleteEntry(account: string, periodStart: string): Promise<boolean> {
  const journal = await getJournal();
  const before = journal.entries.length;
  journal.entries = journal.entries.filter((e) => !(e.account === account && e.periodStart === periodStart));
  if (journal.entries.length === before) return false;
  await saveJournal(journal);
  return true;
}

/** Auto-collected counts already on the Makina competitor row. */
function autoFromCompetitor(comp: Competitor | null, accountKey: string): Record<string, number | null> {
  if (!comp) return {};
  const val = (p: string) => comp.platforms.find((x) => x.platform === p)?.value ?? null;
  switch (accountKey) {
    case "makinafi":
      return { followers: val("twitter") };
    case "telegram":
      return { members: val("telegram") };
    case "discord":
      return { members: val("discord") };
    case "website":
      return { monthlyVisits: val("website") };
    default:
      return {};
  }
}

export interface CollectSummary {
  periodStart: string;
  accounts: { key: string; label: string; ok: boolean; error: string | null; filled: number }[];
}

/**
 * Run every configured collector for the current period and merge the results
 * into the journal. Non-null collected values overwrite; nulls never erase an
 * existing (e.g. backfilled) value. Missing credentials degrade gracefully.
 */
export async function collectAndStore(periodStart?: string): Promise<CollectSummary> {
  const period = periodStart && /^\d{4}-\d{2}-\d{2}$/.test(periodStart) ? periodStart : defaultWeekStart();
  const comp = await getCompetitor("makina");
  const journal = await getJournal();

  // Previous entry per account (latest before this period) for derived deltas.
  const prevOf = (account: string) =>
    journal.entries
      .filter((e) => e.account === account && e.periodStart < period)
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0];

  const summary: CollectSummary = { periodStart: period, accounts: [] };
  const tweetsStore = await getLatestTweets();
  let tweetsChanged = false;

  // One scweet run covers every X handle (avoids the free tier's run limit).
  const twHandles = ACCOUNTS.filter((a) => a.platform === "twitter").map((a) => a.handle ?? a.key);
  const xResults = twHandles.length ? await collectXProfiles(twHandles) : {};

  for (const acc of ACCOUNTS) {
    const collected: Record<string, number | null> = { ...autoFromCompetitor(comp, acc.key) };
    let error: string | null = null;

    if (acc.platform === "twitter") {
      const key = (acc.handle ?? acc.key).replace(/^@/, "").toLowerCase();
      const r = xResults[key] ?? { values: {}, error: "scweet: no data" };
      Object.assign(collected, r.values);
      error = r.error;
      if (r.tweets && r.tweets.length > 0) {
        tweetsStore.byAccount[acc.key] = { tweets: r.tweets, updatedAt: new Date().toISOString() };
        tweetsChanged = true;
      }
    } else if (acc.key === "telegram") {
      const r = await collectTelegramViaBot(acc.handle ?? "makinafinance");
      Object.assign(collected, r.values);
      error = r.error;
    }

    // Derived: new follows = followers delta vs the previous period.
    if (acc.platform === "twitter" && collected.followers != null) {
      const prev = prevOf(acc.key);
      if (prev?.values?.followers != null) collected.newFollows = collected.followers - prev.values.followers;
    }

    // Derived: net new members = member delta vs the previous period.
    if (acc.key === "telegram" && collected.members != null) {
      const prev = prevOf(acc.key);
      if (prev?.values?.members != null) collected.newMembers = collected.members - prev.values.members;
    }

    const nonNull = Object.fromEntries(Object.entries(collected).filter(([, v]) => v != null));
    if (Object.keys(nonNull).length > 0) {
      await upsertEntry({ account: acc.key, periodStart: period, values: nonNull });
    }
    summary.accounts.push({
      key: acc.key,
      label: acc.label,
      ok: error == null && Object.keys(nonNull).length > 0,
      error,
      filled: Object.keys(nonNull).length,
    });
  }

  if (tweetsChanged) await saveLatestTweets(tweetsStore);
  return summary;
}

import { hasPostgres } from "@/lib/db";
import {
  fileGetJournal,
  fileSetJournal,
  fileGetMakinaTweets,
  fileSetMakinaTweets,
  fileGetMakinaDiag,
  fileSetMakinaDiag,
} from "@/lib/competitors/store";
import {
  pgGetMakinaJournal,
  pgSetMakinaJournal,
  pgGetMakinaTweets,
  pgSetMakinaTweets,
  pgGetMakinaDiag,
  pgSetMakinaDiag,
} from "@/lib/competitors/db";
import { getCompetitor } from "@/lib/competitors/service";
import { type Competitor } from "@/lib/competitors/types";
import {
  ACCOUNTS,
  accountDef,
  defaultWeekStart,
  type AccountDef,
  type JournalEntry,
  type MakinaJournal,
  type MakinaTweets,
} from "./journal";
import { collectTelegram, collectXProfiles } from "./collectors";
import {
  apifyDiag,
  classify,
  envDiag,
  worstLevel,
  type DiagItem,
  type DiagReport,
  type MakinaDiag,
} from "./diagnostics";

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

export async function getDiag(): Promise<MakinaDiag | null> {
  return hasPostgres() ? pgGetMakinaDiag() : fileGetMakinaDiag();
}

async function saveDiag(diag: MakinaDiag): Promise<void> {
  if (hasPostgres()) await pgSetMakinaDiag(diag);
  else fileSetMakinaDiag(diag);
}

/** A friendly "all good" line for a source's diagnostic, from its evidence. */
function okSummaryFor(acc: AccountDef, ev: Record<string, unknown>, filled: number): string | undefined {
  if (acc.platform === "twitter") {
    const posts = Number(ev.postsInWindow ?? 0);
    const f = ev.followers;
    return `${posts} post(s) in the 7-day window${f != null ? `, ${Number(f).toLocaleString()} followers` : ""}.`;
  }
  if (acc.key === "telegram") {
    const subs = ev.subscribers;
    const posts = Number(ev.postsInWindow ?? 0);
    return `${subs != null ? Number(subs).toLocaleString() + " subscribers" : "subscriber count unavailable"}, ${posts} post(s) in the window.`;
  }
  return filled > 0 ? `${filled} metric(s) via the competitor tracker.` : undefined;
}

/** Keep only known metric keys with finite values. Absent/invalid keys are
 *  SKIPPED (not set to null), so a partial collection — e.g. followers-only —
 *  can never erase values already stored for the same period. */
function sanitizeValues(account: string, raw: unknown): Record<string, number | null> {
  const def = accountDef(account);
  const out: Record<string, number | null> = {};
  if (!def || !raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  for (const m of def.metrics) {
    const v = r[m.key];
    if (typeof v === "number" && Number.isFinite(v)) out[m.key] = v;
  }
  return out;
}

/** Fill metrics the collector normally derives (engagement rate, net-new
 *  counts, per-post averages) when a manual backfill leaves them blank, so a
 *  hand-entered week matches an auto-collected one. Never overwrites a value the
 *  caller supplied — only computes when the target metric is absent. */
function deriveValues(
  account: string,
  values: Record<string, number | null>,
  prevValues?: Record<string, number | null>
): Record<string, number | null> {
  const def = accountDef(account);
  if (!def) return values;
  const out = { ...values };
  const has = (k: string) => typeof out[k] === "number" && Number.isFinite(out[k] as number);

  if (def.platform === "twitter") {
    const engKeys = ["likes", "replies", "reposts", "bookmarks", "shares"];
    if (!has("engagementRate") && has("impressions") && (out.impressions as number) > 0 && engKeys.some(has)) {
      const eng = engKeys.reduce((s, k) => s + (has(k) ? (out[k] as number) : 0), 0);
      out.engagementRate = +((eng / (out.impressions as number)) * 100).toFixed(2);
    }
    if (!has("newFollows") && has("followers") && prevValues?.followers != null) {
      out.newFollows = (out.followers as number) - prevValues.followers;
    }
  } else if (account === "telegram") {
    if (!has("avgViews") && has("views") && has("posts") && (out.posts as number) > 0) {
      out.avgViews = Math.round((out.views as number) / (out.posts as number));
    }
    if (!has("reachRate") && has("avgViews") && has("members") && (out.members as number) > 0) {
      out.reachRate = +(((out.avgViews as number) / (out.members as number)) * 100).toFixed(1);
    }
    if (!has("newMembers") && has("members") && prevValues?.members != null) {
      out.newMembers = (out.members as number) - prevValues.members;
    }
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
  const prev = journal.entries
    .filter((e) => e.account === input.account && e.periodStart < input.periodStart)
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0];
  const merged = deriveValues(
    input.account,
    {
      ...(idx >= 0 ? journal.entries[idx].values : {}),
      ...sanitizeValues(input.account, input.values),
    },
    prev?.values
  );
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

  // ── Self-heal stored data that an earlier bug recorded misleadingly ──
  let healed = false;
  for (const e of journal.entries) {
    // Telegram: scrub impossible member counts (e.g. 1,801,000,000) so they
    // can't poison deltas, sticky figures or the trend sparkline.
    if (e.account === "telegram") {
      for (const k of ["members", "newMembers"] as const) {
        const v = e.values[k];
        if (typeof v === "number" && Math.abs(v) > 100_000_000) {
          e.values[k] = null;
          healed = true;
        }
      }
      continue;
    }
    // X: an old collection wrote all-zero engagement when the account simply did
    // not post that week, which renders as a 0 / -100% cliff while the derived
    // engagement rate goes stale. Drop that no-posts fingerprint so every
    // post-derived metric carries forward its last real value ("as of <date>").
    if (accountDef(e.account)?.platform === "twitter") {
      const zero = (k: string) => e.values[k] == null || e.values[k] === 0;
      const noPosts =
        e.values.impressions === 0 && zero("likes") && zero("replies") && zero("reposts") && zero("shares");
      if (noPosts) {
        for (const k of ["impressions", "likes", "replies", "reposts", "shares", "bookmarks", "engagementRate"]) {
          if (e.values[k] != null) {
            e.values[k] = null;
            healed = true;
          }
        }
      }
    }
  }
  if (healed) await saveJournal(journal);

  // Previous entry per account (latest before this period) for derived deltas.
  const prevOf = (account: string) =>
    journal.entries
      .filter((e) => e.account === account && e.periodStart < period)
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart))[0];

  const summary: CollectSummary = { periodStart: period, accounts: [] };
  const tweetsStore = await getLatestTweets();
  let tweetsChanged = false;
  const diagItems: DiagItem[] = [];

  // Pre-flight: one live Apify check, so we skip wasteful failing runs and report
  // the real reason (e.g. exhausted credit) instead of vague per-actor errors.
  const { item: apifyItem, apify: apifyUsage } = await apifyDiag();
  diagItems.push(apifyItem, envDiag());

  // X handles go stalest-first, so a handle deferred on the previous run is
  // collected first on this one. Telegram starts now, in parallel with X — a
  // different service entirely, so it doesn't violate the never-overlap rule
  // that applies to scweet runs.
  const lastXOkAt = (account: string): number => {
    let t = 0;
    for (const e of journal.entries) {
      if (e.account !== account) continue;
      if (e.values.impressions == null && e.values.followers == null) continue;
      const ts = Date.parse(e.updatedAt ?? "");
      if (!Number.isNaN(ts)) t = Math.max(t, ts);
    }
    return t;
  };
  const twHandles = ACCOUNTS.filter((a) => a.platform === "twitter")
    .sort((a, b) => lastXOkAt(a.key) - lastXOkAt(b.key))
    .map((a) => a.handle ?? a.key);
  const tgAcc = ACCOUNTS.find((a) => a.key === "telegram");
  const telegramPromise = tgAcc ? collectTelegram(tgAcc.handle ?? "makinafinance") : null;
  // Previously stored tweet ids let the free pipeline keep refreshing known
  // posts even when every discovery layer is dark. Stored ids come in several
  // shapes ("tweet-<digits>" from the scweet era, bare digits, or only in the
  // url), so extract the numeric id from whichever field carries it.
  const knownIdsByHandle: Record<string, string[]> = {};
  for (const a of ACCOUNTS) {
    if (a.platform !== "twitter") continue;
    const key = (a.handle ?? a.key).replace(/^@/, "").toLowerCase();
    const ids = new Set<string>();
    for (const t of tweetsStore.byAccount[a.key]?.tweets ?? []) {
      const m = t.id.match(/(\d{8,})/) ?? t.url.match(/status\/(\d{8,})/);
      if (m) ids.add(m[1]);
    }
    knownIdsByHandle[key] = [...ids];
  }
  // 40s budget leaves headroom inside the 60s function for Telegram, the
  // competitor pre-fetch, and persisting every row.
  const xResults = twHandles.length ? await collectXProfiles(twHandles, 40_000, knownIdsByHandle) : {};

  for (const acc of ACCOUNTS) {
    const collected: Record<string, number | null> = { ...autoFromCompetitor(comp, acc.key) };
    let error: string | null = null;
    let evidence: Record<string, unknown> = {};
    let xWeekly: Record<string, Record<string, number | null>> | undefined;

    if (acc.platform === "twitter") {
      const key = (acc.handle ?? acc.key).replace(/^@/, "").toLowerCase();
      const r = xResults[key] ?? { values: {}, error: null, evidence: {} };
      Object.assign(collected, r.values);
      evidence = r.evidence ?? {};
      backfillWeekly = r.weekly;
      // X runs on the free pipeline; Apify health no longer gates it.
      error = r.error ?? null;
      xWeekly = r.weekly;
      if (r.tweets && r.tweets.length > 0) {
        tweetsStore.byAccount[acc.key] = { tweets: r.tweets, updatedAt: new Date().toISOString() };
        tweetsChanged = true;
      }
    } else if (acc.key === "telegram") {
      // Direct t.me fetch (free, no Apify); started earlier, in parallel with X.
      const r = telegramPromise ? await telegramPromise : await collectTelegram(acc.handle ?? "makinafinance");
      Object.assign(collected, r.values);
      evidence = r.evidence ?? {};
      error = r.error;
    }

    // Never store an impossible member count, whatever its source (the direct
    // collector or the competitor row). Drop it so the dashboard keeps the last
    // sane figure instead of persisting garbage like 1,801,000,000.
    if (acc.key === "telegram" && typeof collected.members === "number" && collected.members > 100_000_000) {
      collected.members = null;
    }

    // Derived: new follows = followers delta vs the previous period.
    if (acc.platform === "twitter" && collected.followers != null) {
      const prev = prevOf(acc.key);
      if (prev?.values?.followers != null) collected.newFollows = collected.followers - prev.values.followers;
    }

    // Derived: net new members = member delta vs the previous period. Guard both
    // sides against impossible values so a stray misparse can't yield a junk delta.
    if (acc.key === "telegram" && collected.members != null && collected.members <= 100_000_000) {
      const pv = prevOf(acc.key)?.values?.members;
      if (pv != null && pv <= 100_000_000) collected.newMembers = collected.members - pv;
    }

    const nonNull = Object.fromEntries(Object.entries(collected).filter(([, v]) => v != null));
    if (Object.keys(nonNull).length > 0) {
      await upsertEntry({ account: acc.key, periodStart: period, values: nonNull });
    }

    // Backfill: fill every EARLIER week the timeline still covers whose
    // engagement is empty (weeks collected while X discovery was blocked). Only
    // touches weeks with no impressions stored, so real data is never
    // overwritten and followers/deltas are preserved (upsert merges).
    if (acc.platform === "twitter" && xWeekly) {
      let filled = 0;
      for (const [wk, vals] of Object.entries(xWeekly)) {
        if (wk === period) continue; // current week already written above
        const existing = journal.entries.find((e) => e.account === acc.key && e.periodStart === wk);
        if (!existing || existing.values.impressions != null) continue; // gaps only
        await upsertEntry({ account: acc.key, periodStart: wk, values: vals });
        filled++;
      }
      if (filled > 0) evidence = { ...evidence, weeksBackfilled: filled };
    }

    // Build the per-source diagnostic from the real outcome of this run.
    if (!error && acc.platform !== "twitter" && acc.key !== "telegram" && Object.keys(nonNull).length === 0) {
      error = "nothing collected yet (sourced from the competitor tracker)";
    }
    diagItems.push(classify(`src:${acc.key}`, acc.label, error, evidence, okSummaryFor(acc, evidence, Object.keys(nonNull).length)));

    summary.accounts.push({
      key: acc.key,
      label: acc.label,
      ok: error == null && Object.keys(nonNull).length > 0,
      error,
      filled: Object.keys(nonNull).length,
    });
  }

  if (tweetsChanged) await saveLatestTweets(tweetsStore);

  // Persist the full report so the Diagnose button reflects this real run.
  const report: DiagReport = {
    at: new Date().toISOString(),
    items: diagItems,
    level: worstLevel(diagItems),
    apify: apifyUsage,
    fromRun: true,
  };
  await saveDiag(report);

  return summary;
}

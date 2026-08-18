import { type TweetMetric, defaultWeekStart } from "./journal";
import { parseHumanNumber, parseTelegramCount } from "@/lib/competitors/collectors";
import { collectXFree } from "./freex";

/** Every Apify actor run costs real money (the actor charges per run start, on
 *  top of compute), so paid scraping is FROZEN unless explicitly re-enabled by
 *  setting APIFY_ALLOW_SPEND=true in Vercel. The free pipeline (freex.ts) is
 *  the primary X source either way; Apify is at most an opt-in fallback. */
export function apifySpendAllowed(): boolean {
  return process.env.APIFY_ALLOW_SPEND === "true";
}

// Metric collectors for our OWN accounts that store NO account logins:
//
//  • X / Twitter → Apify running the altimis/scweet actor. It scrapes PUBLIC
//    profile-timeline data, so the only secret we hold is an Apify API token,
//    it controls the Apify account, never X, can't post, and there is no X
//    credential to leak.
//  • Telegram → the public channel preview (t.me/s/<channel>) for member count
//    and per-post views; an optional bot token (channel admin) refines the
//    member count. No login required.

export interface CollectResult {
  values: Record<string, number | null>;
  error: string | null;
  /** Latest per-post metrics (X only), newest first. */
  tweets?: TweetMetric[];
  /** Per-week aggregates for EVERY week the discovered posts cover (X only),
   *  keyed by period start (YYYY-MM-DD). Lets "Collect now" backfill past weeks,
   *  not just the current one. */
  weekly?: Record<string, Record<string, number | null>>;
  /** Raw counts behind the result, for accurate diagnostics. */
  evidence?: Record<string, unknown>;
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** One post's numbers, for weekly bucketing (createdAt drives the week). */
export interface WeeklyPost {
  createdAt: string;
  impressions: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  bookmarks: number | null;
}

/**
 * Group posts into weekly aggregates (Monday-start, matching defaultWeekStart),
 * honoring the same accuracy rule as the single-week path: a metric is summed
 * for a week only when EVERY post in that week carries it, otherwise it's
 * withheld. Engagement rate is left to the derive step. Keyed by period start.
 */
export function bucketPostsByWeek(posts: WeeklyPost[]): Record<string, Record<string, number | null>> {
  const byWeek: Record<string, WeeklyPost[]> = {};
  for (const p of posts) {
    const ms = Date.parse(p.createdAt);
    if (Number.isNaN(ms)) continue;
    (byWeek[defaultWeekStart(new Date(ms))] ??= []).push(p);
  }
  const out: Record<string, Record<string, number | null>> = {};
  for (const [wk, group] of Object.entries(byWeek)) {
    const sum = (k: keyof WeeklyPost): number | null => {
      let s = 0;
      for (const p of group) {
        const v = p[k];
        if (typeof v !== "number" || !Number.isFinite(v)) return null;
        s += v;
      }
      return s;
    };
    const vals: Record<string, number | null> = {};
    // quotes → the "shares" metric key used throughout the journal.
    for (const [src, key] of [
      ["impressions", "impressions"],
      ["likes", "likes"],
      ["replies", "replies"],
      ["reposts", "reposts"],
      ["quotes", "shares"],
      ["bookmarks", "bookmarks"],
    ] as [keyof WeeklyPost, string][]) {
      const v = sum(src);
      if (v != null) vals[key] = v;
    }
    out[wk] = vals;
  }
  return out;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.name === "AbortError" ? "request timed out" : e.message;
  return String(e);
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[, ]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** First finite number found under any of `keys`, across the given objects. */
function pickNum(sources: Array<Record<string, unknown> | undefined>, keys: string[]): number | undefined {
  for (const s of sources) {
    if (!s) continue;
    for (const k of keys) {
      const v = num(s[k]);
      if (v != null) return v;
    }
  }
  return undefined;
}

/** First non-empty string (or number coerced to string) found under any of `keys`. */
function pickStr(sources: Array<Record<string, unknown> | undefined>, keys: string[]): string | undefined {
  for (const s of sources) {
    if (!s) continue;
    for (const k of keys) {
      const v = s[k];
      if (typeof v === "string" && v.trim()) return v;
      if (typeof v === "number") return String(v);
    }
  }
  return undefined;
}

/** POST run-sync-get-dataset-items with one auto-retry on transient 429/5xx. */
async function apifyRunSync(actor: string, token: string, input: unknown, ms = 58000): Promise<Response> {
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&memory=1024`;
  const opts: RequestInit = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) };
  let res = await fetchWithTimeout(url, opts, ms);
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 2000));
    res = await fetchWithTimeout(url, opts, ms);
  }
  return res;
}

// ── X via Apify + altimis/scweet (public profile scrape, no X login) ──
// A single scrape can cover several handles at once (scweet accepts multiple
// profile_urls), keeping us to one run per collection, which matters on the
// free tier's one-run-at-a-time limit.

function aggregateHandle(items: Array<Record<string, unknown>>, handle: string): CollectResult {
  const cutoff = Date.now() - WEEK_MS;
  let impressions = 0, likes = 0, replies = 0, reposts = 0, bookmarks = 0, shares = 0, count = 0;
  let followers: number | undefined;
  const own: TweetMetric[] = [];
  for (const it of items) {
    const user = (it.user ?? {}) as Record<string, unknown>;
    const userLegacy = (user.legacy ?? {}) as Record<string, unknown>;
    const tw = (it.tweet ?? {}) as Record<string, unknown>;
    const legacy = (tw.legacy ?? it.legacy ?? {}) as Record<string, unknown>;
    const src = [it, tw, legacy];

    const f = pickNum([user, userLegacy], ["followers_count", "followersCount", "followers"]);
    if (f != null) followers = f; // captured regardless of tweet date

    // scweet has shipped several output shapes, so read each metric across the
    // common field-name variants (snake/camel, abbreviations, GraphQL legacy).
    const imp =
      pickNum(src, ["view_count", "views_count", "viewCount", "views", "impressions", "impression_count"]) ??
      num((it.views as Record<string, unknown> | undefined)?.count) ??
      num((tw.views as Record<string, unknown> | undefined)?.count) ??
      0;
    const lk = pickNum(src, ["favorite_count", "favoriteCount", "favourites_count", "likes", "like_count", "likeCount"]) ?? 0;
    const rp = pickNum(src, ["reply_count", "replyCount", "replies"]) ?? 0;
    const rt = pickNum(src, ["retweet_count", "retweetCount", "retweets", "repost_count", "reposts"]) ?? 0;
    const qt = pickNum(src, ["quote_count", "quoteCount", "quotes"]) ?? 0;
    const bm = pickNum(src, ["bookmark_count", "bookmarkCount", "bookmarks"]) ?? 0;
    const createdMs = Date.parse(pickStr(src, ["created_at", "createdAt", "date", "time", "timestamp", "created"]) ?? "");

    // Per-post record for the latest-posts view (any date).
    const rawText = (pickStr(src, ["text", "full_text", "fullText", "content", "rawContent", "tweet"]) ?? "").trim();
    own.push({
      id: String(pickStr(src, ["id", "id_str", "rest_id", "tweet_id", "tweetId"]) ?? pickStr(src, ["tweet_url", "url"]) ?? own.length),
      url: pickStr(src, ["tweet_url", "url", "twitterUrl", "link", "permalink"]) ?? "",
      text: rawText.length > 280 ? `${rawText.slice(0, 277)}…` : rawText,
      createdAt: Number.isNaN(createdMs) ? "" : new Date(createdMs).toISOString(),
      impressions: imp, likes: lk, replies: rp, reposts: rt, quotes: qt, bookmarks: bm,
    });

    // Weekly aggregates: only posts created within the last 7 days.
    if (!Number.isNaN(createdMs) && createdMs < cutoff) continue;
    impressions += imp; likes += lk; replies += rp; reposts += rt; shares += qt; bookmarks += bm;
    count += 1;
  }

  const sorted = own.sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0));
  const tweets = sorted.slice(0, 12);
  // Every discovered post bucketed by its own week, for past-week backfill.
  const weekly = bucketPostsByWeek(sorted);

  // Field names scweet actually returned, surfaced so a schema change can be
  // pinned straight from the Diagnose panel without guessing.
  const first = (items[0] ?? {}) as Record<string, unknown>;
  const firstTweet = (first.tweet ?? first.legacy ?? {}) as Record<string, unknown>;

  const evidence: Record<string, unknown> = {
    matched: own.length,
    postsInWindow: count,
    followers: followers ?? null,
    sampleKeys: Object.keys(first).slice(0, 12).join(", ") || null,
    sampleTweetKeys: Object.keys(firstTweet).slice(0, 12).join(", ") || null,
  };

  // Followers is a profile-level figure, valid even with no posts this week.
  const base: Record<string, number | null> = {};
  if (followers != null) base.followers = followers;

  // No posts at all, or none inside the 7-day window: leave the per-post metrics
  // absent (rather than recording 0) so the dashboard carries forward the last
  // real values "as of <date>" instead of showing a misleading 0 / -100% drop.
  if (own.length === 0) return { values: base, error: `scweet: no posts found for @${handle}`, tweets, weekly, evidence };
  if (count === 0) return { values: base, error: `scweet: no posts in the last 7 days for @${handle}`, tweets, weekly, evidence };

  const engagements = likes + replies + reposts + bookmarks + shares;

  // Posts exist in the window but every engagement field read 0 — almost always a
  // renamed metric field in scweet's output, not a real zero. Flag it (with the
  // field names in evidence) and keep the last good figures instead of storing 0s.
  if (impressions === 0 && engagements === 0) {
    return {
      values: base,
      error: `scweet returned ${count} post(s) for @${handle} but every engagement field read 0; the metric field names may have changed`,
      tweets,
      weekly,
      evidence,
    };
  }

  const values: Record<string, number | null> = {
    ...base,
    impressions,
    likes,
    replies,
    reposts,
    bookmarks,
    shares,
    engagementRate: impressions > 0 ? +((engagements / impressions) * 100).toFixed(2) : null,
  };
  return { values, error: null, tweets, weekly, evidence };
}

/** Author handle of a scraped item, lowercased without the @ (accepts the
 *  several field shapes scweet has shipped). Empty when no author is present. */
function authorOf(it: Record<string, unknown>): string {
  const user = (it.user ?? {}) as Record<string, unknown>;
  return String(
    user.handle ?? user.username ?? user.screen_name ?? user.userName ?? it.handle ?? it.username ?? it.screen_name ?? ""
  )
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
}

interface ScweetRun {
  /** Non-demo dataset items; null when the request itself failed. */
  items: Array<Record<string, unknown>> | null;
  error: string | null;
}

async function runScweet(actor: string, token: string, input: unknown, ms: number): Promise<ScweetRun> {
  try {
    const res = await apifyRunSync(actor, token, input, ms);
    if (!res.ok) {
      let body = "";
      try { body = (await res.text()).replace(/\s+/g, " ").trim(); } catch { /* ignore */ }
      const approval = body.match(/"approvalUrl":"([^"]+)"/)?.[1];
      if (approval || /not-approved|approvepermissions/i.test(body)) {
        return {
          items: null,
          error: `Actor needs a one-time permission approval on this Apify account: ${approval ?? "open the actor in Apify and approve permissions"}`,
        };
      }
      // Keep the response body: on a 400 it names the offending input field.
      return { items: null, error: `Apify HTTP ${res.status}${body ? `: ${body.slice(0, 140)}` : ""}` };
    }
    const items = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(items)) return { items: null, error: "Apify: unexpected response shape" };
    return { items: items.filter((it) => !it.noResults && !it.demo), error: null };
  } catch (e) {
    return { items: null, error: `Apify: ${errMsg(e)}` };
  }
}

/**
 * Collect every X handle. Free pipeline first (freex.ts: syndication + nitter
 * RSS discovery, fxtwitter/vxtwitter/embed-CDN enrichment — $0, no login);
 * Apify/scweet only as an explicit opt-in fallback when free discovery finds
 * nothing AND APIFY_ALLOW_SPEND=true.
 */
export async function collectXProfiles(
  handles: string[],
  budgetMs = 45_000,
  knownIdsByHandle: Record<string, string[]> = {}
): Promise<Record<string, CollectResult>> {
  const clean = [...new Set(handles.map((h) => h.replace(/^@/, "").trim().toLowerCase()).filter(Boolean))];
  if (clean.length === 0) return {};

  // PRIMARY: the zero-cost pipeline (followers + posts + engagement, freex.ts).
  // Stateless public endpoints, so handles run concurrently against ONE shared
  // deadline — the whole X phase must finish inside the function's time limit,
  // or nothing gets persisted and the weekly panel stops advancing.
  const deadlineTs = Date.now() + budgetMs;
  const free = await Promise.all(clean.map((h) => collectXFree(h, knownIdsByHandle[h] ?? [], deadlineTs)));
  const out: Record<string, CollectResult> = Object.fromEntries(clean.map((h, i) => [h, free[i]]));

  // OPT-IN FALLBACK: Apify/scweet, only for handles where free discovery found
  // no posts at all, and only when spending is explicitly allowed. Never runs
  // by default — every actor run charges real money.
  const needPaid = clean.filter((h) => ((out[h].evidence?.tweetsFound as number | undefined) ?? 0) === 0);
  if (needPaid.length === 0 || !apifySpendAllowed()) return out;

  const paid = await collectXViaApify(needPaid, budgetMs);
  for (const h of needPaid) {
    const p = paid[h];
    if (p && ((p.tweets?.length ?? 0) > 0 || Object.keys(p.values).length > Object.keys(out[h].values).length)) {
      out[h] = p;
    }
  }
  return out;
}

/**
 * The Apify/scweet path, kept as an explicit opt-in fallback (every run start
 * costs real money). Hard-won constraints, each observed in production:
 *  • profiles mode with several profile_urls in ONE run → empty dataset;
 *  • two runs in PARALLEL → BOTH empty (shared actor X session, they stomp on
 *    each other) — so runs here are one-at-a-time: one multi-handle search run,
 *    then strictly-sequential per-handle profiles runs within the time budget,
 *    deferring what can't fit.
 */
async function collectXViaApify(handles: string[], budgetMs = 45_000): Promise<Record<string, CollectResult>> {
  const clean = [...new Set(handles.map((h) => h.replace(/^@/, "").trim().toLowerCase()).filter(Boolean))];
  if (clean.length === 0) return {};
  const token = process.env.APIFY_TOKEN;
  if (!token) return Object.fromEntries(clean.map((h) => [h, { values: {}, error: "Apify not set (APIFY_TOKEN)" }]));
  const actor = process.env.APIFY_TWEET_ACTOR || "altimis~scweet";
  const started = Date.now();
  const remaining = () => budgetMs - (Date.now() - started);

  const out: Record<string, CollectResult> = {};
  const pending = new Set(clean);

  // Phase 1: one search run covering every handle at once.
  if (clean.length > 1) {
    const run = await runScweet(
      actor,
      token,
      {
        source_mode: "search",
        search_query: clean.map((h) => `from:${h}`).join(" OR "),
        search_sort: "Latest",
        max_items: Math.max(100, clean.length * 60),
      },
      Math.min(58_000, Math.max(20_000, remaining() - 2_000))
    );
    if (run.items) {
      const byAuthor: Record<string, Array<Record<string, unknown>>> = {};
      for (const it of run.items) {
        const a = authorOf(it);
        if (a) (byAuthor[a] ??= []).push(it);
      }
      for (const h of clean) {
        const mine = byAuthor[h] ?? [];
        if (mine.length === 0) continue; // not seen in search → profiles fallback below
        const r = aggregateHandle(mine, h);
        r.evidence = { ...(r.evidence ?? {}), strategy: "search", itemsReturned: run.items.length };
        out[h] = r;
        pending.delete(h);
      }
    }
  }

  // Phase 2: strictly-sequential per-handle profiles runs for what's missing.
  for (const h of clean) {
    if (!pending.has(h)) continue;
    if (remaining() < 24_000) {
      out[h] = {
        values: {},
        error: `deferred — this run's time budget is spent; @${h} goes first on the next collection`,
        evidence: { deferred: true },
      };
      continue;
    }
    const run = await runScweet(
      actor,
      token,
      { source_mode: "profiles", profile_urls: [`@${h}`], max_items: 100 },
      Math.min(58_000, remaining() - 2_000)
    );
    if (!run.items) {
      out[h] = { values: {}, error: run.error };
      continue;
    }
    const mine = run.items.filter((it) => {
      const a = authorOf(it);
      return a === h || !a; // this handle's posts, or items with no author field
    });
    const r = aggregateHandle(mine, h);
    r.evidence = {
      ...(r.evidence ?? {}),
      strategy: clean.length > 1 ? "profiles-fallback" : "profiles",
      itemsReturned: run.items.length,
    };
    if (run.items.length === 0) {
      r.error =
        clean.length > 1
          ? `search and profile-timeline scrapes both came back empty for @${h}; likely an X block or actor change — inspect /api/makina/debug?handle=${h}`
          : `scweet's profile scrape came back empty for @${h}; inspect /api/makina/debug?handle=${h}`;
    } else if (mine.length === 0 && r.error) {
      r.error = `scweet returned ${run.items.length} items but none authored by @${h}`;
    }
    out[h] = r;
  }
  return out;
}

// ── Telegram via the direct t.me preview (free; no proxy, no Apify) ──
// t.me is reachable from this deployment (the competitor tracker scrapes it the
// same way). We reuse the competitor tracker's hardened number/count parsers so
// the two can't drift, the bug where "1 801 members" parsed as 1801M came from a
// weaker local parser whose [KMB] suffix greedily ate the "m" in "members".
const TG_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 MakinaPulse/1.0";

// No real Telegram channel exceeds ~100M subscribers; anything above is a misparse.
const TG_MAX = 100_000_000;
const saneCount = (v: number | null): number | undefined =>
  v != null && v > 0 && v <= TG_MAX ? v : undefined;

async function fetchTelegramHtml(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": TG_UA, "Accept-Language": "en" } }, 12000);
    if (res.ok) {
      const t = await res.text();
      if (t && t.length > 200) return t;
    }
  } catch {
    /* caller falls back to the other page */
  }
  return null;
}

function parseTelegramPosts(html: string): { views: number; createdAt: string }[] {
  const out: { views: number; createdAt: string }[] = [];
  for (const part of html.split("tgme_widget_message_wrap").slice(1)) {
    const createdAt = part.match(/datetime="([^"]+)"/)?.[1];
    if (!createdAt) continue;
    const vRaw = part.match(/tgme_widget_message_views"[^>]*>([^<]+)</)?.[1];
    const v = vRaw ? parseHumanNumber(vRaw) : null;
    out.push({ views: v ?? 0, createdAt });
  }
  return out;
}

export async function collectTelegram(channel: string): Promise<CollectResult> {
  const chan = (process.env.TELEGRAM_CHANNEL || channel)
    .replace(/^(?:https?:\/\/)?t\.me\//, "")
    .replace(/^s\//, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");

  // s/ carries the message preview (views + dates); the bare page has the exact
  // subscriber count. Neither is required on its own, so fetch both in parallel.
  const [preview, info] = await Promise.all([
    fetchTelegramHtml(`https://t.me/s/${encodeURIComponent(chan)}`),
    fetchTelegramHtml(`https://t.me/${encodeURIComponent(chan)}`),
  ]);
  if (!preview && !info)
    return { values: {}, error: "Telegram: t.me unreachable; will retry next run", evidence: { previewOk: false, infoOk: false } };

  // Prefer the exact info-page count; fall back to the (possibly abbreviated) preview header.
  const members =
    saneCount(info ? parseTelegramCount(info) : null) ?? saneCount(preview ? parseTelegramCount(preview) : null);
  const posts = preview ? parseTelegramPosts(preview) : [];

  const cutoff = Date.now() - WEEK_MS;
  let views = 0, count = 0;
  for (const p of posts) {
    const t = Date.parse(p.createdAt);
    if (!Number.isNaN(t) && t < cutoff) continue;
    views += p.views;
    count += 1;
  }

  const evidence: Record<string, unknown> = {
    subscribers: members ?? null,
    postsFound: posts.length,
    postsInWindow: count,
    previewOk: !!preview,
    infoOk: !!info,
  };

  const values: Record<string, number | null> = {};
  if (members != null) values.members = members;
  if (posts.length > 0) {
    values.posts = count;
    values.views = views;
    const avg = count > 0 ? Math.round(views / count) : null;
    values.avgViews = avg;
    values.reachRate = avg != null && members != null && members > 0 ? +((avg / members) * 100).toFixed(1) : null;
  }
  if (members == null && posts.length === 0) {
    return { values: {}, error: "Telegram: no public preview (private channel or wrong handle)", evidence };
  }
  return { values, error: null, evidence };
}

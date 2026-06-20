import { type TweetMetric } from "./journal";

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
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

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
    const f = num(user.followers_count);
    if (f != null) followers = f; // captured regardless of tweet date
    const tw = (it.tweet ?? {}) as Record<string, unknown>;
    const imp = num(it.view_count) ?? num(tw.view_count) ?? 0;
    const lk = num(it.favorite_count) ?? num(tw.favorite_count) ?? 0;
    const rp = num(it.reply_count) ?? num(tw.reply_count) ?? 0;
    const rt = num(it.retweet_count) ?? num(tw.retweet_count) ?? 0;
    const qt = num(it.quote_count) ?? num(tw.quote_count) ?? 0;
    const bm = num(it.bookmark_count) ?? num(tw.bookmark_count) ?? 0;
    const createdMs = Date.parse(String(it.created_at ?? tw.created_at ?? ""));

    // Per-post record for the latest-posts view (any date).
    const rawText = String(it.text ?? tw.text ?? "").trim();
    own.push({
      id: String(it.id ?? tw.rest_id ?? it.tweet_url ?? own.length),
      url: String(it.tweet_url ?? tw.tweet_url ?? ""),
      text: rawText.length > 280 ? `${rawText.slice(0, 277)}…` : rawText,
      createdAt: Number.isNaN(createdMs) ? "" : new Date(createdMs).toISOString(),
      impressions: imp, likes: lk, replies: rp, reposts: rt, quotes: qt, bookmarks: bm,
    });

    // Weekly aggregates: only posts created within the last 7 days.
    if (!Number.isNaN(createdMs) && createdMs < cutoff) continue;
    impressions += imp; likes += lk; replies += rp; reposts += rt; shares += qt; bookmarks += bm;
    count += 1;
  }

  const tweets = own
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0))
    .slice(0, 12);

  const values: Record<string, number | null> = { impressions, likes, replies, reposts, bookmarks, shares };
  if (followers != null) values.followers = followers;
  const engagements = likes + replies + reposts + bookmarks + shares;
  values.engagementRate = impressions > 0 ? +((engagements / impressions) * 100).toFixed(2) : null;
  if (own.length === 0) return { values, error: `scweet: no posts found for @${handle}`, tweets };
  if (count === 0) return { values, error: "scweet: no posts in the last 7 days", tweets };
  return { values, error: null, tweets };
}

/** Scrape one or more handles in a single scweet run; keyed by lowercase handle (no @). */
export async function collectXProfiles(handles: string[]): Promise<Record<string, CollectResult>> {
  const clean = [...new Set(handles.map((h) => h.replace(/^@/, "").trim().toLowerCase()).filter(Boolean))];
  const fail = (error: string): Record<string, CollectResult> =>
    Object.fromEntries(clean.map((h) => [h, { values: {}, error }]));

  const token = process.env.APIFY_TOKEN;
  if (!token) return fail("Apify not set (APIFY_TOKEN)");
  if (clean.length === 0) return {};
  const actor = process.env.APIFY_TWEET_ACTOR || "altimis~scweet";
  const input = {
    source_mode: "auto",
    profile_urls: clean.map((h) => `@${h}`),
    max_items: Math.max(100, clean.length * 100), // scweet's schema minimum is 100
    search_sort: "Latest",
  };
  try {
    const res = await apifyRunSync(actor, token, input);
    if (!res.ok) {
      let body = "";
      try { body = await res.text(); } catch { /* ignore */ }
      const approval = body.match(/"approvalUrl":"([^"]+)"/)?.[1];
      if (approval || /not-approved|approvepermissions/i.test(body)) {
        return fail(`Actor needs a one-time permission approval on this Apify account: ${approval ?? "open the actor in Apify and approve permissions"}`);
      }
      return fail(`Apify HTTP ${res.status} (token/credit/rate-limit?)`);
    }
    const items = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(items)) return fail("Apify: unexpected response shape");

    // Group posts by author handle (drops demo rows and retweets of others).
    const byHandle: Record<string, Array<Record<string, unknown>>> = {};
    for (const it of items) {
      if (it.noResults || it.demo) continue;
      const user = (it.user ?? {}) as Record<string, unknown>;
      const author = String(user.handle ?? it.handle ?? "").toLowerCase();
      if (!author) continue;
      (byHandle[author] = byHandle[author] ?? []).push(it);
    }

    return Object.fromEntries(clean.map((h) => [h, aggregateHandle(byHandle[h] ?? [], h)]));
  } catch (e) {
    return fail(`Apify: ${errMsg(e)}`);
  }
}

// ── Telegram via Apify (automation-lab/telegram-scraper, proxied) ──
// Direct t.me fetches are blocked from datacenter IPs, so scrape through Apify.
// Returns one channel-info record (subscriberCount) + message records (views,
// reactions, date).
function parseHumanNum(s: string): number | undefined {
  const m = s.replace(/[, ]/g, "").match(/([\d.]+)\s*([KMB]?)/i);
  if (!m) return undefined;
  let n = parseFloat(m[1]);
  const u = (m[2] || "").toUpperCase();
  if (u === "K") n *= 1e3;
  else if (u === "M") n *= 1e6;
  else if (u === "B") n *= 1e9;
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

function reactionTotal(rx: unknown): number {
  if (!Array.isArray(rx)) return 0;
  let total = 0;
  for (const r of rx) {
    const o = (r ?? {}) as Record<string, unknown>;
    total += num(o.count) ?? num(o.total) ?? num(o.value) ?? 0;
  }
  return total;
}

export async function collectTelegram(channel: string): Promise<CollectResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { values: {}, error: "Apify not set (APIFY_TOKEN)" };
  const actor = process.env.APIFY_TELEGRAM_ACTOR || "automation-lab~telegram-scraper";
  const chan = (process.env.TELEGRAM_CHANNEL || channel)
    .replace(/^(?:https?:\/\/)?t\.me\//, "")
    .replace(/^s\//, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");
  const input = { channels: [chan], maxMessages: 50, includeChannelInfo: true };
  try {
    const res = await apifyRunSync(actor, token, input);
    if (!res.ok) return { values: {}, error: `Apify HTTP ${res.status} (token/credit?)` };
    const items = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(items)) return { values: {}, error: "Apify: unexpected response shape" };

    const cutoff = Date.now() - WEEK_MS;
    let members: number | undefined;
    let views = 0, reactions = 0, count = 0;
    for (const it of items) {
      // Channel-info record carries the subscriber count.
      const sub = it.subscriberCount ?? it.subscribers;
      if (sub != null) {
        const v = parseHumanNum(String(sub)) ?? num(sub);
        if (v != null) members = v;
        continue;
      }
      // Message records: only those from the last 7 days.
      const created = Date.parse(String(it.date ?? it.createdAt ?? ""));
      if (!Number.isNaN(created) && created < cutoff) continue;
      views += num(it.views) ?? parseHumanNum(String(it.viewsRaw ?? "")) ?? 0;
      reactions += reactionTotal(it.reactions);
      count += 1;
    }

    const values: Record<string, number | null> = {};
    if (members != null) values.members = members;
    values.posts = count;
    values.views = views;
    const avg = count > 0 ? Math.round(views / count) : null;
    values.avgViews = avg;
    values.reachRate = avg != null && members != null && members > 0 ? +((avg / members) * 100).toFixed(1) : null;
    values.reactions = reactions;
    values.avgReactions = count > 0 ? Math.round(reactions / count) : null;
    if (members == null && count === 0) {
      return { values: {}, error: "Telegram: no data (private channel or wrong handle)" };
    }
    return { values, error: null };
  } catch (e) {
    return { values: {}, error: `Apify: ${errMsg(e)}` };
  }
}

// Metric collectors for our OWN accounts that store NO account logins:
//
//  • X / Twitter → Apify (apidojo/tweet-scraper by default). The actor scrapes
//    PUBLIC tweet data and authenticates on Apify's side, so the only secret we
//    hold is an Apify API token — it controls the Apify account, never X, can't
//    post, and there is no X credential to leak.
//  • Telegram → the Bot API with a revocable bot token (the bot must be a
//    channel admin). Member count only — deep group stats have no secure API.
//
// Owner-only metrics with no public/secure source (X profile visits; Telegram
// messages / viewing / posting members) are left blank for manual backfill.

export interface CollectResult {
  values: Record<string, number | null>;
  error: string | null;
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

/** First defined numeric field among alias keys (actors vary in naming). */
function pick(o: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = num(o[k]);
    if (v != null) return v;
  }
  return undefined;
}

// ── X via Apify (public scrape, no X login) ──
export async function collectXViaApify(handle: string): Promise<CollectResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { values: {}, error: "Apify not set (APIFY_TOKEN)" };
  const actor = process.env.APIFY_TWEET_ACTOR || "apidojo~tweet-scraper";
  const h = handle.replace(/^@/, "").trim();
  const since = new Date(Date.now() - WEEK_MS).toISOString().slice(0, 10);
  const until = new Date(Date.now() + 86400000).toISOString().slice(0, 10); // inclusive of today
  const input = {
    searchTerms: [`from:${h} since:${since} until:${until}`],
    sort: "Latest",
    maxItems: 200,
  };
  try {
    const res = await fetchWithTimeout(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) },
      58000
    );
    if (!res.ok) {
      return { values: {}, error: `Apify HTTP ${res.status} (token/actor/credit?)` };
    }
    const items = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(items)) return { values: {}, error: "Apify: unexpected response shape" };

    const cutoff = Date.now() - WEEK_MS;
    let impressions = 0, likes = 0, replies = 0, reposts = 0, bookmarks = 0, shares = 0, count = 0;
    let followers: number | undefined;
    for (const it of items) {
      const createdRaw = (it.createdAt ?? it.created_at) as string | undefined;
      const created = typeof createdRaw === "string" ? Date.parse(createdRaw) : NaN;
      if (!Number.isNaN(created) && created < cutoff) continue; // safety net vs. the date query
      const author = (it.author ?? {}) as Record<string, unknown>;
      const f = pick(author, "followers", "followersCount", "followers_count");
      if (f != null) followers = f;
      impressions += pick(it, "viewCount", "views", "view_count", "impressionCount") ?? 0;
      likes += pick(it, "likeCount", "likes", "favoriteCount", "favorite_count") ?? 0;
      replies += pick(it, "replyCount", "replies", "reply_count") ?? 0;
      reposts += pick(it, "retweetCount", "retweets", "retweet_count") ?? 0;
      bookmarks += pick(it, "bookmarkCount", "bookmarks", "bookmark_count") ?? 0;
      shares += pick(it, "quoteCount", "quotes", "quote_count") ?? 0;
      count += 1;
    }

    const values: Record<string, number | null> = { impressions, likes, replies, reposts, bookmarks, shares };
    if (followers != null) values.followers = followers;
    const engagements = likes + replies + reposts + bookmarks + shares;
    values.engagementRate = impressions > 0 ? +((engagements / impressions) * 100).toFixed(2) : null;
    // profileVisits is owner-only — no public source; left for backfill.
    if (count === 0) return { values, error: "Apify: no tweets found in the last 7 days" };
    return { values, error: null };
  } catch (e) {
    return { values: {}, error: `Apify: ${errMsg(e)}` };
  }
}

// ── Telegram via Bot API (revocable bot token, bot must be channel admin) ──
export async function collectTelegramViaBot(channel: string): Promise<CollectResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { values: {}, error: "Telegram bot not set (TELEGRAM_BOT_TOKEN)" };
  const chan = (process.env.TELEGRAM_CHANNEL || channel)
    .replace(/^https?:\/\/t\.me\//, "")
    .replace(/^@/, "");
  try {
    const res = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/getChatMemberCount?chat_id=@${encodeURIComponent(chan)}`,
      {},
      12000
    );
    const data = (await res.json()) as { ok?: boolean; result?: number; description?: string };
    if (!data.ok || typeof data.result !== "number") {
      return { values: {}, error: `Telegram: ${data.description || "bot not admin / wrong channel"}` };
    }
    // messages / viewing / posting members have no Bot-API source — backfill.
    return { values: { members: data.result }, error: null };
  } catch (e) {
    return { values: {}, error: `Telegram: ${errMsg(e)}` };
  }
}

import { type TweetMetric } from "./journal";

// Metric collectors for our OWN accounts that store NO account logins:
//
//  • X / Twitter → Apify running the altimis/scweet actor. It scrapes PUBLIC
//    profile-timeline data, so the only secret we hold is an Apify API token —
//    it controls the Apify account, never X, can't post, and there is no X
//    credential to leak.
//  • Telegram → the Bot API with a revocable bot token (the bot must be a
//    channel admin). Member count only — deep group stats have no secure API.
//
// Owner-only metrics with no public/secure source (X profile visits; Telegram
// messages / viewing / posting members) are left blank for manual backfill.

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

// ── X via Apify + altimis/scweet (public profile scrape, no X login) ──
export async function collectXViaApify(handle: string): Promise<CollectResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { values: {}, error: "Apify not set (APIFY_TOKEN)" };
  const actor = process.env.APIFY_TWEET_ACTOR || "altimis~scweet";
  const h = handle.replace(/^@/, "").trim();
  const input = {
    source_mode: "auto",
    profile_urls: [`@${h}`],
    max_items: 100, // scweet's schema minimum
    search_sort: "Latest",
  };
  try {
    const res = await fetchWithTimeout(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&memory=1024`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) },
      58000
    );
    if (!res.ok) return { values: {}, error: `Apify HTTP ${res.status} (token/credit/rate-limit?)` };
    const items = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(items)) return { values: {}, error: "Apify: unexpected response shape" };

    const cutoff = Date.now() - WEEK_MS;
    let impressions = 0, likes = 0, replies = 0, reposts = 0, bookmarks = 0, shares = 0, count = 0;
    let followers: number | undefined;
    const own: TweetMetric[] = [];
    for (const it of items) {
      if (it.noResults || it.demo) continue;
      const user = (it.user ?? {}) as Record<string, unknown>;
      // Only this account's own tweets (drop retweets of other accounts).
      const author = String(user.handle ?? it.handle ?? "").toLowerCase();
      if (author && author !== h.toLowerCase()) continue;
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

      // Per-post record for the latest-tweets view (any date).
      const rawText = String(it.text ?? tw.text ?? "").trim();
      own.push({
        id: String(it.id ?? tw.rest_id ?? it.tweet_url ?? own.length),
        url: String(it.tweet_url ?? tw.tweet_url ?? ""),
        text: rawText.length > 280 ? `${rawText.slice(0, 277)}…` : rawText,
        createdAt: Number.isNaN(createdMs) ? "" : new Date(createdMs).toISOString(),
        impressions: imp, likes: lk, replies: rp, reposts: rt, quotes: qt, bookmarks: bm,
      });

      // Weekly aggregates: only tweets created within the last 7 days.
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
    if (count === 0) return { values, error: "scweet: no tweets in the last 7 days", tweets };
    return { values, error: null, tweets };
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

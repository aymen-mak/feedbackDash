import { type TweetMetric } from "./journal";
import { type CollectResult } from "./collectors";
import { collectTwitter } from "@/lib/competitors/collectors";

// ── Free X metrics, no Apify, no credentials ──
//
// Discovery (recent post ids + dates + baseline counts):
//   1. X's own syndication timeline (syndication.twitter.com) — the embedded-
//      widget feed; carries per-tweet like/reply counts and needs no auth.
//   2. Nitter-mirror RSS (xcancel.com, twiiit.com router, others) — ids + dates
//      when syndication is unavailable.
// Enrichment (views + fresh counts, per tweet id):
//   a. api.fxtwitter.com  (FixTweet/FxEmbed, the Discord-embed API: views,
//      likes, retweets, replies — public, unauthenticated)
//   b. api.vxtwitter.com  (BetterTwitFix, same idea)
//   c. cdn.syndication.twimg.com/tweet-result — X's embed CDN (the endpoint
//      Vercel's react-tweet uses); token is derived from the id.
//
// Accuracy rule: a weekly aggregate is only written when EVERY post in the
// window has that number (no partial sums, no fabricated zeros). Unknown
// per-post numbers stay null and the UI hides them.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 MakinaPulse/1.0";
const WEEK_MS = 7 * 24 * 3600 * 1000;

async function fetchText(url: string, ms = 10_000, accept = "text/html,application/xhtml+xml"): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const t = await res.text();
    return t && t.length > 50 ? t : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string, ms = 8_000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[, ]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export interface FreeTweet {
  id: string;
  url: string;
  text: string;
  createdAt: string; // ISO ("" when unknown)
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  bookmarks: number | null;
}

// ── Discovery layer 1: X syndication timeline ──
export async function fetchSyndicationTimeline(handle: string): Promise<FreeTweet[] | null> {
  const html = await fetchText(
    `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}?showReplies=false`,
    12_000
  );
  if (!html) return null;
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]) as {
      props?: { pageProps?: { timeline?: { entries?: Array<Record<string, unknown>> } } };
    };
    const entries = data.props?.pageProps?.timeline?.entries ?? [];
    const out: FreeTweet[] = [];
    for (const e of entries) {
      const content = (e.content ?? {}) as Record<string, unknown>;
      const tw = (content.tweet ?? e.tweet ?? {}) as Record<string, unknown>;
      const id = String(tw.id_str ?? "");
      if (!id) continue;
      const user = (tw.user ?? {}) as Record<string, unknown>;
      const author = String(user.screen_name ?? "").toLowerCase();
      if (author && author !== handle.toLowerCase()) continue; // drop retweets of others
      const createdMs = Date.parse(String(tw.created_at ?? ""));
      const views = (tw.views ?? {}) as Record<string, unknown>;
      out.push({
        id,
        url: `https://x.com/${handle}/status/${id}`,
        text: String(tw.full_text ?? tw.text ?? "").trim(),
        createdAt: Number.isNaN(createdMs) ? "" : new Date(createdMs).toISOString(),
        views: num(views.count) ?? num(tw.view_count),
        likes: num(tw.favorite_count),
        replies: num(tw.conversation_count) ?? num(tw.reply_count),
        reposts: num(tw.retweet_count),
        quotes: num(tw.quote_count),
        bookmarks: null,
      });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

// ── Discovery layer 2: Nitter-mirror RSS ──
const NITTER_RSS = (h: string) => [
  `https://xcancel.com/${h}/rss`,
  `https://twiiit.com/${h}/rss`, // router that 302s to a live instance
  `https://nitter.net/${h}/rss`,
  `https://nitter.poast.org/${h}/rss`,
  `https://lightbrd.com/${h}/rss`,
];

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export async function fetchNitterRss(handle: string): Promise<{ tweets: FreeTweet[]; instance: string } | null> {
  for (const url of NITTER_RSS(handle)) {
    const xml = await fetchText(url, 9_000, "application/rss+xml,application/xml,text/xml");
    if (!xml || !xml.includes("<item>")) continue;
    const statusRe = new RegExp(`/${handle}/status/(\\d+)`, "i");
    const out: FreeTweet[] = [];
    for (const im of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const item = im[1];
      // Skip retweets of other accounts (creator differs from the handle).
      const creator = item.match(/<dc:creator>@?([^<]+)<\/dc:creator>/)?.[1]?.trim().toLowerCase();
      if (creator && creator !== handle.toLowerCase()) continue;
      const link = item.match(/<link>([^<]+)<\/link>/)?.[1] ?? "";
      const idm = link.match(statusRe);
      if (!idm) continue;
      const pub = Date.parse(item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? "");
      out.push({
        id: idm[1],
        url: `https://x.com/${handle}/status/${idm[1]}`,
        text: decodeEntities(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
        createdAt: Number.isNaN(pub) ? "" : new Date(pub).toISOString(),
        views: null,
        likes: null,
        replies: null,
        reposts: null,
        quotes: null,
        bookmarks: null,
      });
    }
    if (out.length) return { tweets: out, instance: new URL(url).host };
  }
  return null;
}

// ── Enrichment: per-tweet numbers from the free embed APIs ──
export async function enrichTweet(
  id: string
): Promise<{ via: string; data: Partial<FreeTweet> } | null> {
  // a) FixTweet / FxEmbed
  const fx = await fetchJson<{ code?: number; tweet?: Record<string, unknown> }>(
    `https://api.fxtwitter.com/i/status/${id}`
  );
  const fxt = fx?.tweet;
  if (fxt && (fx?.code === 200 || fxt.id)) {
    const ts = num(fxt.created_timestamp);
    return {
      via: "fxtwitter",
      data: {
        views: num(fxt.views),
        likes: num(fxt.likes),
        replies: num(fxt.replies),
        reposts: num(fxt.retweets),
        quotes: num(fxt.quotes),
        bookmarks: num(fxt.bookmarks),
        text: typeof fxt.text === "string" && fxt.text ? fxt.text : undefined,
        createdAt: ts != null ? new Date(ts * 1000).toISOString() : undefined,
      },
    };
  }
  // b) vxtwitter
  const vx = await fetchJson<Record<string, unknown>>(`https://api.vxtwitter.com/i/status/${id}`);
  if (vx && (vx.likes != null || vx.retweets != null)) {
    return {
      via: "vxtwitter",
      data: {
        views: num(vx.views) ?? num(vx.viewCount),
        likes: num(vx.likes),
        replies: num(vx.replies),
        reposts: num(vx.retweets),
        quotes: null,
        bookmarks: null,
      },
    };
  }
  // c) X embed CDN (react-tweet's source); token derives from the id.
  const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
  const cdn = await fetchJson<Record<string, unknown>>(
    `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token}`
  );
  if (cdn && cdn.id_str) {
    return {
      via: "tweet-result",
      data: {
        views: null,
        likes: num(cdn.favorite_count),
        replies: num(cdn.conversation_count),
        reposts: null,
        quotes: null,
        bookmarks: null,
      },
    };
  }
  return null;
}

/** Sum a metric across posts, only when EVERY post has it (no partial sums). */
function sumIfComplete(tweets: FreeTweet[], key: keyof FreeTweet): number | null {
  if (!tweets.length) return null;
  let s = 0;
  for (const t of tweets) {
    const v = t[key];
    if (typeof v !== "number") return null;
    s += v;
  }
  return s;
}

/** Full free collection for one handle: followers + posts + engagement. */
export async function collectXFree(handle: string): Promise<CollectResult> {
  const h = handle.replace(/^@/, "").trim().toLowerCase();

  // Followers (proven layered scraper) runs concurrently with discovery.
  const followersP = collectTwitter(h);
  const syndicationP = fetchSyndicationTimeline(h);

  let source = "syndication";
  let instance: string | null = null;
  let tweets = await syndicationP;
  if (!tweets) {
    const rss = await fetchNitterRss(h);
    if (rss) {
      tweets = rss.tweets;
      source = "nitter-rss";
      instance = rss.instance;
    }
  }
  const followers = await followersP;

  const values: Record<string, number | null> = {};
  if (followers.value != null) values.followers = followers.value;

  if (!tweets) {
    return {
      values,
      error: `X free scrape: all sources unreachable for @${h} (syndication + nitter mirrors); engagement metrics carry forward`,
      evidence: { source: "none", freeFollowers: followers.value ?? null },
    };
  }

  // Newest first, cap, dedupe.
  const seen = new Set<string>();
  tweets = tweets
    .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0))
    .slice(0, 15);

  // Enrich with a small pool (public endpoints, be polite).
  let enriched = 0;
  const via: Record<string, number> = {};
  const POOL = 4;
  for (let i = 0; i < tweets.length; i += POOL) {
    const batch = tweets.slice(i, i + POOL);
    const results = await Promise.all(batch.map((t) => enrichTweet(t.id)));
    results.forEach((r, j) => {
      if (!r) return;
      enriched++;
      via[r.via] = (via[r.via] ?? 0) + 1;
      const t = batch[j];
      for (const k of ["views", "likes", "replies", "reposts", "quotes", "bookmarks"] as const) {
        const v = r.data[k];
        if (typeof v === "number") t[k] = v;
      }
      if (r.data.text && !t.text) t.text = r.data.text;
      if (r.data.createdAt && !t.createdAt) t.createdAt = r.data.createdAt;
    });
  }

  const cutoff = Date.now() - WEEK_MS;
  const inWindow = tweets.filter((t) => {
    const ms = Date.parse(t.createdAt);
    return Number.isNaN(ms) ? false : ms >= cutoff;
  });

  // Weekly aggregates: only written when every in-window post has the number.
  const impressions = sumIfComplete(inWindow, "views");
  const likes = sumIfComplete(inWindow, "likes");
  const replies = sumIfComplete(inWindow, "replies");
  const reposts = sumIfComplete(inWindow, "reposts");
  const quotes = sumIfComplete(inWindow, "quotes");
  const bookmarks = sumIfComplete(inWindow, "bookmarks");
  if (inWindow.length > 0) {
    if (impressions != null) values.impressions = impressions;
    if (likes != null) values.likes = likes;
    if (replies != null) values.replies = replies;
    if (reposts != null) values.reposts = reposts;
    if (quotes != null) values.shares = quotes;
    if (bookmarks != null) values.bookmarks = bookmarks;
    if (impressions != null && impressions > 0 && likes != null && replies != null && reposts != null) {
      const engagements = likes + replies + reposts + (quotes ?? 0) + (bookmarks ?? 0);
      values.engagementRate = +((engagements / impressions) * 100).toFixed(2);
    }
  }

  const metrics: TweetMetric[] = tweets.slice(0, 12).map((t) => ({
    id: t.id,
    url: t.url,
    text: t.text.length > 280 ? `${t.text.slice(0, 277)}…` : t.text,
    createdAt: t.createdAt,
    impressions: t.views,
    likes: t.likes,
    replies: t.replies,
    reposts: t.reposts,
    quotes: t.quotes,
    bookmarks: t.bookmarks,
  }));

  const evidence: Record<string, unknown> = {
    source,
    instance,
    tweetsFound: tweets.length,
    postsInWindow: inWindow.length,
    enriched,
    enrichedVia: Object.entries(via).map(([k, n]) => `${k}:${n}`).join(", ") || null,
    freeFollowers: followers.value ?? null,
  };

  let error: string | null = null;
  if (inWindow.length === 0) {
    error = `no posts in the last 7 days for @${h} (free scrape found ${tweets.length} older posts)`;
  } else if (enriched === 0 && likes == null) {
    error = `X free scrape: found ${inWindow.length} post(s) but the engagement APIs were unreachable (fxtwitter/vxtwitter/embed CDN); numbers carry forward`;
  }

  return { values, error, tweets: metrics, evidence };
}

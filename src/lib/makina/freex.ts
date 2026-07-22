import { type TweetMetric } from "./journal";
import { type CollectResult, bucketPostsByWeek } from "./collectors";
import { collectTwitter } from "@/lib/competitors/collectors";

// How many discovered posts to keep per handle. Larger than one week so
// "Collect now" can backfill several past weeks in one pass, bounded to protect
// the collection time budget.
const MAX_TWEETS = 50;
// Cap per-post enrichment (candidate-id sources) so a discovery blackout can't
// blow the time budget; timeline sources already carry counts and need none.
const MAX_ENRICH = 30;

// ── Free X metrics, no Apify, no credentials ──
//
// Discovery layers (first that yields posts wins; later ones add candidates):
//   1. api.fxtwitter.com/:handle/statuses — FxEmbed's user-timeline API
//      (Cloudflare-served, unauthenticated, datacenter-friendly; full counts).
//   2. X's syndication timeline (blocked from some datacenter IPs, kept as a
//      cheap attempt).
//   3. Nitter-mirror RSS (xcancel.com, twiiit.com router, …) — ids + dates.
//   4. Search-engine discovery (Bing RSS, DuckDuckGo HTML — the same channel
//      the competitor follower scraper already uses from this deployment) —
//      candidate ids only, author-verified during enrichment.
//   5. Previously stored tweet ids — so metrics keep refreshing even in a
//      total discovery blackout.
// Enrichment per tweet id (for candidates without counts):
//   a. api.fxtwitter.com/i/status/:id   b. api.vxtwitter.com   c. X embed CDN
//      tweet-result (react-tweet's source; token derived from the id).
//
// Accuracy rule: a weekly aggregate is only written when EVERY post in the
// window has that number (no partial sums, no fabricated zeros). Unknown
// per-post numbers stay null and the UI hides them.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 MakinaPulse/1.0";
const WEEK_MS = 7 * 24 * 3600 * 1000;

interface TextResult {
  status: number; // 0 = network error / timeout
  text: string | null;
}

async function fetchTextR(url: string, ms = 10_000, accept = "text/html,application/xhtml+xml"): Promise<TextResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "en" },
    });
    const text = res.ok ? await res.text() : null;
    return { status: res.status, text: text && text.length > 50 ? text : null };
  } catch {
    return { status: 0, text: null };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string, ms = 9_000): Promise<{ status: number; json: T | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return { status: res.status, json: null };
    return { status: res.status, json: (await res.json()) as T };
  } catch {
    return { status: 0, json: null };
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
  author: string | null; // lowercased screen name when the source exposes it
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  bookmarks: number | null;
}

/** Map one FxEmbed/FixTweet status object into a FreeTweet. */
function fromFxStatus(s: Record<string, unknown>, fallbackHandle: string): FreeTweet | null {
  const id = String(s.id ?? s.id_str ?? "");
  if (!/^\d+$/.test(id)) return null;
  const author = ((s.author ?? {}) as Record<string, unknown>).screen_name;
  const ts = num(s.created_timestamp);
  const handle = typeof author === "string" && author ? author : fallbackHandle;
  return {
    id,
    url: typeof s.url === "string" && s.url ? s.url : `https://x.com/${handle}/status/${id}`,
    text: String(s.text ?? "").trim(),
    createdAt: ts != null ? new Date(ts * 1000).toISOString() : "",
    author: typeof author === "string" ? author.toLowerCase() : null,
    views: num(s.views),
    likes: num(s.likes),
    replies: num(s.replies),
    reposts: num(s.retweets),
    quotes: num(s.quotes),
    bookmarks: num(s.bookmarks),
  };
}

// ── Discovery 1: FxEmbed user timeline (tries the path variants FxEmbed has
//    served across versions; records each HTTP status for diagnostics) ──
export async function fetchFxTimeline(
  handle: string
): Promise<{ tweets: FreeTweet[] | null; statuses: string }> {
  const paths = [
    `https://api.fxtwitter.com/${encodeURIComponent(handle)}/statuses?with_replies=false`,
    `https://api.fxtwitter.com/2/x/${encodeURIComponent(handle)}/statuses`,
    `https://api.fxtwitter.com/2/${encodeURIComponent(handle)}/statuses`,
  ];
  const tried: string[] = [];
  for (const url of paths) {
    const { status, json } = await fetchJson<Record<string, unknown>>(url, 12_000);
    tried.push(String(status));
    if (!json) continue;
    // Accept the shapes FxEmbed has shipped: results[] (statuses or thread
    // groups with a nested statuses[]), statuses[], or timeline.statuses[].
    const timeline = (json.timeline ?? {}) as Record<string, unknown>;
    const rawList = (json.results ?? json.statuses ?? timeline.statuses ?? []) as Array<Record<string, unknown>>;
    if (!Array.isArray(rawList) || rawList.length === 0) continue;
    const flat: Array<Record<string, unknown>> = [];
    for (const item of rawList) {
      if (Array.isArray(item.statuses)) flat.push(...(item.statuses as Array<Record<string, unknown>>));
      else flat.push(item);
    }
    const out: FreeTweet[] = [];
    for (const s of flat) {
      const t = fromFxStatus(s, handle);
      if (!t) continue;
      if (t.author && t.author !== handle.toLowerCase()) continue; // drop RTs of others
      out.push(t);
    }
    if (out.length) return { tweets: out, statuses: tried.join(",") };
  }
  return { tweets: null, statuses: tried.join(",") };
}

// ── Discovery 1.5: x.com profile rendered through the jina.ai reader — the
//    SAME channel the competitor follower scraper already uses successfully
//    from this deployment. The rendered page contains /status/<id> links. ──
export async function fetchJinaProfileIds(handle: string): Promise<{ ids: string[]; status: number }> {
  const { status, text } = await fetchTextR(`https://r.jina.ai/https://x.com/${encodeURIComponent(handle)}`, 18_000, "text/plain");
  if (!text) return { ids: [], status };
  const idRe = new RegExp(`(?:x|twitter)\\.com/${handle}/status/(\\d+)`, "gi");
  const ids = new Set<string>();
  for (const m of text.matchAll(idRe)) ids.add(m[1]);
  return { ids: [...ids].slice(0, 15), status };
}

// ── Discovery 2: X syndication timeline ──
export async function fetchSyndicationTimeline(handle: string): Promise<{ tweets: FreeTweet[] | null; status: number }> {
  const { status, text: html } = await fetchTextR(
    `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}?showReplies=false`,
    12_000
  );
  if (!html) return { tweets: null, status };
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { tweets: null, status };
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
      if (author && author !== handle.toLowerCase()) continue;
      const createdMs = Date.parse(String(tw.created_at ?? ""));
      const views = (tw.views ?? {}) as Record<string, unknown>;
      out.push({
        id,
        url: `https://x.com/${handle}/status/${id}`,
        text: String(tw.full_text ?? tw.text ?? "").trim(),
        createdAt: Number.isNaN(createdMs) ? "" : new Date(createdMs).toISOString(),
        author: author || null,
        views: num(views.count) ?? num(tw.view_count),
        likes: num(tw.favorite_count),
        replies: num(tw.conversation_count) ?? num(tw.reply_count),
        reposts: num(tw.retweet_count),
        quotes: num(tw.quote_count),
        bookmarks: null,
      });
    }
    return { tweets: out.length ? out : null, status };
  } catch {
    return { tweets: null, status };
  }
}

// ── Discovery 3: Nitter-mirror RSS ──
const NITTER_RSS = (h: string) => [
  `https://xcancel.com/${h}/rss`,
  `https://twiiit.com/${h}/rss`, // router that redirects to a live instance
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

export async function fetchNitterRss(
  handle: string
): Promise<{ tweets: FreeTweet[] | null; tried: { host: string; status: number }[] }> {
  const tried: { host: string; status: number }[] = [];
  for (const url of NITTER_RSS(handle)) {
    const { status, text: xml } = await fetchTextR(url, 9_000, "application/rss+xml,application/xml,text/xml");
    tried.push({ host: new URL(url).host, status });
    if (!xml || !xml.includes("<item>")) continue;
    const statusRe = new RegExp(`/${handle}/status/(\\d+)`, "i");
    const out: FreeTweet[] = [];
    for (const im of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const item = im[1];
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
        author: creator ?? null,
        views: null,
        likes: null,
        replies: null,
        reposts: null,
        quotes: null,
        bookmarks: null,
      });
    }
    if (out.length) return { tweets: out, tried };
  }
  return { tweets: null, tried };
}

// ── Discovery 4: search engines (candidate ids only; author-verified later) ──
export async function searchDiscoverIds(
  handle: string
): Promise<{ ids: string[]; via: string | null; statuses: string }> {
  const idRe = new RegExp(`(?:x|twitter)\\.com(?:%2F|/)${handle}(?:%2F|/)status(?:%2F|/)(\\d+)`, "gi");
  const collect = (text: string): string[] => {
    const ids = new Set<string>();
    let decoded = text;
    try {
      decoded = text + "\n" + decodeURIComponent(text);
    } catch {
      /* keep raw */
    }
    for (const m of decoded.matchAll(idRe)) ids.add(m[1]);
    return [...ids];
  };

  const q = encodeURIComponent(`site:x.com/${handle}/status`);
  const engines: { name: string; url: string; accept?: string }[] = [
    { name: "bing", url: `https://www.bing.com/search?q=${q}&format=rss&count=30`, accept: "application/rss+xml,application/xml,text/xml" },
    { name: "ddg", url: `https://html.duckduckgo.com/html/?q=${q}` },
    { name: "mojeek", url: `https://www.mojeek.com/search?q=${q}` },
  ];
  const statuses: string[] = [];
  for (const e of engines) {
    const r = await fetchTextR(e.url, 9_000, e.accept ?? "text/html,application/xhtml+xml");
    statuses.push(`${e.name}:${r.status}`);
    if (!r.text) continue;
    const ids = collect(r.text);
    if (ids.length) return { ids: ids.slice(0, 15), via: e.name, statuses: statuses.join(",") };
  }
  return { ids: [], via: null, statuses: statuses.join(",") };
}

// ── Enrichment: per-tweet numbers from the free embed APIs ──
export async function enrichTweet(
  id: string
): Promise<{ via: string; author: string | null; data: Partial<FreeTweet> } | null> {
  const fx = await fetchJson<{ code?: number; tweet?: Record<string, unknown> }>(`https://api.fxtwitter.com/i/status/${id}`);
  const fxt = fx.json?.tweet;
  if (fxt && (fx.json?.code === 200 || fxt.id)) {
    const t = fromFxStatus(fxt, "");
    if (t) return { via: "fxtwitter", author: t.author, data: t };
  }
  const vx = await fetchJson<Record<string, unknown>>(`https://api.vxtwitter.com/i/status/${id}`);
  if (vx.json && (vx.json.likes != null || vx.json.retweets != null)) {
    const author = typeof vx.json.user_screen_name === "string" ? vx.json.user_screen_name.toLowerCase() : null;
    return {
      via: "vxtwitter",
      author,
      data: {
        views: num(vx.json.views) ?? num(vx.json.viewCount),
        likes: num(vx.json.likes),
        replies: num(vx.json.replies),
        reposts: num(vx.json.retweets),
        quotes: null,
        bookmarks: null,
        text: typeof vx.json.text === "string" ? vx.json.text : undefined,
        createdAt: num(vx.json.date_epoch) != null ? new Date((num(vx.json.date_epoch) as number) * 1000).toISOString() : undefined,
      },
    };
  }
  const token = ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
  const cdn = await fetchJson<Record<string, unknown>>(
    `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token}`
  );
  if (cdn.json && cdn.json.id_str) {
    const user = (cdn.json.user ?? {}) as Record<string, unknown>;
    const createdMs = Date.parse(String(cdn.json.created_at ?? ""));
    return {
      via: "tweet-result",
      author: typeof user.screen_name === "string" ? user.screen_name.toLowerCase() : null,
      data: {
        views: null,
        likes: num(cdn.json.favorite_count),
        replies: num(cdn.json.conversation_count),
        reposts: null,
        quotes: null,
        bookmarks: null,
        text: typeof cdn.json.text === "string" ? cdn.json.text : undefined,
        createdAt: Number.isNaN(createdMs) ? undefined : new Date(createdMs).toISOString(),
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

const hasAnyCount = (t: FreeTweet) =>
  t.views != null || t.likes != null || t.replies != null || t.reposts != null;

/** Full free collection for one handle: followers + posts + engagement.
 *  `knownIds` (previously stored posts) keep metrics refreshing even when
 *  every discovery layer is dark. */
export async function collectXFree(handle: string, knownIds: string[] = []): Promise<CollectResult> {
  const h = handle.replace(/^@/, "").trim().toLowerCase();
  const followersP = collectTwitter(h);

  const idOnly = (id: string): FreeTweet => ({
    id,
    url: `https://x.com/${h}/status/${id}`,
    text: "",
    createdAt: "",
    author: null,
    views: null,
    likes: null,
    replies: null,
    reposts: null,
    quotes: null,
    bookmarks: null,
  });

  // Discovery ladder — every rung logs its outcome so a total failure reports
  // exactly what each layer answered (visible in the Diagnose evidence).
  const ladder: string[] = [];
  let source = "fx-timeline";
  let tweets: FreeTweet[] | null = null;
  let rssInstance: string | null = null;

  const fx = await fetchFxTimeline(h);
  if (fx.tweets) tweets = fx.tweets;
  else ladder.push(`fx:${fx.statuses}`);

  if (!tweets) {
    const synd = await fetchSyndicationTimeline(h);
    if (synd.tweets) {
      source = "syndication";
      tweets = synd.tweets;
    } else ladder.push(`synd:${synd.status}`);
  }
  if (!tweets) {
    const rss = await fetchNitterRss(h);
    if (rss.tweets) {
      source = "nitter-rss";
      tweets = rss.tweets;
      rssInstance = rss.tried.find((t) => t.status === 200)?.host ?? null;
    } else ladder.push(`nitter:${rss.tried.map((t) => `${t.host.split(".")[0]}=${t.status}`).join("|")}`);
  }
  if (!tweets) {
    // x.com profile via the jina reader — the channel the competitor follower
    // scraper already reaches from this deployment; ids only, enriched below.
    const jina = await fetchJinaProfileIds(h);
    if (jina.ids.length) {
      source = "jina-profile";
      tweets = jina.ids.map(idOnly);
    } else ladder.push(`jina:${jina.status}`);
  }
  if (!tweets) {
    const found = await searchDiscoverIds(h);
    if (found.ids.length) {
      source = `search:${found.via}`;
      tweets = found.ids.map(idOnly);
    } else ladder.push(`search:${found.statuses}`);
  }
  if (!tweets && knownIds.length) {
    source = "stored-ids";
    tweets = knownIds.slice(0, 15).map(idOnly);
  }

  const followers = await followersP;
  const values: Record<string, number | null> = {};
  if (followers.value != null) values.followers = followers.value;

  if (!tweets) {
    return {
      values,
      error: `X free scrape: no discovery source reachable for @${h}; engagement metrics carry forward`,
      evidence: { source: "none", ladder: ladder.join(" · "), freeFollowers: followers.value ?? null },
    };
  }

  // Dedupe, newest first, cap.
  const seen = new Set<string>();
  tweets = tweets
    .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0))
    .slice(0, MAX_TWEETS);

  // Enrich anything that lacks counts or a date (search/stored/rss candidates);
  // drop candidates whose verified author isn't this handle (search noise).
  let enriched = 0;
  let authorRejected = 0;
  const via: Record<string, number> = {};
  const need = tweets.filter((t) => !hasAnyCount(t) || !t.createdAt).slice(0, MAX_ENRICH);
  const POOL = 4;
  for (let i = 0; i < need.length; i += POOL) {
    const batch = need.slice(i, i + POOL);
    const results = await Promise.all(batch.map((t) => enrichTweet(t.id)));
    results.forEach((r, j) => {
      if (!r) return;
      const t = batch[j];
      if (r.author && r.author !== h) {
        t.author = r.author; // marked for removal below
        authorRejected++;
        return;
      }
      enriched++;
      via[r.via] = (via[r.via] ?? 0) + 1;
      for (const k of ["views", "likes", "replies", "reposts", "quotes", "bookmarks"] as const) {
        const v = r.data[k];
        if (typeof v === "number") t[k] = v;
      }
      if (r.data.text && !t.text) t.text = r.data.text;
      if (r.data.createdAt && !t.createdAt) t.createdAt = r.data.createdAt;
    });
  }
  tweets = tweets.filter((t) => !t.author || t.author === h);

  const cutoff = Date.now() - WEEK_MS;
  const inWindow = tweets.filter((t) => {
    const ms = Date.parse(t.createdAt);
    return Number.isNaN(ms) ? false : ms >= cutoff;
  });

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

  // Every discovered post bucketed by its own week, so "Collect now" can fill
  // past weeks — not just the current one. Same accuracy rule as the single
  // week: a metric is summed for a week only when every post in it carries it.
  const weekly = bucketPostsByWeek(
    tweets.map((t) => ({
      createdAt: t.createdAt,
      impressions: t.views,
      likes: t.likes,
      replies: t.replies,
      reposts: t.reposts,
      quotes: t.quotes,
      bookmarks: t.bookmarks,
    }))
  );

  const evidence: Record<string, unknown> = {
    source,
    instance: rssInstance,
    tweetsFound: tweets.length,
    postsInWindow: inWindow.length,
    enriched,
    authorRejected: authorRejected || null,
    enrichedVia: Object.entries(via).map(([k, n]) => `${k}:${n}`).join(", ") || null,
    skippedLayers: ladder.length ? ladder.join(" · ") : null,
    freeFollowers: followers.value ?? null,
  };

  let error: string | null = null;
  if (tweets.length === 0) {
    error = `X free scrape: discovery returned only other-author posts for @${h}; check the handle`;
  } else if (inWindow.length === 0) {
    error = `no posts in the last 7 days for @${h} (free scrape found ${tweets.length} older posts)`;
  } else if (!inWindow.some(hasAnyCount)) {
    error = `X free scrape: found ${inWindow.length} post(s) but the engagement APIs were unreachable (fxtwitter/vxtwitter/embed CDN); numbers carry forward`;
  }

  return { values, error, tweets: metrics, weekly, evidence };
}

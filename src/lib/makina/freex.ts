import { type TweetMetric, defaultWeekStart } from "./journal";
import { type CollectResult } from "./collectors";
import { collectTwitter } from "@/lib/competitors/collectors";

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

async function fetchJson<T>(
  url: string,
  ms = 9_000,
  headers: Record<string, string> = {}
): Promise<{ status: number; json: T | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "User-Agent": UA, Accept: "application/json", ...headers },
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  handle: string,
  ms = 5_000
): Promise<{ tweets: FreeTweet[] | null; statuses: string }> {
  const paths = [
    `https://api.fxtwitter.com/${encodeURIComponent(handle)}/statuses?with_replies=false`,
    `https://api.fxtwitter.com/2/x/${encodeURIComponent(handle)}/statuses`,
  ];
  const tried: string[] = [];
  for (const url of paths) {
    const { status, json } = await fetchJson<Record<string, unknown>>(url, ms);
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
export async function fetchJinaProfileIds(handle: string, ms = 8_000): Promise<{ ids: string[]; status: number }> {
  const { status, text } = await fetchTextR(`https://r.jina.ai/https://x.com/${encodeURIComponent(handle)}`, ms, "text/plain");
  if (!text) return { ids: [], status };
  const idRe = new RegExp(`(?:x|twitter)\\.com/${handle}/status/(\\d+)`, "gi");
  const ids = new Set<string>();
  for (const m of text.matchAll(idRe)) ids.add(m[1]);
  return { ids: [...ids].slice(0, 15), status };
}

// ── Discovery 2: X syndication timeline ──
export async function fetchSyndicationTimeline(handle: string, ms = 6_000): Promise<{ tweets: FreeTweet[] | null; status: number }> {
  const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}?showReplies=false`;
  // 429 here is per-IP rate limiting (rapid manual collects), not a block, so
  // back off once and retry — a weekly cron rarely trips it in the first place.
  let status = 0;
  let html: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetchTextR(url, ms);
    status = r.status;
    html = r.text;
    if (html || status !== 429) break;
    await sleep(1_200);
  }
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

// ── Discovery 2.5: guest-token GraphQL timeline — the machinery X ships to a
//    logged-out browser tab (the competitor follower scraper already reaches X
//    this way from this deployment). UserTweets returns recent posts WITH
//    public metrics (likes/replies/reposts/quotes/views) in a single call. ──
const X_WEB_BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
let guestCache: { token: string; at: number } | null = null;

async function guestToken(ms = 6_000): Promise<string | null> {
  if (guestCache && Date.now() - guestCache.at < 2 * 3_600_000) return guestCache.token;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch("https://api.x.com/1.1/guest/activate.json", {
      method: "POST",
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${X_WEB_BEARER}`, "User-Agent": UA },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { guest_token?: string };
    if (d?.guest_token) {
      guestCache = { token: d.guest_token, at: Date.now() };
      return d.guest_token;
    }
  } catch {
    /* ignore */
  } finally {
    clearTimeout(timer);
  }
  return null;
}

// Recursively pull tweet objects (X's `legacy` shape) out of a GraphQL blob,
// resilient to the instruction/entry nesting which drifts between versions.
function extractLegacyTweets(node: unknown, handle: string, out: FreeTweet[], seen: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) extractLegacyTweets(n, handle, out, seen);
    return;
  }
  const o = node as Record<string, unknown>;
  const legacy = o.legacy as Record<string, unknown> | undefined;
  const restId = (o.rest_id ?? legacy?.id_str) as string | undefined;
  if (legacy && typeof legacy.full_text === "string" && typeof legacy.created_at === "string" && restId && !seen.has(String(restId))) {
    const userResults = (o.core as Record<string, unknown> | undefined)?.user_results as Record<string, unknown> | undefined;
    const coreLegacy = ((userResults?.result as Record<string, unknown> | undefined)?.legacy ?? {}) as Record<string, unknown>;
    const author = String(coreLegacy.screen_name ?? legacy.screen_name ?? "").toLowerCase();
    if (!author || author === handle.toLowerCase()) {
      seen.add(String(restId));
      const views = (o.views as Record<string, unknown> | undefined)?.count;
      const created = Date.parse(String(legacy.created_at));
      out.push({
        id: String(restId),
        url: `https://x.com/${handle}/status/${restId}`,
        text: String(legacy.full_text),
        createdAt: Number.isNaN(created) ? "" : new Date(created).toISOString(),
        author: author || null,
        views: num(views),
        likes: num(legacy.favorite_count),
        replies: num(legacy.reply_count),
        reposts: num(legacy.retweet_count),
        quotes: num(legacy.quote_count),
        bookmarks: num(legacy.bookmark_count),
      });
    }
  }
  for (const k of Object.keys(o)) extractLegacyTweets(o[k], handle, out, seen);
}

// X rejects a GraphQL call that omits a required feature flag, so send a broad
// set; unknown extras are ignored, missing ones 400 (and we fall through).
const GQL_FEATURES = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: false,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: true,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

export async function fetchGuestTimeline(handle: string, ms = 9_000): Promise<{ tweets: FreeTweet[] | null; status: string }> {
  const token = await guestToken(Math.min(6_000, ms));
  if (!token) return { tweets: null, status: "no-guest-token" };
  const headers = {
    Authorization: `Bearer ${X_WEB_BEARER}`,
    "x-guest-token": token,
    "x-twitter-active-user": "yes",
    "x-twitter-client-language": "en",
  };
  // rest_id via UserByScreenName (this endpoint answers a guest token).
  const uVars = encodeURIComponent(JSON.stringify({ screen_name: handle, withSafetyModeUserFields: false }));
  const feat = encodeURIComponent(JSON.stringify(GQL_FEATURES));
  let restId: string | null = null;
  let reached = false;
  for (const qid of ["Yka-W8dz7RaEuQNkroPkYw", "sLVLhk0bGj3MVFEKTdax1w", "1VOOyvKkiI3FMmkeDNxM9A"]) {
    const r = await fetchJson<{ data?: { user?: { result?: { rest_id?: string } } } }>(
      `https://api.x.com/graphql/${qid}/UserByScreenName?variables=${uVars}&features=${feat}`,
      Math.min(6_000, ms),
      headers
    );
    if (r.status !== 0) reached = true;
    const id = r.json?.data?.user?.result?.rest_id;
    if (typeof id === "string") {
      restId = id;
      break;
    }
  }
  if (!restId) return { tweets: null, status: reached ? "no-rest-id" : "unreachable" };

  // Timeline for that rest_id (guest access is gated on X's side, so this may
  // 401 — best effort; syndication remains the primary). Try the "Posts" tab
  // first, then fall back to "Posts and replies" — a reply-heavy account (e.g.
  // an intern/engagement handle) has an empty Posts tab but active replies.
  const tVars = encodeURIComponent(
    JSON.stringify({
      userId: restId,
      count: 40,
      includePromotedContent: false,
      withQuickPromoteEligibilityTweetFields: false,
      withVoice: false,
      withV2Timeline: true,
    })
  );
  const out: FreeTweet[] = [];
  const seen = new Set<string>();
  let tStatus = "gated";
  const ops: { name: string; qids: string[] }[] = [
    { name: "UserTweets", qids: ["E3opETHurmVJflFsUBVuUQ", "eoJ5zbv51Z_KVl81v9PmLQ", "V7H0Ap3_Hh2FyS75OCDO3Q"] },
    { name: "UserTweetsAndReplies", qids: ["wc5DRl4VaW5lSqJ8YbftZQ", "RIWc55YCNyUJ-U3HHGYkdg", "bt4TKuFdADcuA8vNMkC3Bg"] },
  ];
  for (const op of ops) {
    for (const qid of op.qids) {
      const r = await fetchJson<unknown>(
        `https://api.x.com/graphql/${qid}/${op.name}?variables=${tVars}&features=${feat}`,
        Math.min(8_000, ms),
        headers
      );
      tStatus = `${op.name}:${r.status}`;
      if (r.json) {
        extractLegacyTweets(r.json, handle, out, seen);
        if (out.length) break;
      }
    }
    if (out.length) break;
  }

  // SearchTimeline (from:<handle>, Latest) — includes REPLIES and stays
  // guest-accessible when UserTweetsAndReplies is gated (404 for a guest). This
  // is what recovers a reply-heavy handle like @makintern.
  if (!out.length) {
    const sVars = encodeURIComponent(
      JSON.stringify({ rawQuery: `from:${handle}`, count: 40, product: "Latest", querySource: "typed_query" })
    );
    for (const qid of ["BGd0T_j7oVwlW5U79tO_0A", "nK1dw4oV3k4w5TdtcAdSww", "gkjsKepM6gl_HmFWoWKfgg"]) {
      const r = await fetchJson<unknown>(
        `https://api.x.com/graphql/${qid}/SearchTimeline?variables=${sVars}&features=${feat}`,
        Math.min(8_000, ms),
        headers
      );
      tStatus = `SearchTimeline:${r.status}`;
      if (r.json) {
        extractLegacyTweets(r.json, handle, out, seen);
        if (out.length) break;
      }
    }
  }
  return { tweets: out.length ? out : null, status: out.length ? `ok:${out.length}` : `tweets-${tStatus}` };
}

// ── Discovery 3: Nitter-mirror RSS ──
// Two mirrors only — the rest were dead weight on the timeout budget. xcancel
// is the maintained fork; twiiit routes to whatever instance is currently up.
const NITTER_RSS = (h: string) => [
  `https://xcancel.com/${h}/rss`,
  `https://twiiit.com/${h}/rss`,
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
  handle: string,
  ms = 5_000
): Promise<{ tweets: FreeTweet[] | null; tried: { host: string; status: number }[] }> {
  const tried: { host: string; status: number }[] = [];
  for (const url of NITTER_RSS(handle)) {
    const { status, text: xml } = await fetchTextR(url, ms, "application/rss+xml,application/xml,text/xml");
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
  handle: string,
  ms = 5_000
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
    { name: "mojeek", url: `https://www.mojeek.com/search?q=${q}` },
  ];
  const statuses: string[] = [];
  for (const e of engines) {
    const r = await fetchTextR(e.url, ms, e.accept ?? "text/html,application/xhtml+xml");
    statuses.push(`${e.name}:${r.status}`);
    if (!r.text) continue;
    const ids = collect(r.text);
    if (ids.length) return { ids: ids.slice(0, 15), via: e.name, statuses: statuses.join(",") };
  }
  return { ids: [], via: null, statuses: statuses.join(",") };
}

// ── Enrichment: per-tweet numbers from the free embed APIs ──
export async function enrichTweet(
  id: string,
  ms = 4_000
): Promise<{ via: string; author: string | null; data: Partial<FreeTweet> } | null> {
  const fx = await fetchJson<{ code?: number; tweet?: Record<string, unknown> }>(`https://api.fxtwitter.com/i/status/${id}`, ms);
  const fxt = fx.json?.tweet;
  if (fxt && (fx.json?.code === 200 || fxt.id)) {
    const t = fromFxStatus(fxt, "");
    if (t) return { via: "fxtwitter", author: t.author, data: t };
  }
  const vx = await fetchJson<Record<string, unknown>>(`https://api.vxtwitter.com/i/status/${id}`, ms);
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
    `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token}`,
    ms
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

/** Weekly aggregate for a set of posts (only sums a metric when EVERY post in
 *  the set has it — no partial sums). Includes the derived engagement rate. */
function weekAgg(posts: FreeTweet[]): Record<string, number> {
  const v: Record<string, number> = {};
  const imp = sumIfComplete(posts, "views");
  const lk = sumIfComplete(posts, "likes");
  const rp = sumIfComplete(posts, "replies");
  const rt = sumIfComplete(posts, "reposts");
  const qt = sumIfComplete(posts, "quotes");
  const bm = sumIfComplete(posts, "bookmarks");
  if (imp != null) v.impressions = imp;
  if (lk != null) v.likes = lk;
  if (rp != null) v.replies = rp;
  if (rt != null) v.reposts = rt;
  if (qt != null) v.shares = qt;
  if (bm != null) v.bookmarks = bm;
  if (imp != null && imp > 0 && lk != null && rp != null && rt != null) {
    v.engagementRate = +(((lk + rp + rt + (qt ?? 0) + (bm ?? 0)) / imp) * 100).toFixed(2);
  }
  return v;
}

/** Full free collection for one handle: followers + posts + engagement.
 *  `knownIds` (previously stored posts) keep metrics refreshing even when
 *  every discovery layer is dark. */
export async function collectXFree(
  handle: string,
  knownIds: string[] = [],
  deadlineTs: number = Date.now() + 40_000
): Promise<CollectResult> {
  const h = handle.replace(/^@/, "").trim().toLowerCase();
  const left = () => deadlineTs - Date.now();
  const clamp = (base: number) => Math.max(1_500, Math.min(base, left() - 800));
  // Followers must never hang the whole collection — race it against the budget.
  const followersP = Promise.race([
    collectTwitter(h),
    new Promise<{ value: number | null; error?: string }>((r) =>
      setTimeout(() => r({ value: null, error: "followers timed out" }), Math.max(3_000, Math.min(12_000, left())))
    ),
  ]);

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

  // Discovery ladder, bounded by a SHARED deadline. A Vercel function that
  // overruns is killed before anything is persisted (that is why the panel
  // froze on the last fast run) — so every rung is skipped once the budget is
  // too low, guaranteeing we return in time to write the week. Each rung logs
  // its outcome for the Diagnose evidence.
  const ladder: string[] = [];
  let source = "syndication";
  let tweets: FreeTweet[] | null = null;
  let rssInstance: string | null = null;

  // 1) Syndication — X's own timeline; the richest source (full per-post
  //    metrics + this week's posts) and the only live layer not hard-blocked
  //    from the datacenter (429 is a soft rate-limit, retried inside).
  {
    const synd = await fetchSyndicationTimeline(h, clamp(7_000));
    if (synd.tweets) {
      source = "syndication";
      tweets = synd.tweets;
    } else ladder.push(`synd:${synd.status}`);
  }
  // 2) Guest-token GraphQL timeline — reuses X's logged-out browsing path,
  //    which already reaches this deployment; full metrics when not gated.
  if (!tweets && left() > 8_000) {
    const g = await fetchGuestTimeline(h, clamp(9_000));
    if (g.tweets) {
      source = "guest-gql";
      tweets = g.tweets;
    } else ladder.push(`guest:${g.status}`);
  }
  // 3) Nitter-mirror RSS — ids + dates, enriched below.
  if (!tweets && left() > 4_000) {
    const rss = await fetchNitterRss(h, clamp(5_000));
    if (rss.tweets) {
      source = "nitter-rss";
      tweets = rss.tweets;
      rssInstance = rss.tried.find((t) => t.status === 200)?.host ?? null;
    } else ladder.push(`nitter:${rss.tried.map((t) => `${t.host.split(".")[0]}=${t.status}`).join("|")}`);
  }
  // 4) x.com profile via the jina reader — ids only, enriched below.
  if (!tweets && left() > 6_000) {
    const jina = await fetchJinaProfileIds(h, clamp(8_000));
    if (jina.ids.length) {
      source = "jina-profile";
      tweets = jina.ids.map(idOnly);
    } else ladder.push(`jina:${jina.status}`);
  }
  // 5) Search engines — candidate ids, author-verified during enrichment.
  if (!tweets && left() > 5_000) {
    const found = await searchDiscoverIds(h, clamp(5_000));
    if (found.ids.length) {
      source = `search:${found.via}`;
      tweets = found.ids.map(idOnly);
    } else ladder.push(`search:${found.statuses}`);
  }
  // 6) Previously stored ids — keeps KNOWN posts fresh in a discovery blackout.
  if (!tweets && knownIds.length) {
    source = "stored-ids";
    tweets = knownIds.slice(0, 12).map(idOnly);
  }

  const followers = await followersP;
  const values: Record<string, number | null> = {};
  if (followers.value != null) values.followers = followers.value;

  if (!tweets) {
    return {
      values,
      error: `X free scrape: no discovery source reachable in time for @${h}; followers still updated, engagement carries forward`,
      evidence: { source: "none", ladder: ladder.join(" · "), freeFollowers: followers.value ?? null },
    };
  }

  // Dedupe, newest first, cap.
  const seen = new Set<string>();
  tweets = tweets
    .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0))
    .slice(0, 40); // wide enough to bucket several weeks for backfill

  // Enrich candidates lacking counts/date (search/stored/rss), ALL at once and
  // only while the budget lasts. Drop candidates whose verified author isn't
  // this handle (search noise).
  let enriched = 0;
  let authorRejected = 0;
  const via: Record<string, number> = {};
  const need = tweets.filter((t) => !hasAnyCount(t) || !t.createdAt).slice(0, 8);
  if (need.length && left() > 10_000) {
    const ems = Math.max(2_500, Math.min(4_000, left() - 4_000));
    const results = await Promise.all(need.map((t) => enrichTweet(t.id, ems)));
    results.forEach((r, j) => {
      if (!r) return;
      const t = need[j];
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

  // Bucket every fetched post into its Monday-week, using current cumulative
  // metrics (≈ final for older posts). This fills the current week AND lets the
  // service backfill past weeks — with no post ever counted in two weeks.
  const byWeek: Record<string, FreeTweet[]> = {};
  for (const t of tweets) {
    if (!t.createdAt) continue;
    const wk = defaultWeekStart(new Date(t.createdAt));
    (byWeek[wk] ??= []).push(t);
  }
  const weekly: Record<string, Record<string, number>> = {};
  for (const [wk, posts] of Object.entries(byWeek)) {
    const agg = weekAgg(posts);
    if (Object.keys(agg).length) weekly[wk] = agg;
  }
  const currentPeriod = defaultWeekStart(new Date());
  Object.assign(values, weekly[currentPeriod] ?? {});
  const postsThisWeek = (byWeek[currentPeriod] ?? []).length;

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

  const curPosts = byWeek[currentPeriod] ?? [];
  const evidence: Record<string, unknown> = {
    source,
    instance: rssInstance,
    tweetsFound: tweets.length,
    postsThisWeek,
    weeksCovered: Object.keys(weekly).length,
    enriched,
    authorRejected: authorRejected || null,
    enrichedVia: Object.entries(via).map(([k, n]) => `${k}:${n}`).join(", ") || null,
    skippedLayers: ladder.length ? ladder.join(" · ") : null,
    freeFollowers: followers.value ?? null,
  };

  let error: string | null = null;
  if (tweets.length === 0) {
    error = `X free scrape: discovery returned only other-author posts for @${h}; check the handle`;
  } else if (postsThisWeek === 0) {
    error = `no posts yet this week for @${h} (backfilled ${Object.keys(weekly).length} week(s) from ${tweets.length} recent posts)`;
  } else if (!curPosts.some(hasAnyCount)) {
    error = `X free scrape: found ${postsThisWeek} post(s) this week but the engagement APIs were unreachable; numbers carry forward`;
  }

  return { values, error, tweets: metrics, weekly, evidence };
}

import { type Platform } from "./types";

// Free, best-effort metric collectors. Each social collector returns a numeric
// value or an error string (never throws to the caller). On any failure the
// caller keeps the previous value and surfaces `error`.

export interface CollectorResult {
  value: number | null;
  error: string | null;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 MakinaPulse/1.0";

async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  ms = 9000
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, ...(opts.headers || {}) },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Parse "12 345", "1,234", "12.3K", "1.2M" → integer. */
export function parseHumanNumber(raw: string): number | null {
  const cleaned = raw.replace(/[  ]/g, " ").trim();
  // Abbreviated form: 12.3K / 1.2M / 4B (letter glued to the number), never
  // a letter that merely starts a following word like "members".
  const abbr = cleaned.match(/(\d+(?:\.\d+)?)\s?([KkMmBb])\b/);
  if (abbr) {
    let n = parseFloat(abbr[1]);
    const s = abbr[2].toLowerCase();
    if (s === "k") n *= 1e3;
    else if (s === "m") n *= 1e6;
    else if (s === "b") n *= 1e9;
    return Math.round(n);
  }
  // Full form: space/comma-grouped digits, take the first run.
  const full = cleaned.match(/\d[\d.,\s]*\d|\d/);
  if (!full) return null;
  const n = parseFloat(full[0].replace(/[,\s]/g, ""));
  return Number.isNaN(n) ? null : Math.round(n);
}

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "AbortError") return "request timed out";
    return e.message;
  }
  return String(e);
}

// ── Telegram: scrape the public channel page for subscriber count ──
// Robust across both shapes Telegram serves:
//   • info page  t.me/<c>   → <div class="tgme_page_extra">123 456 subscribers</div> (full number)
//   • web preview t.me/s/<c> → <span class="counter_value">12.3K</span><span class="counter_type">subscribers</span>
export function parseTelegramCount(html: string): number | null {
  // 1) Info page (full, exact number).
  const extra = html.match(/tgme_page_extra"[^>]*>([^<]*(?:subscriber|member)[^<]*)</i);
  if (extra) {
    const v = parseHumanNumber(extra[1]);
    if (v != null) return v;
  }
  // 2) Web-preview header counter (abbreviated, e.g. 12.3K).
  const counter = html.match(
    /counter_value"[^>]*>\s*([\d.,\s]+[KMB]?)\s*<\/span>\s*<span[^>]*counter_type"[^>]*>\s*(?:subscriber|member)/i
  );
  if (counter) {
    const v = parseHumanNumber(counter[1]);
    if (v != null) return v;
  }
  // 3) Generic safety net: any "<n> subscribers/members" on the page.
  const generic = html.match(/([\d][\d.,\s]*\s*[KMB]?)\s*(?:subscriber|member)/i);
  if (generic) {
    const v = parseHumanNumber(generic[1]);
    if (v != null) return v;
  }
  return null;
}

async function collectTelegram(channel: string): Promise<CollectorResult> {
  const handle = channel
    .replace(/^@/, "")
    .replace(/^https?:\/\/t\.me\//, "")
    .replace(/^s\//, "")
    .replace(/\/$/, "");
  // Info page first (exact number), then the web preview (more reliably served).
  for (const url of [
    `https://t.me/${encodeURIComponent(handle)}`,
    `https://t.me/s/${encodeURIComponent(handle)}`,
  ]) {
    try {
      const res = await fetchWithTimeout(url, { headers: { "Accept-Language": "en" } }, 8000);
      if (!res.ok) continue;
      const v = parseTelegramCount(await res.text());
      // Guard against gross misparses, no Telegram channel exceeds ~100M.
      if (v != null && v > 0 && v <= 100_000_000) return { value: v, error: null };
    } catch {
      // try next URL
    }
  }
  return { value: null, error: "Telegram: no public subscriber count (private channel or wrong handle)" };
}

// ── Discord: invite endpoint with approximate counts (no auth) ──
async function collectDiscord(inviteCode: string): Promise<CollectorResult> {
  const code = inviteCode
    .replace(/^https?:\/\/(discord\.gg|discord\.com\/invite)\//, "")
    .replace(/\/$/, "");
  try {
    const res = await fetchWithTimeout(
      `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`
    );
    if (!res.ok) return { value: null, error: `Discord HTTP ${res.status} (invalid/expired invite?)` };
    const data = (await res.json()) as { approximate_member_count?: number };
    const v = data?.approximate_member_count;
    return typeof v === "number"
      ? { value: v, error: null }
      : { value: null, error: "Discord: no approximate_member_count" };
  } catch (e) {
    return { value: null, error: `Discord: ${errMsg(e)}` };
  }
}

// ── Reddit: subreddit about.json subscriber count ──
async function collectReddit(sub: string): Promise<CollectorResult> {
  const name = sub.replace(/^\/?r\//, "").replace(/\/$/, "");
  try {
    const res = await fetchWithTimeout(
      `https://www.reddit.com/r/${encodeURIComponent(name)}/about.json`
    );
    if (!res.ok) return { value: null, error: `Reddit HTTP ${res.status}` };
    const data = (await res.json()) as { data?: { subscribers?: number } };
    const v = data?.data?.subscribers;
    return typeof v === "number"
      ? { value: v, error: null }
      : { value: null, error: "Reddit: no subscriber count" };
  } catch (e) {
    return { value: null, error: `Reddit: ${errMsg(e)}` };
  }
}

// ── GitHub: public account follower count (rough community proxy) ──
async function collectGithub(slug: string): Promise<CollectorResult> {
  const name = slug.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  // Optional token raises the rate limit from 60/hr to 5000/hr.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(name)}`, {
      headers,
    });
    if (res.status === 403) return { value: null, error: "GitHub rate-limited (set GITHUB_TOKEN)" };
    if (!res.ok) return { value: null, error: `GitHub HTTP ${res.status}` };
    const data = (await res.json()) as { followers?: number };
    const v = data?.followers;
    return typeof v === "number"
      ? { value: v, error: null }
      : { value: null, error: "GitHub: no follower count" };
  } catch (e) {
    return { value: null, error: `GitHub: ${errMsg(e)}` };
  }
}

// ── Reader-proxy scrape (free) for sites with no public API / JS-gated pages.
// r.jina.ai renders the target and returns text we can grep for a count. ──
async function readerText(targetUrl: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`https://r.jina.ai/${targetUrl}`, {}, 8000);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Free search-snippet workaround: DuckDuckGo's HTML endpoint (no key, no JS,
// scrape-tolerant) surfaces "N followers" in result snippets for JS-gated
// pages like X and LinkedIn. We grep the closest number to a `near` keyword.
async function ddgFollowers(query: string, near = "followers"): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { headers: { Accept: "text/html" } },
      8000
    );
    if (!res.ok) return null;
    const text = (await res.text()).replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
    const re = new RegExp(`([\\d][\\d.,]*\\s*[KMB]?)\\s*${near}`, "i");
    const m = text.match(re);
    return m ? parseHumanNumber(m[1]) : null;
  } catch {
    return null;
  }
}

// Bing tends to surface "N Followers" in result snippets and is more
// scrape-tolerant than Google from server IPs.
async function bingFollowers(query: string): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
      { headers: { Accept: "text/html" } },
      8000
    );
    if (!res.ok) return null;
    const text = (await res.text()).replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
    const m = text.match(/([\d][\d.,]*\s*[KMB]?)\s*Followers/i);
    return m ? parseHumanNumber(m[1]) : null;
  } catch {
    return null;
  }
}

// Nitter instances render X profiles server-side (no login/JS) and print the
// exact follower count. Public instances rotate, so we try a list and take the
// first that answers. This is the most reliable FREE source for exact counts.
const NITTER_HOSTS = [
  "xcancel.com",
  "nitter.poast.org",
  "nitter.privacydev.net",
  "lightbrd.com",
  "nitter.net",
];

async function nitterFollowers(handle: string): Promise<number | null> {
  // Query all instances in parallel; first one to yield a count wins (~7s cap
  // regardless of how many instances are down).
  const attempts = NITTER_HOSTS.map(async (host) => {
    const res = await fetchWithTimeout(`https://${host}/${encodeURIComponent(handle)}`, {}, 7000);
    if (!res.ok) throw new Error(`nitter ${host} ${res.status}`);
    const html = await res.text();
    // <li class="followers">…<span class="profile-stat-num">12,345</span></li>
    const m = html.match(/followers"[\s\S]*?profile-stat-num"\s*>\s*([\d.,]+)/i);
    const v = m ? parseHumanNumber(m[1]) : null;
    if (v == null) throw new Error(`nitter ${host} no count`);
    return v;
  });
  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

// Public web bearer X's own site ships to logged-out visitors. Used only to
// mint a guest token + read public follower counts (same as an anonymous tab).
const X_WEB_BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
let xGuestCache: { token: string; at: number } | null = null;

async function xGuestToken(): Promise<string | null> {
  if (xGuestCache && Date.now() - xGuestCache.at < 2 * 3_600_000) return xGuestCache.token;
  try {
    const res = await fetchWithTimeout(
      "https://api.x.com/1.1/guest/activate.json",
      { method: "POST", headers: { Authorization: `Bearer ${X_WEB_BEARER}` } },
      8000
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { guest_token?: string };
    if (d?.guest_token) {
      xGuestCache = { token: d.guest_token, at: Date.now() };
      return d.guest_token;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function xGraphqlFollowers(handle: string, guest: string): Promise<number | null> {
  const variables = encodeURIComponent(JSON.stringify({ screen_name: handle, withSafetyModeUserFields: false }));
  const features = encodeURIComponent(
    JSON.stringify({
      hidden_profile_subscriptions_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      subscriptions_verification_info_is_identity_verified_enabled: true,
      subscriptions_verification_info_verified_since_enabled: true,
      highlights_tweets_tab_ui_enabled: true,
      responsive_web_twitter_article_notes_tab_enabled: true,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true,
    })
  );
  // UserByScreenName query id drifts over time; failure is non-fatal (returns null).
  const qid = "Yka-W8dz7RaEuQNkroPkYw";
  try {
    const res = await fetchWithTimeout(
      `https://api.x.com/graphql/${qid}/UserByScreenName?variables=${variables}&features=${features}`,
      {
        headers: {
          Authorization: `Bearer ${X_WEB_BEARER}`,
          "x-guest-token": guest,
          "x-twitter-active-user": "yes",
          "x-twitter-client-language": "en",
        },
      },
      9000
    );
    if (!res.ok) return null;
    const d = (await res.json()) as {
      data?: { user?: { result?: { legacy?: { followers_count?: number } } } };
    };
    const v = d?.data?.user?.result?.legacy?.followers_count;
    return typeof v === "number" ? v : null;
  } catch {
    return null;
  }
}

// ── X / Twitter follower count, layered so it works for free on a real
// network (this is what an anonymous browser tab does). ──
async function collectTwitter(handle: string): Promise<CollectorResult> {
  const h = handle.replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//, "").replace(/\/$/, "");

  // 1) Official X API v2 (most reliable) when X_BEARER_TOKEN is configured.
  const bearer = process.env.X_BEARER_TOKEN;
  if (bearer) {
    try {
      const res = await fetchWithTimeout(
        `https://api.twitter.com/2/users/by/username/${encodeURIComponent(h)}?user.fields=public_metrics`,
        { headers: { Authorization: `Bearer ${bearer}` } }
      );
      if (res.ok) {
        const d = (await res.json()) as { data?: { public_metrics?: { followers_count?: number } } };
        const v = d?.data?.public_metrics?.followers_count;
        if (typeof v === "number") return { value: v, error: null };
      }
    } catch {
      /* fall through to free methods */
    }
  }

  // 2) Free, exact: Nitter instances (server-rendered, no login/JS).
  const nv = await nitterFollowers(h);
  if (nv != null) return { value: nv, error: null };

  // 3) Free: guest token + GraphQL (what a logged-out x.com tab does).
  const guest = await xGuestToken();
  if (guest) {
    const v = await xGraphqlFollowers(h, guest);
    if (v != null) return { value: v, error: null };
  }

  // 4) Free: Follow-button widget JSON used by embeds.
  try {
    const res = await fetchWithTimeout(
      `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${encodeURIComponent(h)}`
    );
    if (res.ok) {
      const arr = (await res.json()) as Array<{ followers_count?: number }>;
      const v = Array.isArray(arr) ? arr[0]?.followers_count : undefined;
      if (typeof v === "number") return { value: v, error: null };
    }
  } catch {
    /* fall through */
  }

  // 5) Reader-proxy of the profile.
  const text = await readerText(`https://x.com/${encodeURIComponent(h)}`);
  if (text) {
    const m =
      text.match(/([\d.,]+\s*[KMB]?)\s*Followers/i) || text.match(/Followers[:\s]*([\d.,]+\s*[KMB]?)/i);
    if (m) {
      const v = parseHumanNumber(m[1]);
      if (v != null) return { value: v, error: null };
    }
  }

  // 6) Search-engine snippets (DuckDuckGo, then Bing).
  const sv =
    (await ddgFollowers(`${h} x.com followers`)) ??
    (await ddgFollowers(`@${h} twitter followers`)) ??
    (await bingFollowers(`${h} x.com followers`));
  if (sv != null) return { value: sv, error: null };

  return { value: null, error: "X: every source rate-limited/blocked, will retry next cycle" };
}

// ── LinkedIn company followers, auto via reader proxy + search snippet.
// (LinkedIn auth-walls scraping, so the snippet workaround is the real win.) ──
async function collectLinkedin(slug: string): Promise<CollectorResult> {
  const s = slug.replace(/^https?:\/\/(www\.)?linkedin\.com\/company\//, "").replace(/\/$/, "");

  // 1) Reader proxy of the public company page.
  const text = await readerText(`https://www.linkedin.com/company/${encodeURIComponent(s)}`);
  if (text) {
    const m = text.match(/([\d.,]+\s*[KMB]?)\s*followers/i);
    if (m) {
      const v = parseHumanNumber(m[1]);
      if (v != null) return { value: v, error: null };
    }
  }

  // 2) Search-snippet workaround, "<company> | LinkedIn ... N followers".
  const sv =
    (await ddgFollowers(`${s} site:linkedin.com/company followers`)) ??
    (await ddgFollowers(`${s} linkedin company followers`));
  if (sv != null) return { value: sv, error: null };

  return { value: null, error: "LinkedIn: page walled & snippet missed, will retry next cycle" };
}

/** Strip protocol / www / path → bare registrable domain. */
function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();
}

// ── Website traffic, best-effort estimated monthly visits via Similarweb's
// public data endpoint (unofficial, no key). It is rate-limited and only
// populated for domains Similarweb actually ranks, so smaller sites legitimately
// return nothing, in which case the value stays blank, by design. ──
async function collectWebsite(domainOrUrl: string): Promise<CollectorResult> {
  const domain = normalizeDomain(domainOrUrl);
  if (!domain) return { value: null, error: "Website: no domain" };
  try {
    const res = await fetchWithTimeout(
      `https://data.similarweb.com/api/v1/data?domain=${encodeURIComponent(domain)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) {
      return {
        value: null,
        error: `Website: Similarweb HTTP ${res.status} (domain may be unranked)`,
      };
    }
    const data = (await res.json()) as {
      EstimatedMonthlyVisits?: Record<string, number>;
      Engagments?: { Visits?: string | number };
    };
    // Prefer the most recent month from the estimated-visits series.
    const emv = data?.EstimatedMonthlyVisits;
    if (emv && typeof emv === "object") {
      const months = Object.keys(emv).sort();
      const latest = months.length ? emv[months[months.length - 1]] : undefined;
      if (typeof latest === "number" && latest > 0) return { value: Math.round(latest), error: null };
    }
    // Fallback: the headline "Visits" engagement figure.
    const rawVisits = data?.Engagments?.Visits;
    const v = typeof rawVisits === "string" ? parseFloat(rawVisits) : rawVisits;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return { value: Math.round(v), error: null };
    return { value: null, error: "Website: no visit estimate available" };
  } catch (e) {
    return { value: null, error: `Website: ${errMsg(e)}` };
  }
}

/** Platform → collector. Platforms without an entry are manual-only. */
export const COLLECTORS: Partial<Record<Platform, (key: string) => Promise<CollectorResult>>> = {
  telegram: collectTelegram,
  discord: collectDiscord,
  reddit: collectReddit,
  github: collectGithub,
  twitter: collectTwitter,
  linkedin: collectLinkedin,
  website: collectWebsite,
};

// ── DefiLlama on-chain metrics (free API) ──

export interface DefillamaFetch {
  ok: boolean;
  error: string | null;
  tvl: number | null;
  tvlChange1d: number | null;
  tvlChange7d: number | null;
  mcap: number | null;
  fees24h: number | null;
  fees7d: number | null;
  fees30d: number | null;
  revenue24h: number | null;
  revenue30d: number | null;
  history: { t: string; v: number }[];
}

function blankDefillama(error: string): DefillamaFetch {
  return {
    ok: false,
    error,
    tvl: null,
    tvlChange1d: null,
    tvlChange7d: null,
    mcap: null,
    fees24h: null,
    fees7d: null,
    fees30d: null,
    revenue24h: null,
    revenue30d: null,
    history: [],
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;

/** Fetch fees or revenue totals; null fields when the protocol has no listing. */
async function fetchFeesSummary(
  slug: string,
  dataType: "dailyFees" | "dailyRevenue"
): Promise<{ t24: number | null; t7: number | null; t30: number | null }> {
  try {
    const res = await fetchWithTimeout(
      `https://api.llama.fi/summary/fees/${encodeURIComponent(slug)}?dataType=${dataType}`,
      {},
      10000
    );
    if (!res.ok) return { t24: null, t7: null, t30: null };
    const d = (await res.json()) as { total24h?: number; total7d?: number; total30d?: number };
    return { t24: num(d.total24h), t7: num(d.total7d), t30: num(d.total30d) };
  } catch {
    return { t24: null, t7: null, t30: null };
  }
}

export async function fetchDefillama(slug: string): Promise<DefillamaFetch> {
  const s = slug.trim();
  if (!s) return blankDefillama("no slug");
  try {
    const res = await fetchWithTimeout(
      `https://api.llama.fi/protocol/${encodeURIComponent(s)}`,
      {},
      12000
    );
    if (!res.ok)
      return blankDefillama(`DefiLlama HTTP ${res.status}${res.status === 404 ? " (unknown slug)" : ""}`);
    const data = (await res.json()) as {
      tvl?: { date: number; totalLiquidityUSD: number }[];
      mcap?: number;
    };
    const arr = Array.isArray(data.tvl)
      ? data.tvl.filter((p) => p && typeof p.totalLiquidityUSD === "number" && typeof p.date === "number")
      : [];

    let tvl: number | null = null;
    let c1: number | null = null;
    let c7: number | null = null;
    let history: { t: string; v: number }[] = [];

    if (arr.length) {
      const last = arr[arr.length - 1];
      tvl = Math.round(last.totalLiquidityUSD);
      const at = (days: number) => {
        const target = last.date - days * 86400;
        for (let i = arr.length - 1; i >= 0; i--) if (arr[i].date <= target) return arr[i];
        return null;
      };
      const p1 = at(1);
      const p7 = at(7);
      if (p1 && p1.totalLiquidityUSD > 0)
        c1 = round2(((last.totalLiquidityUSD - p1.totalLiquidityUSD) / p1.totalLiquidityUSD) * 100);
      if (p7 && p7.totalLiquidityUSD > 0)
        c7 = round2(((last.totalLiquidityUSD - p7.totalLiquidityUSD) / p7.totalLiquidityUSD) * 100);
      // One-time backfill: up to 90 days of daily TVL so the sparkline is
      // populated on the very first refresh (not just going forward).
      history = arr.slice(-90).map((p) => ({
        t: new Date(p.date * 1000).toISOString().slice(0, 10),
        v: Math.round(p.totalLiquidityUSD),
      }));
    }

    const [fees, rev] = await Promise.all([
      fetchFeesSummary(s, "dailyFees"),
      fetchFeesSummary(s, "dailyRevenue"),
    ]);

    return {
      ok: true,
      error: arr.length ? null : "DefiLlama: no TVL history",
      tvl,
      tvlChange1d: c1,
      tvlChange7d: c7,
      mcap: num(data.mcap),
      fees24h: fees.t24,
      fees7d: fees.t7,
      fees30d: fees.t30,
      revenue24h: rev.t24,
      revenue30d: rev.t30,
      history,
    };
  } catch (e) {
    return blankDefillama(`DefiLlama: ${errMsg(e)}`);
  }
}

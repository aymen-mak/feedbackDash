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
  const m = cleaned.match(/([\d][\d.,\s]*)\s*([KkMmBb])?/);
  if (!m) return null;
  const numStr = m[1].replace(/[,\s]/g, "");
  let n = parseFloat(numStr);
  if (Number.isNaN(n)) return null;
  const suffix = (m[2] || "").toLowerCase();
  if (suffix === "k") n *= 1e3;
  else if (suffix === "m") n *= 1e6;
  else if (suffix === "b") n *= 1e9;
  return Math.round(n);
}

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "AbortError") return "request timed out";
    return e.message;
  }
  return String(e);
}

// ── Telegram: scrape public channel page for subscriber count ──
async function collectTelegram(channel: string): Promise<CollectorResult> {
  const handle = channel.replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "").replace(/\/$/, "");
  try {
    const res = await fetchWithTimeout(`https://t.me/${encodeURIComponent(handle)}`);
    if (!res.ok) return { value: null, error: `Telegram HTTP ${res.status}` };
    const html = await res.text();
    const extra = html.match(/tgme_page_extra"[^>]*>([^<]+)</);
    if (!extra) return { value: null, error: "Telegram: no public counter (private or not found)" };
    const text = extra[1];
    if (!/subscriber|member/i.test(text)) {
      return { value: null, error: "Telegram: page has no subscriber count" };
    }
    const value = parseHumanNumber(text);
    return value != null ? { value, error: null } : { value: null, error: "Telegram: unparseable count" };
  } catch (e) {
    return { value: null, error: `Telegram: ${errMsg(e)}` };
  }
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
  try {
    const res = await fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(name)}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
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
    const res = await fetchWithTimeout(`https://r.jina.ai/${targetUrl}`, {}, 15000);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ── X / Twitter: best-effort follower scrape (no free API) ──
async function collectTwitter(handle: string): Promise<CollectorResult> {
  const h = handle.replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//, "").replace(/\/$/, "");
  const text = await readerText(`https://x.com/${encodeURIComponent(h)}`);
  if (!text) return { value: null, error: "X: profile not reachable (enter manually)" };
  // Look for "<n> Followers" or "Followers <n>" in the rendered text.
  const m =
    text.match(/([\d.,]+\s*[KMB]?)\s*Followers/i) || text.match(/Followers[:\s]*([\d.,]+\s*[KMB]?)/i);
  if (!m) return { value: null, error: "X: follower count not found (enter manually)" };
  const value = parseHumanNumber(m[1]);
  return value != null ? { value, error: null } : { value: null, error: "X: unparseable count" };
}

// ── LinkedIn: best-effort follower scrape of the public company page ──
async function collectLinkedin(slug: string): Promise<CollectorResult> {
  const s = slug.replace(/^https?:\/\/(www\.)?linkedin\.com\/company\//, "").replace(/\/$/, "");
  const text = await readerText(`https://www.linkedin.com/company/${encodeURIComponent(s)}`);
  if (!text) return { value: null, error: "LinkedIn: page not reachable (enter manually)" };
  const m = text.match(/([\d.,]+\s*[KMB]?)\s*followers/i);
  if (!m) return { value: null, error: "LinkedIn: follower count not found (enter manually)" };
  const value = parseHumanNumber(m[1]);
  return value != null ? { value, error: null } : { value: null, error: "LinkedIn: unparseable count" };
}

/** Platform → collector. Platforms without an entry are manual-only. */
export const COLLECTORS: Partial<Record<Platform, (key: string) => Promise<CollectorResult>>> = {
  telegram: collectTelegram,
  discord: collectDiscord,
  reddit: collectReddit,
  github: collectGithub,
  twitter: collectTwitter,
  linkedin: collectLinkedin,
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
      history = arr.slice(-30).map((p) => ({
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

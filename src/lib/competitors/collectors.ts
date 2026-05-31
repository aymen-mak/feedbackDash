import { type Platform } from "./types";

// Free, best-effort metric collectors. Each returns a numeric value or an
// error string (never throws to the caller). They are intentionally tolerant:
// on any failure the caller keeps the previous value and surfaces `error`.

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
  const cleaned = raw.replace(/[   ]/g, " ").trim();
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

// ── Telegram: scrape public channel page for subscriber count ──
async function collectTelegram(channel: string): Promise<CollectorResult> {
  const handle = channel.replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "").replace(/\/$/, "");
  try {
    const res = await fetchWithTimeout(`https://t.me/${encodeURIComponent(handle)}`);
    if (!res.ok) return { value: null, error: `Telegram HTTP ${res.status}` };
    const html = await res.text();
    // The subscriber/member count lives in <div class="tgme_page_extra">N subscribers</div>
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

// ── Twitter / X: no free follower API. Best-effort placeholder that keeps the
// metric manual. Kept so the framework is uniform and future-proof. ──
async function collectTwitter(_handle: string): Promise<CollectorResult> {
  return {
    value: null,
    error: "X has no free follower API — enter this value manually.",
  };
}

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "AbortError") return "request timed out";
    return e.message;
  }
  return String(e);
}

/** Platform → collector. Platforms without an entry are manual-only. */
export const COLLECTORS: Partial<Record<Platform, (key: string) => Promise<CollectorResult>>> = {
  telegram: collectTelegram,
  discord: collectDiscord,
  reddit: collectReddit,
  github: collectGithub,
  twitter: collectTwitter,
};

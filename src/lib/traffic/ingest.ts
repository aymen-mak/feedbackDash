import { type TrafficWeek, type WeekResearch, type Insight } from "./types";

// Research only. Metrics are extracted deterministically in parse.ts with no API
// key. This module takes an already-parsed week and asks Claude (with web search)
// to research the current cross-industry meta (web2 / web3 / AI / robotics) and
// return data-cited insights + suggestions. When no key is set, or the call fails
// or times out, the caller falls back to the heuristic research in insights.ts,
// so uploads always succeed with metrics and insights either way.

const API = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.TRAFFIC_MODEL || "claude-sonnet-5-5";
const TIMEOUT_MS = 55_000; // stay under the route's maxDuration

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM = `You are a senior web-growth analyst for Makina, a DeFi vault execution engine (makina.finance). You are given one week of web-traffic metrics as JSON. Return STRICT JSON only, no prose, no code fences.

Research the current meta (use web search) on web growth, SEO and AEO, acquisition, audience and retention across the whole tech landscape (web2, web3/crypto, AI and robotics), plus how leading sites beyond Makina's direct competitors are winning reach right now. Apply what you find to THIS week's numbers.

Insights must cite the week's actual numbers, never generic. Suggestions must be concrete, reflect current best practice you found, and tie back to the data. Aim for 6 to 9 insights and 6 to 9 suggestions.

Writing style: plain, direct language a person would use out loud. No em dashes. No marketing cliches (double down, lean into, leverage, unlock, supercharge, game-changer, robust, seamless, testament to). No "not just X but Y". No forced groups of three. Short sentences. Let the numbers carry the point.

Return exactly this JSON shape:
{"summary":"","insights":[{"lens":"Volume|Acquisition|Audience|Content|Devices|Cadence","tone":"good|watch|bad|info","title":"","detail":""}],"suggestions":[""],"sources":[{"title":"","url":""}]}`;

interface RawResearch {
  summary?: string;
  insights?: Insight[];
  suggestions?: string[];
  sources?: { title: string; url: string }[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function extractJson(text: string): RawResearch | null {
  const fenced = text.replace(/```json\s*|\s*```/g, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as RawResearch;
  } catch {
    return null;
  }
}

function metricsFor(week: TrafficWeek) {
  return {
    label: week.label,
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    source: week.source,
    visitors: week.visitors,
    pageviews: week.pageviews,
    visitorsPrev: week.visitorsPrev,
    pageviewsPrev: week.pageviewsPrev,
    daily: week.daily,
    sources: week.sources,
    countries: week.countries,
    routes: week.routes,
    devices: week.devices,
    observations: week.observations,
  };
}

async function callClaude(week: TrafficWeek, withSearch: boolean, signal: AbortSignal): Promise<string> {
  const body = {
    model: MODEL,
    max_tokens: 6000,
    system: SYSTEM,
    ...(withSearch ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }] } : {}),
    messages: [
      {
        role: "user",
        content: `Here is the week's traffic. Research the current cross-industry meta, then return the research JSON.\n\n${JSON.stringify(metricsFor(week))}`,
      },
    ],
  };
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
}

/** Research an already-parsed week with Claude. Returns null (never throws) when
 *  no key is set or the call fails/times out, so the caller uses the heuristic. */
export async function researchWeek(week: TrafficWeek): Promise<WeekResearch | null> {
  if (!aiConfigured()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let text: string;
    try {
      text = await callClaude(week, true, controller.signal);
    } catch (e) {
      // Web-search tool may be unavailable on this account/version: retry plain.
      if (/web_search|tool/i.test(String(e))) text = await callClaude(week, false, controller.signal);
      else throw e;
    }
    const r = extractJson(text);
    if (!r) return null;
    return {
      generatedAt: new Date().toISOString(),
      model: MODEL,
      summary: str(r.summary),
      insights: Array.isArray(r.insights) ? r.insights.slice(0, 12) : [],
      suggestions: Array.isArray(r.suggestions) ? r.suggestions.map(str).filter(Boolean).slice(0, 12) : [],
      sources: Array.isArray(r.sources) ? r.sources.filter((s) => s && s.url).slice(0, 12) : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

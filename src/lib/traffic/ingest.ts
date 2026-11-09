import { type TrafficWeek, type WeekResearch, type Insight } from "./types";

// Automated ingest: hand the uploaded PDF to Claude with web search, which both
// extracts the week's metrics AND researches the current cross-industry meta
// (web2 / web3 / AI / robotics) to produce data-cited insights and suggestions.
// No chat interaction required. Falls back cleanly when no key is configured.

const API = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.TRAFFIC_MODEL || "claude-sonnet-5-5";

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM = `You are a senior web-growth analyst for Makina, a DeFi vault execution engine (makina.finance). You read a weekly web-traffic PDF and return STRICT JSON only — no prose, no code fences.

Do two things:
1. EXTRACT every metric from the PDF exactly into the schema below. Copy numbers verbatim; never invent rows. Prior-period columns map to the "prior" fields; null when absent.
2. RESEARCH the current meta (use web search) on web growth, SEO/AEO, acquisition, audience and retention across the WHOLE tech landscape — web2, web3/crypto, AI and robotics — plus how leading sites (not only Makina's direct competitors) are winning reach right now. Apply it to THIS week's numbers.

Insights must be specific and cite the week's actual numbers, never generic. Suggestions must be concrete, current (reflect 2026 best practice you found), and tied to the data. Aim for 6 to 9 insights and 6 to 9 suggestions.

Writing style: plain, direct language a person would use out loud. No em dashes. No marketing cliches ("double down", "lean into", "leverage", "unlock", "supercharge", "game-changer", "robust", "seamless", "testament to"). No "not just X but Y" constructions. No forced groups of three. Short sentences. Let the numbers carry the point.

Return exactly this JSON shape:
{"week":{"weekStart":"YYYY-MM-DD","weekEnd":"YYYY-MM-DD","label":"","source":"","visitors":0,"pageviews":0,"visitorsPrev":0,"pageviewsPrev":0,"daily":[{"day":"","visitors":0,"pageviews":0}],"sources":[{"name":"","visitors":0,"pageviews":0,"priorVisitors":0}],"countries":[{"name":"","visitors":0,"pageviews":0,"priorVisitors":0}],"routes":[{"name":"","visitors":0,"pageviews":0,"priorVisitors":0}],"devices":[{"name":"","visitors":0,"pageviews":0,"priorVisitors":0,"priorPageviews":0}],"observations":""},"research":{"summary":"","insights":[{"lens":"Volume|Acquisition|Audience|Content|Devices|Cadence","tone":"good|watch|bad|info","title":"","detail":""}],"suggestions":[""],"sources":[{"title":"","url":""}]}}`;

interface RawResult {
  week: Record<string, unknown>;
  research: { summary?: string; insights?: Insight[]; suggestions?: string[]; sources?: { title: string; url: string }[] };
}

function extractJson(text: string): RawResult | null {
  const fenced = text.replace(/```json\s*|\s*```/g, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as RawResult;
  } catch {
    return null;
  }
}

async function callClaude(pdfBase64: string, withSearch: boolean): Promise<string> {
  const body = {
    model: MODEL,
    max_tokens: 6000,
    system: SYSTEM,
    ...(withSearch ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }] } : {}),
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
          { type: "text", text: "Extract this weekly web-traffic report and research the current cross-industry meta, then return the JSON." },
        ],
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
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" ? +v.replace(/[, ]/g, "") || 0 : 0);
const numOrNull = (v: unknown): number | null => (v == null ? null : num(v));
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function mapWeek(raw: Record<string, unknown>, research: WeekResearch): TrafficWeek {
  const arr = (k: string) => (Array.isArray(raw[k]) ? (raw[k] as Record<string, unknown>[]) : []);
  const weekStart = str(raw.weekStart) || new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  return {
    id: weekStart,
    weekStart,
    weekEnd: str(raw.weekEnd) || weekStart,
    label: str(raw.label) || weekStart,
    source: str(raw.source) || null,
    visitors: num(raw.visitors),
    pageviews: num(raw.pageviews),
    visitorsPrev: numOrNull(raw.visitorsPrev),
    pageviewsPrev: numOrNull(raw.pageviewsPrev),
    daily: arr("daily").map((d) => ({ day: str(d.day), visitors: num(d.visitors), pageviews: num(d.pageviews) })),
    sources: arr("sources").map((d) => ({ name: str(d.name), visitors: num(d.visitors), pageviews: num(d.pageviews), priorVisitors: numOrNull(d.priorVisitors) })),
    countries: arr("countries").map((d) => ({ name: str(d.name), visitors: num(d.visitors), pageviews: num(d.pageviews), priorVisitors: numOrNull(d.priorVisitors) })),
    routes: arr("routes").map((d) => ({ name: str(d.name), visitors: num(d.visitors), pageviews: num(d.pageviews), priorVisitors: numOrNull(d.priorVisitors) })),
    devices: arr("devices").map((d) => ({ name: str(d.name), visitors: num(d.visitors), pageviews: num(d.pageviews), priorVisitors: numOrNull(d.priorVisitors), priorPageviews: numOrNull(d.priorPageviews) })),
    observations: str(raw.observations) || null,
    research,
    createdAt: now,
    updatedAt: now,
  };
}

/** Ingest a PDF via Claude. Throws on failure so the caller can report it. */
export async function ingestPdf(pdfBase64: string): Promise<TrafficWeek> {
  if (!aiConfigured()) throw new Error("ANTHROPIC_API_KEY is not set on this deployment.");
  let text: string;
  try {
    text = await callClaude(pdfBase64, true);
  } catch (e) {
    // Web-search tool may be unavailable on this account/version — retry plain.
    if (/web_search|tool/i.test(String(e))) text = await callClaude(pdfBase64, false);
    else throw e;
  }
  const parsed = extractJson(text);
  if (!parsed || !parsed.week) throw new Error("Could not parse the report. Check the PDF or model output.");
  const r = parsed.research ?? {};
  const research: WeekResearch = {
    generatedAt: new Date().toISOString(),
    model: MODEL,
    summary: str(r.summary),
    insights: Array.isArray(r.insights) ? r.insights.slice(0, 12) : [],
    suggestions: Array.isArray(r.suggestions) ? r.suggestions.map(str).filter(Boolean).slice(0, 12) : [],
    sources: Array.isArray(r.sources) ? r.sources.filter((s) => s && s.url).slice(0, 12) : [],
  };
  return mapWeek(parsed.week, research);
}

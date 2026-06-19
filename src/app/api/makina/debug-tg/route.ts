import { NextRequest, NextResponse } from "next/server";

// TEMPORARY diagnostic — discover an Apify Telegram actor's input schema and
// output shape so we can wire the collector. Remove once Telegram works.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const CHANNEL_FIELDS = ["profiles", "profile", "channels", "channelUrls", "channelUsernames", "usernames", "channelInputCsv", "startUrls", "channel", "urls"];
const LIMIT_FIELDS = ["maxPosts", "maxItems", "limit", "resultsLimit", "maxMessages", "postsCount", "maxResults"];

interface Field {
  name: string;
  type?: unknown;
  editor?: unknown;
  prefill?: unknown;
}

export async function GET(req: NextRequest) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_TOKEN not set on this deployment/env" }, { status: 500 });
  const t = encodeURIComponent(token);
  const actorId = (req.nextUrl.searchParams.get("actor") || "tri_angle~telegram-scraper").replace("/", "~");
  const channel = (req.nextUrl.searchParams.get("channel") || "makinafinance").replace(/^@/, "");

  // 1) Input schema from the latest build.
  let fields: Field[] = [];
  let required: string[] = [];
  let buildId: string | undefined;
  let schemaErr: string | undefined;
  try {
    const a = await fetch(`https://api.apify.com/v2/acts/${actorId}?token=${t}`, { cache: "no-store" });
    const aj = (await a.json()) as { data?: { taggedBuilds?: { latest?: { buildId?: string } } } };
    buildId = aj?.data?.taggedBuilds?.latest?.buildId;
    if (buildId) {
      const b = await fetch(`https://api.apify.com/v2/acts/${actorId}/builds/${buildId}?token=${t}`, { cache: "no-store" });
      const bj = (await b.json()) as { data?: { inputSchema?: string } };
      const raw = bj?.data?.inputSchema;
      if (raw) {
        const s = JSON.parse(raw) as {
          required?: string[];
          properties?: Record<string, { type?: unknown; editor?: unknown; prefill?: unknown; default?: unknown; example?: unknown }>;
        };
        required = s.required ?? [];
        fields = Object.entries(s.properties ?? {}).map(([name, p]) => ({
          name,
          type: p.type,
          editor: p.editor,
          prefill: p.prefill ?? p.default ?? p.example,
        }));
      }
    }
  } catch (e) {
    schemaErr = e instanceof Error ? e.message : String(e);
  }

  // 2) Heuristic input: required prefills + the channel field + a small limit.
  const names = new Set(fields.map((f) => f.name));
  const input: Record<string, unknown> = {};
  for (const f of fields) if (required.includes(f.name) && f.prefill !== undefined) input[f.name] = f.prefill;
  const chField = CHANNEL_FIELDS.find((n) => names.has(n));
  if (chField) {
    const f = fields.find((x) => x.name === chField)!;
    const wantsUrl = chField.toLowerCase().includes("url");
    input[chField] = f.type === "array" ? [wantsUrl ? `https://t.me/${channel}` : channel] : wantsUrl ? `https://t.me/${channel}` : channel;
  }
  const limField = LIMIT_FIELDS.find((n) => names.has(n));
  if (limField) input[limField] = 20;
  if (names.has("scrapeLastNDays")) input.scrapeLastNDays = 14;
  if (names.has("collectMessages")) input.collectMessages = true;

  // 3) Run it (if we found a channel field) and dump the output shape.
  let run: unknown = { skipped: "no recognizable channel field; see fields" };
  if (chField) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 55000);
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${t}&memory=1024`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input), signal: ctrl.signal, cache: "no-store" }
      );
      const text = await res.text();
      let json: unknown;
      try { json = JSON.parse(text); } catch { json = text; }
      const items = Array.isArray(json) ? (json as Array<Record<string, unknown>>) : [];
      run = {
        httpStatus: res.status,
        itemCount: items.length,
        firstItemKeys: items[0] ? Object.keys(items[0]) : null,
        samples: items.slice(0, 2),
        nonArray: Array.isArray(json) ? undefined : json,
      };
    } catch (e) {
      run = { error: e instanceof Error ? e.message : String(e) };
    } finally {
      clearTimeout(timer);
    }
  }

  return NextResponse.json({ actorId, buildId, required, fields, chosenInput: input, run, schemaErr });
}

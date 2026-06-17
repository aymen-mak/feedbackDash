import { NextRequest, NextResponse } from "next/server";

// TEMPORARY diagnostic — fetch an actor's real INPUT SCHEMA from the Apify API
// so we know exactly which fields it accepts (scweet rejected our guesses).
// Remove once X collection works.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_TOKEN not set on this deployment/env" }, { status: 500 });

  const actorId = (req.nextUrl.searchParams.get("actor") || "altimis~scweet").replace("/", "~");
  const t = encodeURIComponent(token);

  try {
    // 1) actor -> latest build id
    const actorRes = await fetch(`https://api.apify.com/v2/acts/${actorId}?token=${t}`, { cache: "no-store" });
    const actorJson = (await actorRes.json()) as Record<string, unknown>;
    const data = (actorJson?.data ?? {}) as Record<string, unknown>;
    const tagged = (data.taggedBuilds ?? {}) as Record<string, { buildId?: string }>;
    const buildId = tagged?.latest?.buildId;

    if (!buildId) {
      return NextResponse.json({ actorId, note: "no latest build id", actorKeys: Object.keys(data) });
    }

    // 2) build -> inputSchema (stringified JSON)
    const buildRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/builds/${buildId}?token=${t}`, { cache: "no-store" });
    const buildJson = (await buildRes.json()) as Record<string, unknown>;
    const bdata = (buildJson?.data ?? {}) as Record<string, unknown>;
    const rawSchema = bdata.inputSchema as string | undefined;

    if (!rawSchema) {
      return NextResponse.json({ actorId, buildId, note: "no inputSchema on build", buildKeys: Object.keys(bdata) });
    }

    const schema = JSON.parse(rawSchema) as {
      required?: string[];
      properties?: Record<string, { type?: string; editor?: string; title?: string; prefill?: unknown; default?: unknown; example?: unknown }>;
    };
    const props = schema.properties ?? {};
    const fields = Object.entries(props).map(([name, p]) => ({
      name,
      type: p.type,
      editor: p.editor,
      title: p.title,
      prefill: p.prefill ?? p.default ?? p.example,
    }));

    return NextResponse.json({ actorId, buildId, required: schema.required ?? [], fields });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

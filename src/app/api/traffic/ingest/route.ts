import { NextRequest, NextResponse } from "next/server";
import { parsePdf } from "@/lib/traffic/parse";
import { researchWeek, aiConfigured } from "@/lib/traffic/ingest";
import { heuristicResearch } from "@/lib/traffic/insights";
import { upsertWeek, replaceAutoActions } from "@/lib/traffic/store";
import { type TrafficWeek } from "@/lib/traffic/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// AI research can take a while when a key is set; give the function room.
export const maxDuration = 60;

// Upload a weekly report PDF.
//   1) Metrics are extracted deterministically (parse.ts). No API key needed.
//   2) Research runs with Claude when ANTHROPIC_API_KEY is set, else a built-in
//      heuristic. A failed or timed-out AI call also falls back to the heuristic,
//      so the upload always succeeds with metrics and insights.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No PDF uploaded." }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0) return NextResponse.json({ error: "Empty file." }, { status: 400 });
    if (buf.length > 10 * 1024 * 1024) return NextResponse.json({ error: "PDF too large (max 10MB)." }, { status: 400 });

    // 1) Deterministic metric extraction.
    let parsed;
    try {
      parsed = await parsePdf(buf);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: m }, { status: 422 });
    }

    const now = new Date().toISOString();
    const week: TrafficWeek = {
      id: parsed.weekStart,
      weekStart: parsed.weekStart,
      weekEnd: parsed.weekEnd,
      label: parsed.label,
      source: parsed.source,
      visitors: parsed.visitors,
      pageviews: parsed.pageviews,
      visitorsPrev: parsed.visitorsPrev,
      pageviewsPrev: parsed.pageviewsPrev,
      daily: parsed.daily,
      sources: parsed.sources,
      countries: parsed.countries,
      routes: parsed.routes,
      devices: parsed.devices,
      observations: parsed.observations,
      research: null,
      createdAt: now,
      updatedAt: now,
    };

    // 2) Research: AI when configured, deterministic heuristic otherwise.
    const ai = aiConfigured() ? await researchWeek(week) : null;
    week.research = ai ?? heuristicResearch(week);

    await upsertWeek(week);
    await replaceAutoActions(week.id, week.research.suggestions);

    return NextResponse.json({ ok: true, week, researched: week.research.model !== "heuristic" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

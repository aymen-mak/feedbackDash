import { NextRequest, NextResponse } from "next/server";
import { ingestPdf } from "@/lib/traffic/ingest";
import { upsertWeek, replaceAutoActions } from "@/lib/traffic/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Claude + web search can take a while; give the function room.
export const maxDuration = 60;

// Upload a weekly report PDF. Claude extracts the metrics and researches the
// current cross-industry meta, returning data-cited insights + suggestions.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No PDF uploaded." }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0) return NextResponse.json({ error: "Empty file." }, { status: 400 });
    if (buf.length > 10 * 1024 * 1024) return NextResponse.json({ error: "PDF too large (max 10MB)." }, { status: 400 });

    const week = await ingestPdf(buf.toString("base64"));
    await upsertWeek(week);
    await replaceAutoActions(week.id, week.research?.suggestions ?? []);
    return NextResponse.json({ ok: true, week });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

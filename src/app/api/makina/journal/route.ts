import { NextRequest, NextResponse } from "next/server";
import { getJournal, upsertEntry, deleteEntry } from "@/lib/makina/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getJournal());
  } catch (err) {
    console.error("GET /api/makina/journal error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Manual upsert / backfill of a period's metrics.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = await upsertEntry(body);
    if (!entry) return NextResponse.json({ error: "Invalid account or period" }, { status: 400 });
    return NextResponse.json(entry);
  } catch (err) {
    console.error("POST /api/makina/journal error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const account = req.nextUrl.searchParams.get("account");
    const periodStart = req.nextUrl.searchParams.get("periodStart");
    if (!account || !periodStart) return NextResponse.json({ error: "Missing account/periodStart" }, { status: 400 });
    return NextResponse.json({ ok: await deleteEntry(account, periodStart) });
  } catch (err) {
    console.error("DELETE /api/makina/journal error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { diagnoseAll } from "@/lib/diagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// App-wide self-diagnostics: system + Makina metrics + competitor tracker.
export async function GET() {
  try {
    return NextResponse.json(await diagnoseAll());
  } catch (err) {
    console.error("GET /api/diagnose error:", err);
    return NextResponse.json({ error: String(err) }, { status: 200 });
  }
}

import { NextResponse } from "next/server";
import { diagnoseApify } from "@/lib/makina/diagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Health check behind the collectors, so the dashboard can self-diagnose.
export async function GET() {
  try {
    return NextResponse.json({ apify: await diagnoseApify(), at: new Date().toISOString() });
  } catch (err) {
    console.error("GET /api/makina/diagnose error:", err);
    return NextResponse.json({ error: String(err) }, { status: 200 });
  }
}

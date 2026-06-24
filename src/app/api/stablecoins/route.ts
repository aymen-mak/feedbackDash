import { NextResponse } from "next/server";
import { getStablecoins } from "@/lib/stablecoins/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Live stablecoin peg status across DefiLlama's full catalogue.
export async function GET() {
  try {
    return NextResponse.json(await getStablecoins());
  } catch (err) {
    console.error("GET /api/stablecoins error:", err);
    return NextResponse.json({ error: String(err) }, { status: 200 });
  }
}

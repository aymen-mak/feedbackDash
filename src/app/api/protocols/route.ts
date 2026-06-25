import { NextResponse } from "next/server";
import { getProtocolHealth } from "@/lib/protocols/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// TVL health of the protocols Makina vaults depend on (DefiLlama, for now).
export async function GET() {
  try {
    return NextResponse.json(await getProtocolHealth());
  } catch (err) {
    console.error("GET /api/protocols error:", err);
    return NextResponse.json({ error: String(err) }, { status: 200 });
  }
}

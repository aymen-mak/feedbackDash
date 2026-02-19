import { NextResponse } from "next/server";
import { getStats } from "@/lib/store";

export async function GET() {
  try {
    const stats = getStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("GET /api/stats error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

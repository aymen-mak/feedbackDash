import { NextResponse } from "next/server";
import { getLatestTweets } from "@/lib/makina/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cached per-post metrics from the last scrape (not live — respects quota).
export async function GET() {
  try {
    return NextResponse.json(await getLatestTweets());
  } catch (err) {
    console.error("GET /api/makina/tweets error:", err);
    return NextResponse.json({ byAccount: {} }, { status: 200 });
  }
}

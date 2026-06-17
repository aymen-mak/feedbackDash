import { NextRequest, NextResponse } from "next/server";
import { collectAndStore } from "@/lib/makina/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// The Apify scrape can take a while to return — give the function room.
export const maxDuration = 60;

// In-app "Collect now".
export async function POST(req: NextRequest) {
  try {
    const period = req.nextUrl.searchParams.get("period") || undefined;
    return NextResponse.json(await collectAndStore(period));
  } catch (err) {
    console.error("POST /api/makina/collect error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Cron entrypoint (see vercel.json). Protected by CRON_SECRET when set.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await collectAndStore());
  } catch (err) {
    console.error("GET /api/makina/collect error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

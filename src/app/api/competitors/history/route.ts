import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "@/lib/competitors/service";
import { PLATFORMS, type Platform } from "@/lib/competitors/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id") || undefined;
    const platformParam = req.nextUrl.searchParams.get("platform");
    const platform =
      platformParam && PLATFORMS.includes(platformParam as Platform)
        ? (platformParam as Platform)
        : undefined;
    return NextResponse.json(await getHistory(id, platform));
  } catch (err) {
    console.error("GET /api/competitors/history error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

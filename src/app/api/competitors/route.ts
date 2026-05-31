import { NextRequest, NextResponse } from "next/server";
import { listCompetitors, createCompetitor } from "@/lib/competitors/service";
import { type PlatformMetric } from "@/lib/competitors/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listCompetitors());
  } catch (err) {
    console.error("GET /api/competitors error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body?.name ?? "").toString().trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const created = await createCompetitor({
      name,
      segment: typeof body.segment === "string" ? body.segment : undefined,
      tvl: body.tvl ?? null,
      token: body.token ?? null,
      website: body.website ?? null,
      remark: typeof body.remark === "string" ? body.remark : undefined,
      communityStrength:
        typeof body.communityStrength === "number" ? body.communityStrength : undefined,
      platforms: body.platforms as PlatformMetric[] | undefined,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/competitors error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

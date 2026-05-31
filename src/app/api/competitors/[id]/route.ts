import { NextRequest, NextResponse } from "next/server";
import {
  getCompetitor,
  patchCompetitor,
  removeCompetitor,
} from "@/lib/competitors/service";
import { type CompetitorUpdate } from "@/lib/competitors/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const competitor = await getCompetitor(id);
    if (!competitor) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(competitor);
  } catch (err) {
    console.error("GET /api/competitors/[id] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const update: CompetitorUpdate = {};
    if (typeof body.name === "string") update.name = body.name;
    if (typeof body.segment === "string") update.segment = body.segment;
    if ("tvl" in body) update.tvl = (body.tvl as string | null) ?? null;
    if ("token" in body) update.token = (body.token as string | null) ?? null;
    if ("website" in body) update.website = (body.website as string | null) ?? null;
    if (typeof body.remark === "string") update.remark = body.remark;
    if (typeof body.communityStrength === "number")
      update.communityStrength = body.communityStrength;
    if (Array.isArray(body.platforms))
      update.platforms = body.platforms as CompetitorUpdate["platforms"];

    const updated = await patchCompetitor(id, update);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/competitors/[id] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ok = await removeCompetitor(id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/competitors/[id] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

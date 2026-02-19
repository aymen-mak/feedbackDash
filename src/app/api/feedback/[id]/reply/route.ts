import { NextRequest, NextResponse } from "next/server";
import { addReply } from "@/lib/store";
import { hasPostgres, pgAddReply } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const message = body.message as string;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const updated = hasPostgres()
      ? await pgAddReply(id, message.trim())
      : addReply(id, message.trim());

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/feedback/[id]/reply error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { updateReply, deleteReply, sanitizeInput } from "@/lib/store";
import { hasPostgres, pgUpdateReply, pgDeleteReply } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; replyId: string }> }
) {
  try {
    const { id, replyId } = await params;
    const body = await req.json();
    const message = sanitizeInput((body.message as string) || "").slice(0, 5000);

    if (!message.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const updated = hasPostgres()
      ? await pgUpdateReply(id, replyId, message.trim())
      : updateReply(id, replyId, message.trim());

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/feedback/[id]/reply/[replyId] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; replyId: string }> }
) {
  try {
    const { id, replyId } = await params;

    const updated = hasPostgres()
      ? await pgDeleteReply(id, replyId)
      : deleteReply(id, replyId);

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("DELETE /api/feedback/[id]/reply/[replyId] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

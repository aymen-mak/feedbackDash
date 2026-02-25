import { NextRequest, NextResponse } from "next/server";
import { updateFeedback, getFeedbackById, permanentlyDeleteFeedback } from "@/lib/store";
import { hasPostgres, pgUpdateFeedback, pgGetFeedbackById, pgPermanentlyDeleteFeedback } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const allowed = ["status", "priority", "starred", "escalated", "dismissed", "archived", "archivedBy", "deletedAt", "tags", "acknowledged"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (hasPostgres()) {
      const existing = await pgGetFeedbackById(id);
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const updated = await pgUpdateFeedback(id, updates);
      return NextResponse.json(updated);
    }

    const existing = getFeedbackById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = updateFeedback(id, updates);
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/feedback/[id] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (hasPostgres()) {
      const deleted = await pgPermanentlyDeleteFeedback(id);
      if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    const deleted = permanentlyDeleteFeedback(id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/feedback/[id] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

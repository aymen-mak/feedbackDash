import { NextRequest, NextResponse } from "next/server";
import { updateFeedback, getFeedbackById } from "@/lib/store";
import { hasPostgres, pgUpdateFeedback, pgGetFeedbackById } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const allowed = ["status", "priority", "starred", "escalated", "dismissed", "archived", "deletedAt", "tags", "acknowledged"];
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

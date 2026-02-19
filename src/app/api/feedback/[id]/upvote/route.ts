import { NextRequest, NextResponse } from "next/server";
import { toggleUpvote } from "@/lib/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const sessionId = body.sessionId as string;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const updated = toggleUpvote(id, sessionId);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ upvotes: updated.upvotes, upvotedBy: updated.upvotedBy });
}

import { NextRequest, NextResponse } from "next/server";
import { getAllFeedback, createFeedback, type CategoryId, type FeedbackType } from "@/lib/store";

export async function GET() {
  try {
    const feedback = getAllFeedback();
    return NextResponse.json(feedback);
  } catch (err) {
    console.error("GET /api/feedback error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { category, type, message, quickAction, anonymous, userName } = body as {
      category: CategoryId;
      type: FeedbackType;
      message: string;
      quickAction: string | null;
      anonymous: boolean;
      userName?: string;
    };

    if (!category || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!message?.trim() && !quickAction) {
      return NextResponse.json({ error: "Message or quick action required" }, { status: 400 });
    }

    const displayName = anonymous ? "Anonymous" : (userName?.trim() || "Anonymous");
    const avatar = anonymous ? "?" : (displayName.charAt(0).toUpperCase());

    const item = createFeedback({
      userName: displayName,
      userAvatar: avatar,
      category,
      type: quickAction && !message?.trim() ? "praise" : type,
      message: message || "",
      quickAction,
      anonymous,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("POST /api/feedback error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

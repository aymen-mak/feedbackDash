import { NextRequest, NextResponse } from "next/server";
import { getAllFeedback, getArchivedFeedback, getTrashFeedback, cleanupTrash, createFeedback, type CategoryId, type FeedbackType } from "@/lib/store";
import { hasPostgres, pgGetAllFeedback, pgGetArchivedFeedback, pgGetTrashFeedback, pgCleanupTrash, pgCreateFeedback, pgSeedIfEmpty } from "@/lib/db";
import { seed } from "@/lib/store";

export async function GET(req: NextRequest) {
  try {
    const view = req.nextUrl.searchParams.get("view");

    if (hasPostgres()) {
      await pgSeedIfEmpty(seed());
      await pgCleanupTrash();
      if (view === "archived") return NextResponse.json(await pgGetArchivedFeedback());
      if (view === "trash") return NextResponse.json(await pgGetTrashFeedback());
      return NextResponse.json(await pgGetAllFeedback());
    }

    cleanupTrash();
    if (view === "archived") return NextResponse.json(getArchivedFeedback());
    if (view === "trash") return NextResponse.json(getTrashFeedback());
    return NextResponse.json(getAllFeedback());
  } catch (err) {
    console.error("GET /api/feedback error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { category, type, message, quickAction, anonymous, userName, screenshotUrl, rating } = body as {
      category: CategoryId;
      type: FeedbackType;
      message: string;
      quickAction: string | null;
      anonymous: boolean;
      userName?: string;
      screenshotUrl?: string | null;
      rating?: number | null;
    };

    if (!category || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!message?.trim() && !quickAction) {
      return NextResponse.json({ error: "Message or quick action required" }, { status: 400 });
    }

    const displayName = anonymous ? "Anonymous" : (userName?.trim() || "Anonymous");
    const avatar = anonymous ? "?" : (displayName.charAt(0).toUpperCase());

    const data = {
      userName: displayName,
      userAvatar: avatar,
      category,
      type,
      message: message || "",
      quickAction,
      anonymous,
      screenshotUrl: screenshotUrl ?? null,
      rating: rating ?? null,
    };

    if (hasPostgres()) {
      const item = await pgCreateFeedback(data);
      return NextResponse.json(item, { status: 201 });
    }

    const item = createFeedback(data);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("POST /api/feedback error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

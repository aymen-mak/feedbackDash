import { NextRequest, NextResponse } from "next/server";
import { getAllFeedback, getArchivedFeedback, getTrashFeedback, getFeedbackByIds, cleanupTrash, createFeedback, sanitizeInput, type CategoryId, type FeedbackType } from "@/lib/store";
import { hasPostgres, pgGetAllFeedback, pgGetArchivedFeedback, pgGetTrashFeedback, pgGetFeedbackByIds, pgCleanupTrash, pgCreateFeedback, pgSeedIfEmpty } from "@/lib/db";
import { seed } from "@/lib/store";

export async function GET(req: NextRequest) {
  try {
    const view = req.nextUrl.searchParams.get("view");
    const idsParam = req.nextUrl.searchParams.get("ids");

    if (hasPostgres()) {
      await pgSeedIfEmpty(seed());
      await pgCleanupTrash();
      if (idsParam) {
        const ids = idsParam.split(",").filter(Boolean);
        return NextResponse.json(await pgGetFeedbackByIds(ids));
      }
      if (view === "archived") return NextResponse.json(await pgGetArchivedFeedback());
      if (view === "trash") return NextResponse.json(await pgGetTrashFeedback());
      return NextResponse.json(await pgGetAllFeedback());
    }

    cleanupTrash();
    if (idsParam) {
      const ids = idsParam.split(",").filter(Boolean);
      return NextResponse.json(getFeedbackByIds(ids));
    }
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

    const validCategories = ["Product", "UI/UX", "App", "Operator CLI"];
    const validTypes = ["issue", "suggestion", "question"];
    if (!category || !validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const sanitizedMessage = sanitizeInput(message || "").slice(0, 5000);
    if (!sanitizedMessage.trim() && !quickAction) {
      return NextResponse.json({ error: "Message or quick action required" }, { status: 400 });
    }

    const rawName = anonymous ? "Anonymous" : (userName?.trim() || "Anonymous");
    const displayName = sanitizeInput(rawName).slice(0, 50);
    const avatar = anonymous ? "?" : (displayName.charAt(0).toUpperCase());

    const data = {
      userName: displayName,
      userAvatar: avatar,
      category: category as CategoryId,
      type,
      message: sanitizedMessage,
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

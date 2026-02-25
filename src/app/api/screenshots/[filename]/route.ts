import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolveScreenshotDir } from "@/lib/store";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize — only allow alphanumeric, dots, hyphens, underscores
  if (!/^[\w.-]+$/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = `${resolveScreenshotDir()}/${filename}`;

  try {
    const data = await readFile(filePath);
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const contentType = MIME[ext] || "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

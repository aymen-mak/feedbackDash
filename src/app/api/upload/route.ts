import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

const MAX_SIZE = 1.5 * 1024 * 1024; // 1.5 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type — JPG only
    const isJpeg = file.type === "image/jpeg" || file.type === "image/jpg" || file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg");
    if (!isJpeg) {
      return NextResponse.json({ error: "Only JPG files are allowed" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 1.5 MB)" }, { status: 400 });
    }

    const filename = `screenshots/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const blob = await put(filename, file, { access: "public" });

    return NextResponse.json({ url: blob.url }, { status: 201 });
  } catch (err) {
    console.error("POST /api/upload error:", err);
    return NextResponse.json({ error: "Upload failed. Make sure BLOB_READ_WRITE_TOKEN is configured." }, { status: 500 });
  }
}

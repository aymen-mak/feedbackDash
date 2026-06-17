import { NextRequest, NextResponse } from "next/server";

// TEMPORARY diagnostic — run scweet with its REAL input schema (profile_urls +
// required max_items) and dump a full tweet so we can map output field names.
// Remove once X collection works.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_TOKEN not set on this deployment/env" }, { status: 500 });

  const h = (req.nextUrl.searchParams.get("handle") || "makinafi").replace(/^@/, "").trim();
  const input = {
    source_mode: "auto",
    profile_urls: [`@${h}`],
    max_items: 100,
    search_sort: "Latest",
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 58000);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/altimis~scweet/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&memory=1024`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: ctrl.signal,
        cache: "no-store",
      }
    );
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text; }
    const items = Array.isArray(json) ? (json as Array<Record<string, unknown>>) : [];
    const real = items.filter((it) => !it.noResults && !it.demo);
    const first = real[0];
    const author = first && typeof first.author === "object" ? (first.author as Record<string, unknown>) : null;
    return NextResponse.json({
      input,
      httpStatus: res.status,
      itemCount: items.length,
      realCount: real.length,
      firstItemKeys: first ? Object.keys(first) : null,
      authorKeys: author ? Object.keys(author) : null,
      sampleFirst: first ?? items[0] ?? null, // full object → read field names
      nonArrayResponse: Array.isArray(json) ? undefined : json,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    clearTimeout(timer);
  }
}

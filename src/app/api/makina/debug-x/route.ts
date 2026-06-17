import { NextRequest, NextResponse } from "next/server";

// TEMPORARY diagnostic — calls Apify directly and dumps the raw response shape
// so we can see item count + exact field names. Remove once X collection works.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_TOKEN not set on this deployment" }, { status: 500 });

  const sp = req.nextUrl.searchParams;
  const handle = (sp.get("handle") || "makinafi").replace(/^@/, "").trim();
  const mode = sp.get("mode") || "handles"; // "handles" | "search"
  const actor = process.env.APIFY_TWEET_ACTOR || "apidojo~tweet-scraper";
  const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const until = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

  const input =
    mode === "search"
      ? { searchTerms: [`from:${handle} since:${since} until:${until}`], sort: "Latest", maxItems: 10 }
      : { twitterHandles: [handle], sort: "Latest", maxItems: 10, start: since, end: until };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 58000);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
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
    const first = items[0];
    const author = first && typeof first.author === "object" ? (first.author as Record<string, unknown>) : null;
    return NextResponse.json({
      httpStatus: res.status,
      actor,
      mode,
      input,
      itemCount: items.length,
      firstItemKeys: first ? Object.keys(first) : null,
      authorKeys: author ? Object.keys(author) : null,
      sample: items.slice(0, 2),
      nonArrayResponse: Array.isArray(json) ? undefined : json, // surfaces Apify error objects
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    clearTimeout(timer);
  }
}

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Debug-only: run a single scweet scrape and return its RAW shape so we can map
// field names when metrics stop reading (the scraper occasionally renames them).
// Returns public tweet data only. Visit /api/makina/debug?handle=makinafi.
export async function GET(req: Request) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_TOKEN not set on this deployment" }, { status: 200 });

  const sp = new URL(req.url).searchParams;
  const handle = (sp.get("handle") || "makinafi").replace(/^@/, "");
  const mode = sp.get("mode") || "profiles"; // "profiles" | "search"
  const q = sp.get("q");
  const actor = process.env.APIFY_TWEET_ACTOR || "altimis~scweet";
  const input =
    mode === "search"
      ? { source_mode: "search", search_query: q || `from:${handle}`, max_items: 100, search_sort: "Latest" }
      : { source_mode: "profiles", profile_urls: [`@${handle}`], max_items: 100 };

  try {
    const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&memory=1024`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const items = Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
    const first = items[0] ?? null;
    const keysOf = (o: unknown) => (o && typeof o === "object" ? Object.keys(o as object) : []);

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      count: items.length,
      handle,
      mode,
      // Where the fields live, so the collector mapping can be matched exactly.
      firstItemKeys: keysOf(first),
      nestedKeys: first
        ? {
            user: keysOf((first as Record<string, unknown>).user),
            tweet: keysOf((first as Record<string, unknown>).tweet),
            legacy: keysOf((first as Record<string, unknown>).legacy),
            views: keysOf((first as Record<string, unknown>).views),
          }
        : null,
      // One full raw item so exact field names + nesting are visible.
      sample: items.slice(0, 1),
      // If Apify returned an error (not an array), show it (truncated).
      rawIfNotArray: Array.isArray(parsed) ? undefined : text.slice(0, 1500),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
}

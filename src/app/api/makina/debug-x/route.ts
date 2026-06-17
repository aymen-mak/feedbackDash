import { NextRequest, NextResponse } from "next/server";

// TEMPORARY diagnostic — apidojo's SEARCH path returns noResults in guest mode,
// so test PROFILE-timeline scraping across actors/inputs and report which one
// actually returns tweets (+ field names). Remove once X collection works.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function runVariant(
  token: string,
  actor: string,
  label: string,
  input: Record<string, unknown>
) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&memory=1024`,
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
    const real = items.filter((it) => !it.noResults);
    const first = real[0];
    const author = first && typeof first.author === "object" ? (first.author as Record<string, unknown>) : null;
    return {
      actor,
      label,
      input,
      httpStatus: res.status,
      itemCount: items.length,
      realCount: real.length,
      firstItemKeys: first ? Object.keys(first) : null,
      authorKeys: author ? Object.keys(author) : null,
      sampleFirst: first ?? null,
      nonArrayResponse: Array.isArray(json) ? undefined : json, // only surfaces error objects
    };
  } catch (e) {
    return { actor, label, input, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_TOKEN not set on this deployment/env" }, { status: 500 });

  const h = (req.nextUrl.searchParams.get("handle") || "makinafi").replace(/^@/, "").trim();
  const profileUrl = `https://x.com/${h}`;

  const variants = await Promise.all([
    runVariant(token, "apidojo~tweet-scraper", "tweet-scraper+startUrls", { startUrls: [profileUrl], maxItems: 5 }),
    runVariant(token, "apidojo~twitter-profile-scraper", "profile-scraper+handles", { twitterHandles: [h], maxItems: 5 }),
    runVariant(token, "apidojo~twitter-profile-scraper", "profile-scraper+startUrls", { startUrls: [profileUrl], maxItems: 5 }),
  ]);

  return NextResponse.json({ handle: h, variants });
}

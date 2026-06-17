import { NextRequest, NextResponse } from "next/server";

// TEMPORARY diagnostic — runs several Apify input shapes in parallel and reports
// which one actually returns tweets (+ the real field names). Remove once X
// collection works.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ACTOR = process.env.APIFY_TWEET_ACTOR || "apidojo~tweet-scraper";

async function runVariant(token: string, label: string, input: Record<string, unknown>) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&memory=1024`,
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
      label,
      input,
      httpStatus: res.status,
      itemCount: items.length,
      realCount: real.length,
      firstItemKeys: first ? Object.keys(first) : null,
      authorKeys: author ? Object.keys(author) : null,
      sampleFirst: first ?? items[0] ?? null,
      nonArrayResponse: Array.isArray(json) ? json : undefined,
    };
  } catch (e) {
    return { label, input, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return NextResponse.json({ error: "APIFY_TOKEN not set on this deployment/env" }, { status: 500 });

  const h = (req.nextUrl.searchParams.get("handle") || "makinafi").replace(/^@/, "").trim();
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10); // widen to 30d
  const until = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

  const variants = await Promise.all([
    runVariant(token, "search-nodate", { searchTerms: [`from:${h}`], sort: "Latest", maxItems: 5 }),
    runVariant(token, "handles-nodate", { twitterHandles: [h], sort: "Latest", maxItems: 5 }),
    runVariant(token, "search-dated-30d", { searchTerms: [`from:${h} since:${since} until:${until}`], sort: "Latest", maxItems: 5 }),
  ]);

  return NextResponse.json({ handle: h, actor: ACTOR, variants });
}

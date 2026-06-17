import { NextRequest, NextResponse } from "next/server";

// TEMPORARY diagnostic — apidojo demo-gates on the free plan, so test
// altimis/scweet (real free tier: 1000 tweets/day, no card). Dumps the full
// first item so we can map field names. Remove once X collection works.
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
    const real = items.filter((it) => !it.noResults && !it.demo);
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
      sampleFirst: first ?? items[0] ?? null, // full object so we can read field names
      nonArrayResponse: Array.isArray(json) ? undefined : json,
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
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const until = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

  const variants = await Promise.all([
    runVariant(token, "altimis~scweet", "scweet", { handle: h, since, until, max_tweets: 10 }),
    runVariant(token, "apidojo~twitter-scraper-lite", "scraper-lite", { twitterHandles: [h], maxItems: 5 }),
  ]);

  return NextResponse.json({ handle: h, variants });
}

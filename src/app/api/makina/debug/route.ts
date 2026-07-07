import { NextResponse } from "next/server";
import { collectXFree, fetchSyndicationTimeline, fetchNitterRss, enrichTweet } from "@/lib/makina/freex";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Debug the FREE X pipeline layer by layer — costs nothing, safe to hit any
// time: /api/makina/debug?handle=makinafi
//
// The paid Apify path can still be traced with &paid=1, but ONLY when
// APIFY_ALLOW_SPEND=true (every actor run charges real money).
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const handle = (sp.get("handle") || "makinafi").replace(/^@/, "").toLowerCase();

  if (sp.get("paid") === "1") {
    if (process.env.APIFY_ALLOW_SPEND !== "true") {
      return NextResponse.json(
        { skipped: "Apify spending is frozen (APIFY_ALLOW_SPEND is not true); no paid run was started. The free pipeline trace runs without this flag." },
        { status: 200 }
      );
    }
    const token = process.env.APIFY_TOKEN;
    if (!token) return NextResponse.json({ error: "APIFY_TOKEN not set on this deployment" }, { status: 200 });
    const actor = process.env.APIFY_TWEET_ACTOR || "altimis~scweet";
    const input = { source_mode: "profiles", profile_urls: [`@${handle}`], max_items: 100 };
    try {
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/${actor}/runs?token=${encodeURIComponent(token)}&waitForFinish=55`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input), cache: "no-store" }
      );
      const body = await runRes.text();
      return NextResponse.json({ mode: "paid", actor, input, httpStatus: runRes.status, body: body.slice(0, 2000) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 200 });
    }
  }

  // ── Free pipeline trace ──
  try {
    const [synd, rss] = await Promise.all([fetchSyndicationTimeline(handle), fetchNitterRss(handle)]);
    const firstId = synd?.[0]?.id ?? rss?.tweets?.[0]?.id ?? null;
    const enrichment = firstId ? await enrichTweet(firstId) : null;
    const collect = await collectXFree(handle);

    return NextResponse.json({
      mode: "free",
      handle,
      layers: {
        syndication: synd ? { ok: true, tweets: synd.length, sample: synd[0] } : { ok: false },
        nitterRss: rss ? { ok: true, instance: rss.instance, tweets: rss.tweets.length, sample: rss.tweets[0] } : { ok: false },
        enrichment: enrichment
          ? { ok: true, tweetId: firstId, via: enrichment.via, data: enrichment.data }
          : { ok: false, tweetId: firstId },
      },
      collect: {
        values: collect.values,
        error: collect.error,
        evidence: collect.evidence,
        tweetsSample: (collect.tweets ?? []).slice(0, 2),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
}

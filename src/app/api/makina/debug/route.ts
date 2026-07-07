import { NextResponse } from "next/server";
import {
  collectXFree,
  fetchFxTimeline,
  fetchSyndicationTimeline,
  fetchNitterRss,
  searchDiscoverIds,
  enrichTweet,
} from "@/lib/makina/freex";

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

  // ── Free pipeline trace: every layer, with HTTP statuses ──
  try {
    const [fx, synd, rss, search] = await Promise.all([
      fetchFxTimeline(handle),
      fetchSyndicationTimeline(handle),
      fetchNitterRss(handle),
      searchDiscoverIds(handle),
    ]);
    const firstId = fx.tweets?.[0]?.id ?? synd.tweets?.[0]?.id ?? rss.tweets?.[0]?.id ?? search.ids[0] ?? null;
    const enrichment = firstId ? await enrichTweet(firstId) : null;
    const collect = await collectXFree(handle);

    return NextResponse.json({
      mode: "free",
      handle,
      layers: {
        fxTimeline: { ok: !!fx.tweets, httpStatus: fx.status, tweets: fx.tweets?.length ?? 0, sample: fx.tweets?.[0] ?? null },
        syndication: { ok: !!synd.tweets, httpStatus: synd.status, tweets: synd.tweets?.length ?? 0 },
        nitterRss: { ok: !!rss.tweets, tried: rss.tried, tweets: rss.tweets?.length ?? 0 },
        searchEngines: { ok: search.ids.length > 0, via: search.via, ids: search.ids.slice(0, 5) },
        enrichment: enrichment
          ? { ok: true, tweetId: firstId, via: enrichment.via, author: enrichment.author, data: enrichment.data }
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

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Debug-only: run scweet once and report the RUN object (status + statusMessage
// + stats), not just the dataset. An empty dataset with a successful run vs. a
// failed/rental-blocked run look identical downstream; this tells them apart.
// Visit /api/makina/debug?handle=makinafi   (or &mode=search&q=from:makinafi)
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

  const t = encodeURIComponent(token);
  try {
    // Start the run and wait (≤55s) for it to finish so we get its real status.
    const runRes = await fetch(`https://api.apify.com/v2/acts/${actor}/runs?token=${t}&waitForFinish=55`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    const runText = await runRes.text();
    let run: Record<string, unknown> | null = null;
    try {
      run = (JSON.parse(runText) as { data?: Record<string, unknown> }).data ?? null;
    } catch {
      /* non-JSON */
    }
    if (!run) {
      return NextResponse.json({ stage: "start-run", httpStatus: runRes.status, actor, input, body: runText.slice(0, 1500) });
    }

    const dsId = run.defaultDatasetId as string | undefined;
    let datasetItemCount: number | null = null;
    let items: Array<Record<string, unknown>> = [];
    if (dsId) {
      const meta = await fetch(`https://api.apify.com/v2/datasets/${dsId}?token=${t}`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null);
      datasetItemCount = (meta?.data?.itemCount as number) ?? null;
      const got = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${t}&clean=true&limit=2`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null);
      if (Array.isArray(got)) items = got;
    }
    const first = items[0] ?? null;
    const keysOf = (o: unknown) => (o && typeof o === "object" ? Object.keys(o as object) : []);

    return NextResponse.json({
      actor,
      mode,
      input,
      httpStatus: runRes.status,
      runStatus: run.status, // SUCCEEDED / FAILED / ABORTED / TIMED-OUT
      statusMessage: run.statusMessage ?? null, // the human reason
      exitCode: run.exitCode ?? null,
      stats: run.stats ?? null,
      datasetItemCount,
      firstItemKeys: keysOf(first),
      nestedKeys: first
        ? { user: keysOf(first.user), tweet: keysOf(first.tweet), legacy: keysOf(first.legacy) }
        : null,
      sample: items.slice(0, 1),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
}

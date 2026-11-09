import { type TrafficWeek, type Insight, pagesPerVisitor } from "./types";

// Deterministic, data-cited insights. Each line only fires when the week's own
// numbers support it, and quotes them. Used as the fallback when AI research
// isn't configured, and to seed the first week. Copy is kept plain on purpose.

const pct = (cur: number, prev: number | null | undefined): number | null =>
  prev != null && prev > 0 ? +(((cur - prev) / prev) * 100).toFixed(1) : null;
const k = (n: number): string => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));
const signed = (n: number): string => (n > 0 ? "+" : "") + n;

export function deriveInsights(week: TrafficWeek): Insight[] {
  const w = week;
  const out: Insight[] = [];

  // ── Volume & depth ──
  const vWow = pct(w.visitors, w.visitorsPrev);
  const pWow = pct(w.pageviews, w.pageviewsPrev);
  const depth = pagesPerVisitor(w.pageviews, w.visitors);
  const depthPrev = w.visitorsPrev && w.pageviewsPrev ? pagesPerVisitor(w.pageviewsPrev, w.visitorsPrev) : null;
  if (vWow != null) {
    out.push({
      lens: "Volume",
      tone: vWow > 2 ? "good" : vWow < -2 ? "bad" : "info",
      title: `Visitors ${vWow >= 0 ? "up" : "down"} ${Math.abs(vWow)}% on last week`,
      detail: `${k(w.visitors)} visitors against ${k(w.visitorsPrev!)} the week before. Pageviews ${pWow != null ? signed(pWow) + "%" : "n/a"}.`,
    });
  }
  if (depthPrev != null) {
    const dd = +(depth - depthPrev).toFixed(2);
    out.push({
      lens: "Volume",
      tone: Math.abs(dd) < 0.1 ? "info" : dd > 0 ? "good" : "watch",
      title: `Depth ${Math.abs(dd) < 0.1 ? "held" : dd > 0 ? "rose" : "fell"} at ${depth} pages/visitor`,
      detail: `Was ${depthPrev}. ${dd < -0.1 ? "More visitors came, but they read fewer pages each." : "Visitors read about as many pages as before, or a little more."}`,
    });
  }

  // ── Acquisition ──
  const rising = w.sources
    .filter((s) => !/direct/i.test(s.name))
    .map((s) => ({ s, g: pct(s.visitors, s.priorVisitors) }))
    .filter((x) => x.g != null && x.s.visitors >= 10)
    .sort((a, b) => b.g! - a.g!);
  if (rising.length && rising[0].g! > 10) {
    const r = rising[0];
    out.push({
      lens: "Acquisition",
      tone: "good",
      title: `${r.s.name} grew fastest among referrers (+${r.g}%)`,
      detail: `${r.s.visitors} visitors, up from ${r.s.priorVisitors}. Worth finding what sent them.`,
    });
  }
  const direct = w.sources.find((s) => /direct/i.test(s.name));
  if (direct && w.visitors > 0) {
    const share = Math.round((direct.visitors / w.visitors) * 100);
    out.push({
      lens: "Acquisition",
      tone: "info",
      title: `Direct is ${share}% of visitors and reads the deepest`,
      detail: `${k(direct.visitors)} visitors at ${pagesPerVisitor(direct.pageviews, direct.visitors)} pages each. These people already know Makina rather than finding it through search.`,
    });
  }
  const google = w.sources.find((s) => /google/i.test(s.name));
  if (google) {
    out.push({
      lens: "Acquisition",
      tone: "watch",
      title: `Search is a small share, with room to grow`,
      detail: `${google.visitors} visitors from Google. Most searches now end without a click, so the landing pages should answer the common questions plainly and be easy for AI search to quote.`,
    });
  }

  // ── Audience (geo depth) ──
  const geo = w.countries.filter((c) => !/other/i.test(c.name) && c.visitors >= 20).map((c) => ({ c, d: pagesPerVisitor(c.pageviews, c.visitors) }));
  const deepest = [...geo].sort((a, b) => b.d - a.d)[0];
  if (deepest) {
    out.push({
      lens: "Audience",
      tone: "good",
      title: `${deepest.c.name} reads the most pages per visit (${deepest.d})`,
      detail: `${deepest.c.visitors} visitors going several pages deep. This is where the real interest sits, so it is worth the attention.`,
    });
    const shallow = geo.filter((x) => x.c.visitors >= 60 && x.c.name !== deepest.c.name).sort((a, b) => a.d - b.d)[0];
    if (shallow && shallow.d < deepest.d * 0.6) {
      out.push({
        lens: "Audience",
        tone: "watch",
        title: `${shallow.c.name} brings volume but shallow visits (${shallow.d} pages each)`,
        detail: `${shallow.c.visitors} visitors who mostly leave after one page. Worth checking which source sends them and whether the page is what they expected.`,
      });
    }
  }

  // ── Content (routes) ──
  const routes = w.routes.filter((r) => r.name !== "/");
  const breakout = routes.map((r) => ({ r, abs: r.visitors - (r.priorVisitors ?? 0) })).sort((a, b) => b.abs - a.abs)[0];
  if (breakout && breakout.abs > 10) {
    out.push({
      lens: "Content",
      tone: "good",
      title: `${breakout.r.name} jumped (+${breakout.abs} visitors)`,
      detail: `Up from ${breakout.r.priorVisitors ?? 0} to ${breakout.r.visitors}. Find what sent the traffic and do the same for similar pages.`,
    });
  }
  const stalled = routes.find((r) => r.priorVisitors != null && Math.abs(r.visitors - r.priorVisitors) <= 3 && r.visitors >= 50);
  if (stalled) {
    out.push({
      lens: "Content",
      tone: "watch",
      title: `${stalled.name} is flat (${stalled.priorVisitors} to ${stalled.visitors})`,
      detail: `Steady, but not growing. A rewrite or a fresh angle might move it.`,
    });
  }

  // ── Devices ──
  const mobile = w.devices.find((d) => /mobile/i.test(d.name));
  const desktop = w.devices.find((d) => /desktop/i.test(d.name));
  if (mobile && desktop && w.visitors > 0) {
    const mShare = Math.round((mobile.visitors / w.visitors) * 100);
    const mDepth = pagesPerVisitor(mobile.pageviews, mobile.visitors);
    const dDepth = pagesPerVisitor(desktop.pageviews, desktop.visitors);
    if (mDepth < dDepth * 0.8) {
      out.push({
        lens: "Devices",
        tone: "watch",
        title: `Mobile is ${mShare}% of visitors but leaves sooner (${mDepth} vs ${dDepth} pages on desktop)`,
        detail: `Mobile visitors drop off faster than desktop. Worth checking how the site reads on a phone.`,
      });
    }
  }

  // ── Cadence ──
  if (w.daily && w.daily.length >= 6) {
    const sorted = [...w.daily].sort((a, b) => b.visitors - a.visitors);
    out.push({
      lens: "Cadence",
      tone: "info",
      title: `${sorted[0].day.split(" ").slice(0, 2).join(" ")} was the busiest day`,
      detail: `${sorted[0].visitors} visitors. Posting around the mid-week peak tends to reach the most people.`,
    });
  }

  return out;
}

/** Current, cross-industry best-practice suggestions tailored to the week's
 *  data. The heuristic fallback for when AI research isn't configured. */
export function deriveSuggestions(week: TrafficWeek): string[] {
  const w = week;
  const out: string[] = [];
  const src = (re: RegExp) => w.sources.find((s) => re.test(s.name));
  const t = src(/t\.co|twitter|x\.com/i);

  if (t && (t.priorVisitors == null || t.visitors >= (t.priorVisitors ?? 0))) {
    out.push(`Keep pushing on X. t.co sent ${t.visitors} visitors this week. Posting the weekly report as a thread is still one of the better ways to reach crypto readers.`);
  }
  out.push(`Write the top pages so AI search can quote them. Most Google searches now end without a click, and tools like ChatGPT and Perplexity send traffic only when they can lift a clear answer. Put plain answers to the obvious questions ("what is Makina", "how the vaults work") near the top of the key pages.`);
  const geo = w.countries.filter((c) => !/other/i.test(c.name) && c.visitors >= 20).map((c) => ({ c, d: pagesPerVisitor(c.pageviews, c.visitors) }));
  const shallow = geo.filter((x) => x.c.visitors >= 60).sort((a, b) => a.d - b.d)[0];
  const deep = [...geo].sort((a, b) => b.d - a.d)[0];
  if (shallow && deep && shallow.d < deep.d * 0.6) {
    out.push(`Look into why ${shallow.c.name} traffic is shallow (${shallow.c.visitors} visitors at ${shallow.d} pages each, against ${deep.c.name} at ${deep.d}). Find the source and check the page they land on.`);
  }
  out.push(`Start posting on Farcaster and get active on Kaito. Farcaster has become the main social app for crypto, and what counts is the same people showing up across X, Farcaster and Discord, more than the raw visit count.`);
  const points = w.routes.find((r) => /points/i.test(r.name));
  if (points && points.priorVisitors != null && Math.abs(points.visitors - points.priorVisitors) <= 5) {
    out.push(`Give /points a refresh. It is flat at ${points.priorVisitors} to ${points.visitors}, and points traffic tends not to stick. Tying points to real deposits and usage holds people better than reward farming.`);
  }
  out.push(`Read how the clearest explainer pages elsewhere are written, in DeFi but also AI and infra, and borrow what works. The best references are often outside the direct competitor set.`);
  return out;
}

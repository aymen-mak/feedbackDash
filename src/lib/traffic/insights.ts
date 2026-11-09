import { type TrafficWeek, type Insight, pagesPerVisitor } from "./types";

// Deterministic, data-cited insights. Never generic: each line only fires when
// the week's own numbers support it, and quotes them. Used as the fallback when
// AI research isn't configured, and to seed the first week.

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
      title: `Visitors ${vWow >= 0 ? "up" : "down"} ${Math.abs(vWow)}% week over week`,
      detail: `${k(w.visitors)} visitors vs ${k(w.visitorsPrev!)} prior; pageviews ${pWow != null ? signed(pWow) + "%" : "—"}.`,
    });
  }
  if (depthPrev != null) {
    const dd = +(depth - depthPrev).toFixed(2);
    out.push({
      lens: "Volume",
      tone: Math.abs(dd) < 0.1 ? "info" : dd > 0 ? "good" : "watch",
      title: `Depth ${Math.abs(dd) < 0.1 ? "flat" : dd > 0 ? "up" : "down"} at ${depth} pages/visitor`,
      detail: `Was ${depthPrev}. ${dd < -0.1 ? "More visitors but shallower sessions — volume without engagement." : "Engagement held or deepened alongside volume."}`,
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
      title: `${r.s.name} is the fastest-rising channel (+${r.g}%)`,
      detail: `${r.s.visitors} visitors, up from ${r.s.priorVisitors}. Find what drove it and repeat it.`,
    });
  }
  const direct = w.sources.find((s) => /direct/i.test(s.name));
  if (direct && w.visitors > 0) {
    const share = Math.round((direct.visitors / w.visitors) * 100);
    out.push({
      lens: "Acquisition",
      tone: "info",
      title: `Direct is ${share}% of visitors and the deepest traffic`,
      detail: `${k(direct.visitors)} visitors at ${pagesPerVisitor(direct.pageviews, direct.visitors)} pages/visitor — existing demand, not discovery.`,
    });
  }
  const google = w.sources.find((s) => /google/i.test(s.name));
  if (google) {
    out.push({
      lens: "Acquisition",
      tone: "watch",
      title: `Search is small — answer-engine headroom`,
      detail: `${google.visitors} visitors from Google. With most searches now zero-click, structure key pages answer-first so AI Overviews and ChatGPT cite Makina.`,
    });
  }

  // ── Audience (geo depth) ──
  const geo = w.countries.filter((c) => !/other/i.test(c.name) && c.visitors >= 20).map((c) => ({ c, d: pagesPerVisitor(c.pageviews, c.visitors) }));
  const deepest = [...geo].sort((a, b) => b.d - a.d)[0];
  if (deepest) {
    out.push({
      lens: "Audience",
      tone: "good",
      title: `${deepest.c.name} is the deepest real audience (${deepest.d} pages/visitor)`,
      detail: `${deepest.c.visitors} visitors going deep — weight messaging and events here, not only toward raw-volume countries.`,
    });
    const shallow = geo.filter((x) => x.c.visitors >= 60 && x.c.name !== deepest.c.name).sort((a, b) => a.d - b.d)[0];
    if (shallow && shallow.d < deepest.d * 0.6) {
      out.push({
        lens: "Audience",
        tone: "watch",
        title: `${shallow.c.name} is high-volume but shallow (${shallow.d} pages/visitor)`,
        detail: `${shallow.c.visitors} visitors that mostly bounce — a mixed bucket. Check which source feeds it and whether the landing matches intent.`,
      });
    }
  }

  // ── Content (routes) ──
  const routes = w.routes.filter((r) => r.name !== "/");
  const breakout = routes
    .map((r) => ({ r, abs: r.visitors - (r.priorVisitors ?? 0) }))
    .sort((a, b) => b.abs - a.abs)[0];
  if (breakout && breakout.abs > 10) {
    out.push({
      lens: "Content",
      tone: "good",
      title: `${breakout.r.name} broke out (+${breakout.abs} visitors)`,
      detail: `${breakout.r.priorVisitors ?? 0} → ${breakout.r.visitors}. Identify the driver (digest, post) and apply it to sibling pages.`,
    });
  }
  const stalled = routes.find((r) => r.priorVisitors != null && Math.abs(r.visitors - r.priorVisitors) <= 3 && r.visitors >= 50);
  if (stalled) {
    out.push({
      lens: "Content",
      tone: "watch",
      title: `${stalled.name} is flat (${stalled.priorVisitors} → ${stalled.visitors})`,
      detail: `Steady but not growing. A refresh or a new hook could unstick it.`,
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
        title: `Mobile is ${mShare}% of visitors but shallower (${mDepth} vs ${dDepth} on desktop)`,
        detail: `Mobile sessions drop off faster — audit the mobile landing and nav flow.`,
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
      detail: `${sorted[0].visitors} visitors. Time launches and announcements to the mid-week peak.`,
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
  const g = src(/google/i);

  if (t && (t.priorVisitors == null || t.visitors >= (t.priorVisitors ?? 0))) {
    out.push(`Double down on X distribution — t.co is ${t.visitors} visitors this week. Ship the weekly report as an X thread; threads are still the top acquisition lever in crypto.`);
  }
  out.push(`Stand up answer-engine optimization (AEO): add answer-first intros, FAQ blocks and a comparison table to the top pages ("What is Makina", "vault infra", operator strategies). ~60% of searches are now zero-click — the goal is being cited by AI Overviews, ChatGPT and Perplexity, not just ranking.`);
  const geo = w.countries.filter((c) => !/other/i.test(c.name) && c.visitors >= 20).map((c) => ({ c, d: pagesPerVisitor(c.pageviews, c.visitors) }));
  const shallow = geo.filter((x) => x.c.visitors >= 60).sort((a, b) => a.d - b.d)[0];
  const deep = [...geo].sort((a, b) => b.d - a.d)[0];
  if (shallow && deep && shallow.d < deep.d * 0.6) {
    out.push(`Investigate ${shallow.c.name} shallowness (${shallow.c.visitors} visitors at ${shallow.d} pages/visitor vs ${deep.c.name} at ${deep.d}). Trace the source and match the landing to intent.`);
  }
  out.push(`Add a Farcaster presence and a Kaito (yaps) mindshare push. Farcaster is now crypto's default social layer; cross-channel participation (X + Farcaster + Discord) is the real reach metric, not raw visits.`);
  const points = w.routes.find((r) => /points/i.test(r.name));
  if (points && points.priorVisitors != null && Math.abs(points.visitors - points.priorVisitors) <= 5) {
    out.push(`Refresh /points — flat at ${points.priorVisitors}→${points.visitors}. Points/airdrop traffic retains poorly; tie points to real product actions, not farming.`);
  }
  out.push(`Benchmark the top-of-funnel pages against the best explainer pages across DeFi, AI and infra (not just direct competitors) and copy the patterns that win citations and depth.`);
  return out;
}

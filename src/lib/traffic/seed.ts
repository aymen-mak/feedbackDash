import { type TrafficStore, type TrafficWeek, type ActionItem } from "./types";
import { deriveInsights, deriveSuggestions } from "./insights";

// First uploaded report: makina.finance weekly web traffic, Nov 2–8 2026
// (Vercel Web Analytics). Lets the page render fully before any upload.
export function seedTraffic(): TrafficStore {
  const now = "2026-11-09T00:00:00.000Z";
  const week: TrafficWeek = {
    id: "2026-11-02",
    weekStart: "2026-11-02",
    weekEnd: "2026-11-08",
    label: "Nov 2–8, 2026",
    source: "Vercel Web Analytics",
    visitors: 781,
    pageviews: 2358,
    visitorsPrev: 664,
    pageviewsPrev: 2030,
    daily: [
      { day: "Mon Nov 2", visitors: 123, pageviews: 419 },
      { day: "Tue Nov 3", visitors: 107, pageviews: 344 },
      { day: "Wed Nov 4", visitors: 183, pageviews: 562 },
      { day: "Thu Nov 5", visitors: 140, pageviews: 460 },
      { day: "Fri Nov 6", visitors: 109, pageviews: 328 },
      { day: "Sat Nov 7", visitors: 59, pageviews: 143 },
      { day: "Sun Nov 8", visitors: 60, pageviews: 102 },
    ],
    sources: [
      { name: "(direct/none)", visitors: 611, pageviews: 2050, priorVisitors: 531 },
      { name: "t.co", visitors: 95, pageviews: 108, priorVisitors: 48 },
      { name: "google.com", visitors: 83, pageviews: 91, priorVisitors: 64 },
      { name: "job-boards.eu.greenhouse.io", visitors: 5, pageviews: 5, priorVisitors: 4 },
      { name: "com.slack", visitors: 2, pageviews: 5, priorVisitors: null },
      { name: "search.brave.com", visitors: 2, pageviews: 2, priorVisitors: 2 },
    ],
    countries: [
      { name: "US", visitors: 135, pageviews: 270, priorVisitors: 102 },
      { name: "Others", visitors: 98, pageviews: 273, priorVisitors: 90 },
      { name: "CH", visitors: 75, pageviews: 361, priorVisitors: 61 },
      { name: "DE", visitors: 67, pageviews: 256, priorVisitors: 57 },
      { name: "FR", visitors: 42, pageviews: 167, priorVisitors: 32 },
      { name: "NL", visitors: 29, pageviews: 79, priorVisitors: 11 },
      { name: "IN", visitors: 24, pageviews: 51, priorVisitors: 17 },
      { name: "SG", visitors: 23, pageviews: 74, priorVisitors: 18 },
    ],
    routes: [
      { name: "/", visitors: 535, pageviews: 1043, priorVisitors: 473 },
      { name: "/portfolio", visitors: 150, pageviews: 284, priorVisitors: 111 },
      { name: "/strategy/yspcxc", visitors: 126, pageviews: 182, priorVisitors: 5 },
      { name: "/points", visitors: 90, pageviews: 138, priorVisitors: 87 },
      { name: "/strategy/ygooglc", visitors: 74, pageviews: 94, priorVisitors: 50 },
      { name: "/strategy/dusd", visitors: 73, pageviews: 104, priorVisitors: 63 },
      { name: "/strategy/deth", visitors: 67, pageviews: 85, priorVisitors: 57 },
      { name: "/strategy/usdshfmk", visitors: 62, pageviews: 86, priorVisitors: 45 },
      { name: "/strategy/dcm", visitors: 23, pageviews: 27, priorVisitors: 15 },
      { name: "/strategy/dbit", visitors: 22, pageviews: 26, priorVisitors: 19 },
      { name: "/strategy/intmksrroyusdc", visitors: 8, pageviews: 9, priorVisitors: 14 },
      { name: "/503", visitors: 13, pageviews: 16, priorVisitors: 9 },
    ],
    devices: [
      { name: "desktop", visitors: 564, pageviews: 1889, priorVisitors: 489, priorPageviews: 1595 },
      { name: "mobile", visitors: 159, pageviews: 374, priorVisitors: 119, priorPageviews: 258 },
      { name: "(blank)", visitors: 3, pageviews: 3, priorVisitors: 1, priorPageviews: 1 },
      { name: "tablet", visitors: 0, pageviews: 0, priorVisitors: 3, priorPageviews: 12 },
    ],
    observations:
      "Weekday traffic is the gain: 662 vs 556 weekday visitors. Weekend pageviews fell (245 vs 315) even as weekend visitors held. Wed Nov 4 (183 / 562) replaced last week's Friday peak. Sitewide depth flat at 3.02 vs 3.06. Referral shift is t.co: 48→95 visitors (+97.9%), ahead of google.com 64→83. Direct still holds the deep sessions.",
    research: null,
    createdAt: now,
    updatedAt: now,
  };

  week.research = {
    generatedAt: now,
    model: "heuristic",
    summary:
      "Volume up (+17.6% visitors, +16.2% pageviews) with depth flat at 3.02 pages/visitor. t.co overtook Google as the top referrer; CH/DE/FR are the deepest real audience while the US is high-volume but shallow. Upload a report to refresh this with live cross-industry research.",
    insights: deriveInsights(week),
    suggestions: deriveSuggestions(week),
    sources: [],
  };

  const actionItems: ActionItem[] = week.research.suggestions.map((text, i) => ({
    id: `seed-${i}`,
    text,
    done: false,
    source: "auto" as const,
    weekId: week.id,
    createdAt: now,
  }));

  return { weeks: [week], actionItems };
}

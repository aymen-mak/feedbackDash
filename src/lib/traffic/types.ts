// ── Web traffic tracker (manually uploaded weekly reports) ──
// One TrafficWeek per weekly report (e.g. Vercel Web Analytics). The team
// uploads a week's numbers; the page derives behaviour insights and action
// items from them.

export interface TrafficRow {
  /** Source / country / route / device name. */
  name: string;
  visitors: number;
  pageviews: number;
  /** Visitors in the prior period, when the report includes it. */
  priorVisitors?: number | null;
  /** Pageviews in the prior period (devices table reports this). */
  priorPageviews?: number | null;
}

export interface TrafficDay {
  day: string; // "Mon Nov 2"
  visitors: number;
  pageviews: number;
}

export interface ActionItem {
  id: string;
  text: string;
  done: boolean;
  /** Auto = generated from the upload's research; manual = typed by the team. */
  source: "auto" | "manual";
  /** For auto items: which week's research produced it (so a re-upload can
   *  refresh them without touching manual items). */
  weekId?: string | null;
  createdAt: string;
}

/** The research block the app generates when a report is uploaded: current
 *  cross-industry meta (web2/web3/AI/robotics) applied to this week's numbers. */
export interface WeekResearch {
  generatedAt: string;
  /** "claude-…" when AI-generated, "heuristic" for the built-in fallback. */
  model: string;
  /** 1–2 sentence executive read of the week. */
  summary: string;
  insights: Insight[];
  /** Suggested action items (also mirrored into the editable backlog). */
  suggestions: string[];
  /** Citations the research leaned on. */
  sources: { title: string; url: string }[];
}

export interface TrafficWeek {
  /** Stable id = weekStart (YYYY-MM-DD). */
  id: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  /** Friendly label, e.g. "Nov 2–8, 2026". */
  label: string;
  /** Where the numbers came from, e.g. "Vercel Web Analytics". */
  source: string | null;
  /** Totals. */
  visitors: number;
  pageviews: number;
  /** Prior-week totals for week-over-week, when known. */
  visitorsPrev: number | null;
  pageviewsPrev: number | null;
  daily: TrafficDay[];
  sources: TrafficRow[];
  countries: TrafficRow[];
  routes: TrafficRow[];
  devices: TrafficRow[];
  /** The analyst's narrative from the report (optional). */
  observations: string | null;
  /** AI/heuristic research generated when this report was ingested. */
  research?: WeekResearch | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrafficStore {
  weeks: TrafficWeek[];
  /** Team-maintained running backlog (manual items persist across weeks). */
  actionItems: ActionItem[];
}

export interface Insight {
  /** Short glanceable claim. */
  title: string;
  /** One-line supporting detail with the numbers. */
  detail: string;
  /** Visual tone. */
  tone: "good" | "watch" | "bad" | "info";
  /** Which lens this came from. */
  lens: "Volume" | "Acquisition" | "Audience" | "Content" | "Devices" | "Cadence";
}

export const pagesPerVisitor = (pv: number, v: number): number =>
  v > 0 ? +(pv / v).toFixed(2) : 0;

import { type Snapshot, type Competitor, type Platform } from "@/lib/competitors/types";

// ── Time-series bucketing for the Metrics page ──
// Snapshots are recorded only when a value changes, so the raw series is
// irregular. To present clean periodic numbers we resample with
// last-observation-carried-forward: the value "as of" the end of each period is
// the most recent snapshot at or before that instant. Deltas are then just the
// difference between consecutive period-end values.

export type Granularity = "hourly" | "daily" | "weekly" | "biweekly" | "monthly";

/** Selectable granularities with the size of the trailing window each shows. */
export const GRANULARITIES: { key: Granularity; label: string; periods: number }[] = [
  { key: "hourly", label: "Hourly", periods: 24 },
  { key: "daily", label: "Daily", periods: 30 },
  { key: "weekly", label: "Weekly", periods: 16 },
  { key: "biweekly", label: "Biweekly", periods: 12 },
  { key: "monthly", label: "Monthly", periods: 12 },
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// 2024-01-01 (UTC) is a Monday — anchor week/biweek buckets to it.
const WEEK_ANCHOR = Date.UTC(2024, 0, 1);

/** Start (inclusive) of the period containing time `t`. */
export function periodStart(g: Granularity, t: number): number {
  const d = new Date(t);
  switch (g) {
    case "hourly":
      return Math.floor(t / HOUR) * HOUR;
    case "daily":
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    case "weekly":
      return WEEK_ANCHOR + Math.floor((t - WEEK_ANCHOR) / (7 * DAY)) * 7 * DAY;
    case "biweekly":
      return WEEK_ANCHOR + Math.floor((t - WEEK_ANCHOR) / (14 * DAY)) * 14 * DAY;
    case "monthly":
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }
}

/** Start of the period immediately after the one beginning at `start`. */
export function nextPeriod(g: Granularity, start: number): number {
  const d = new Date(start);
  switch (g) {
    case "hourly":
      return start + HOUR;
    case "daily":
      return start + DAY;
    case "weekly":
      return start + 7 * DAY;
    case "biweekly":
      return start + 14 * DAY;
    case "monthly":
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
}

/** The last `count` period-start timestamps, oldest → newest, ending with the
 *  period that contains `now`. */
export function periodStarts(g: Granularity, count: number, now: number = Date.now()): number[] {
  const starts: number[] = [];
  let s = periodStart(g, now);
  for (let i = 0; i < count; i++) {
    starts.unshift(s);
    s = periodStart(g, s - 1); // start of the previous period
  }
  return starts;
}

/** Human label for a period start. */
export function periodLabel(g: Granularity, start: number): string {
  const d = new Date(start);
  const opts: Intl.DateTimeFormatOptions = { timeZone: "UTC" };
  switch (g) {
    case "hourly":
      return d.toLocaleString("en-US", { ...opts, month: "short", day: "numeric", hour: "numeric" });
    case "monthly":
      return d.toLocaleDateString("en-US", { ...opts, month: "short", year: "2-digit" });
    default:
      return d.toLocaleDateString("en-US", { ...opts, month: "short", day: "numeric" });
  }
}

export interface Point {
  t: number;
  v: number;
}

/** Time-value points for a competitor+platform: every recorded snapshot plus the
 *  current live value, sorted ascending and de-duplicated by timestamp. */
export function pointsFor(c: Competitor, platform: Platform, snapshots: Snapshot[]): Point[] {
  const pts: Point[] = [];
  for (const s of snapshots) {
    if (s.competitorId === c.id && s.platform === platform && s.value != null) {
      pts.push({ t: new Date(s.capturedAt).getTime(), v: s.value });
    }
  }
  const m = c.platforms.find((p) => p.platform === platform);
  if (m && m.value != null) {
    pts.push({ t: m.lastUpdated ? new Date(m.lastUpdated).getTime() : Date.now(), v: m.value });
  }
  pts.sort((a, b) => a.t - b.t);
  // Collapse points sharing a timestamp, keeping the last.
  const out: Point[] = [];
  for (const p of pts) {
    if (Number.isNaN(p.t)) continue;
    if (out.length && out[out.length - 1].t === p.t) out[out.length - 1] = p;
    else out.push(p);
  }
  return out;
}

/** LOCF value as of time `t` (last point at or before `t`), or null if none. */
export function valueAsOf(points: Point[], t: number): number | null {
  let lo = 0;
  let hi = points.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? points[ans].v : null;
}

/** Period-end values for a series across the given period starts. */
export function periodValues(g: Granularity, starts: number[], points: Point[]): (number | null)[] {
  return starts.map((s) => valueAsOf(points, nextPeriod(g, s) - 1));
}

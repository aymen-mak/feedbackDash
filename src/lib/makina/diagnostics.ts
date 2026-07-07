// Structured, source-by-source diagnostics for the Makina collectors.
//
// The point is accuracy: tell apart benign states (nothing posted this week)
// from real failures (Apify credit gone, the scraper's output schema changed,
// a channel went private), and give each a specific, actionable fix plus the
// raw evidence the verdict is based on. Collection writes a report; the
// dashboard's Diagnose button reads it back and overlays fresh live probes.

export type DiagLevel = "ok" | "info" | "warn" | "error";

export interface DiagItem {
  /** Stable id, e.g. "apify", "x:@makinafi", "telegram", "storage". */
  id: string;
  label: string;
  level: DiagLevel;
  /** One-line, plain-language status. */
  summary: string;
  /** The single next action, when something needs doing. */
  fix?: string;
  /** Raw numbers the verdict is based on, shown for transparency. */
  evidence?: Record<string, string | number | boolean | null>;
}

export interface DiagReport {
  at: string;
  /** Worst level across items, drives the headline. */
  level: DiagLevel;
  items: DiagItem[];
  /** Apify usage snapshot for the always-on pill. */
  apify?: { usage: number | null; limit: number | null; resetAt: string | null };
  /** True when the report came from a stored collection run (vs live-only). */
  fromRun?: boolean;
}

/** Persisted last-collection report. */
export type MakinaDiag = DiagReport;

const RANK: Record<DiagLevel, number> = { ok: 0, info: 1, warn: 2, error: 3 };

export function worstLevel(items: DiagItem[]): DiagLevel {
  return items.reduce<DiagLevel>((acc, it) => (RANK[it.level] > RANK[acc] ? it.level : acc), "ok");
}

/** Keep only primitive evidence fields (so the blob stays JSON-clean). */
function ev(raw: Record<string, unknown> = {}): DiagItem["evidence"] {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) out[k] = null;
    else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else out[k] = String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Map a collector error string (+ evidence) to a precise verdict. One generic
 * classifier covers every source; the error strings already carry the source
 * specifics, and `okSummary` supplies a nice line when nothing went wrong.
 */
export function classify(
  id: string,
  label: string,
  error: string | null,
  evidence: Record<string, unknown> = {},
  okSummary?: string
): DiagItem {
  const e = (error || "").toLowerCase();
  const base = { id, label, evidence: ev(evidence) };
  if (!error) return { ...base, level: "ok", summary: okSummary || "Collected OK." };

  // Hard failures (need a human action).
  if (e.includes("not set") || e.includes("missing env"))
    return { ...base, level: "error", summary: error, fix: "Add the env var in Vercel (Production) and redeploy." };
  if (e.includes("401") || e.includes("403") || e.includes("token rejected") || (e.includes("token") && e.includes("apify")))
    return { ...base, level: "error", summary: error, fix: "Regenerate APIFY_TOKEN in Apify and redeploy." };
  if (e.includes("402") || e.includes("credit") || e.includes("payment") || e.includes("usage limit"))
    return { ...base, level: "error", summary: error, fix: "Apify credit is used up. Add a payment method or wait for the cycle reset." };
  if (e.includes("approval") || e.includes("approve") || e.includes("permission"))
    return { ...base, level: "error", summary: error, fix: "Approve the actor's permissions on this Apify account using the link." };
  if (e.includes("schema") || e.includes("recognizable author") || e.includes("field name"))
    return { ...base, level: "error", summary: error, fix: "The scraper's output format changed; update the field mapping in collectors.ts." };

  // The scraper ran but produced nothing for an account that should have posts.
  // NOT benign: with the search + profiles fallback both exhausted, an empty
  // result means a block or an actor change, not "no posts this week".
  if (e.includes("came back empty"))
    return {
      ...base,
      level: "warn",
      summary: error,
      fix: "Open the debug link for the actor's raw output; if it persists, the actor's input schema or X likely changed.",
    };

  // Soft problems (worth a look, often self-clearing or config).
  if (e.includes("returned posts for"))
    return { ...base, level: "warn", summary: error, fix: "The scraper returned other accounts; verify the handle is correct and public." };
  if (e.includes("private") || e.includes("wrong handle") || e.includes("no public"))
    return { ...base, level: "warn", summary: error, fix: "Check the handle is correct and the channel exposes a public count." };
  if (e.includes("unreachable") || e.includes("could not reach") || e.includes("network") || e.includes("econn"))
    return { ...base, level: "warn", summary: error, fix: "Source was unreachable; usually transient, retry shortly." };
  if (e.includes("timed out") || e.includes("429") || e.includes("rate"))
    return { ...base, level: "warn", summary: error, fix: "Rate-limited or slow; retried automatically and should clear." };

  // Skipped because a dependency (Apify) was unhealthy — see its own item.
  if (e.includes("skipped"))
    return { ...base, level: "info", summary: error, fix: "Resolve the Apify issue above; X collection runs once it is healthy." };

  // Deferred: this invocation's time budget ran out before its scrape could run.
  if (e.includes("deferred"))
    return { ...base, level: "info", summary: error, fix: "Queued first for the next collection — run Collect now again to fetch it immediately." };

  // Benign: connected fine, just nothing to record this period.
  if (e.includes("0 items") || e.includes("no posts") || e.includes("no tweets") || e.includes("no data") || e.includes("nothing"))
    return { ...base, level: "info", summary: error, fix: "Not a failure — nothing in the window, so the last values are carried forward." };

  return { ...base, level: "warn", summary: error, fix: "Retry; if it persists, check the Apify token and credit." };
}

/** Live Apify account check: reachable, token valid, credit left. */
export async function apifyDiag(): Promise<{ item: DiagItem; apify: NonNullable<DiagReport["apify"]> }> {
  const none = { usage: null, limit: null, resetAt: null };
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return {
      item: {
        id: "apify",
        label: "Apify · X scraper",
        level: "error",
        summary: "APIFY_TOKEN is not set on this deployment.",
        fix: "Add APIFY_TOKEN in Vercel (Production) and redeploy.",
      },
      apify: none,
    };
  }
  try {
    const res = await fetch(`https://api.apify.com/v2/users/me/limits?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return {
        item: {
          id: "apify",
          label: "Apify · X scraper",
          level: "error",
          summary: `Apify rejected the token (HTTP ${res.status}).`,
          fix: "Regenerate the token in Apify (Settings → API & Integrations), update APIFY_TOKEN, and redeploy.",
          evidence: { status: res.status },
        },
        apify: none,
      };
    }
    if (!res.ok) {
      return {
        item: {
          id: "apify",
          label: "Apify · X scraper",
          level: "warn",
          summary: `Apify limits endpoint returned HTTP ${res.status}.`,
          fix: "Usually transient; retry shortly.",
          evidence: { status: res.status },
        },
        apify: none,
      };
    }
    const j = (await res.json()) as {
      data?: { current?: Record<string, unknown>; limits?: Record<string, unknown>; monthlyUsageCycle?: Record<string, unknown> };
    };
    const usage = typeof j.data?.current?.monthlyUsageUsd === "number" ? (j.data.current.monthlyUsageUsd as number) : null;
    const limit = typeof j.data?.limits?.maxMonthlyUsageUsd === "number" ? (j.data.limits.maxMonthlyUsageUsd as number) : null;
    const resetAt = typeof j.data?.monthlyUsageCycle?.endAt === "string" ? (j.data.monthlyUsageCycle.endAt as string).slice(0, 10) : null;
    const exhausted = usage != null && limit != null && usage >= limit - 1e-9;
    const near = !exhausted && usage != null && limit != null && usage >= limit * 0.8;
    return {
      item: {
        id: "apify",
        label: "Apify · X scraper",
        level: exhausted ? "error" : near ? "warn" : "ok",
        summary:
          usage != null && limit != null
            ? `Reachable. Usage $${usage.toFixed(2)} of $${limit}${exhausted ? " — limit reached." : near ? " — running low." : "."}`
            : "Reachable.",
        fix: exhausted
          ? `Free credit is used up. Add a payment method in Apify or raise the monthly limit${resetAt ? `, or wait for the reset on ${resetAt}` : ""}.`
          : near
          ? "Approaching the monthly limit; collections may start failing soon."
          : undefined,
        evidence: { usage, limit, resetAt },
      },
      apify: { usage, limit, resetAt },
    };
  } catch (e) {
    return {
      item: {
        id: "apify",
        label: "Apify · X scraper",
        level: "error",
        summary: `Could not reach Apify: ${e instanceof Error ? e.message : String(e)}`,
        fix: "Likely transient; retry shortly.",
      },
      apify: none,
    };
  }
}

/** Live config check (cheap, no network). */
export function envDiag(): DiagItem {
  const missing: string[] = [];
  if (!process.env.APIFY_TOKEN) missing.push("APIFY_TOKEN");
  return missing.length
    ? {
        id: "env",
        label: "Configuration",
        level: "warn",
        summary: `Missing environment variable(s): ${missing.join(", ")}.`,
        fix: "Add them in Vercel (Production) and redeploy.",
        evidence: { missing: missing.join(", ") },
      }
    : { id: "env", label: "Configuration", level: "ok", summary: "Required environment variables are present." };
}

/** Storage health from what the journal read returned. */
export function storageDiag(opts: { postgres: boolean; entries: number; lastAt: string | null }): DiagItem {
  const backend = opts.postgres ? "Postgres" : "file/in-memory";
  if (opts.entries === 0) {
    return {
      id: "storage",
      label: "Storage",
      level: "info",
      summary: `${backend} reachable, but no collection has been stored yet.`,
      fix: "Click “Collect now” to run the first collection.",
      evidence: { backend, entries: 0 },
    };
  }
  return {
    id: "storage",
    label: "Storage",
    level: "ok",
    summary: `${backend} · ${opts.entries} stored period-entries${opts.lastAt ? `, latest ${opts.lastAt}` : ""}.`,
    evidence: { backend, entries: opts.entries, lastAt: opts.lastAt },
  };
}

// Self-diagnostics for the Makina collectors. Surfaces the actual cause of a
// failed collection (and the one action to fix it) instead of a vague chip.

export interface SourceDiag {
  ok: boolean;
  message: string;
  fix?: string;
  detail?: Record<string, unknown>;
}

/** Checks the Apify account behind APIFY_TOKEN: reachable, token valid, credit left. */
export async function diagnoseApify(): Promise<SourceDiag> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return {
      ok: false,
      message: "APIFY_TOKEN is not set on this deployment.",
      fix: "Add APIFY_TOKEN in Vercel (Production) and redeploy.",
    };
  }
  try {
    const res = await fetch(`https://api.apify.com/v2/users/me/limits?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message: `Apify rejected the token (HTTP ${res.status}).`,
        fix: "Regenerate the token in Apify (Settings > API & Integrations), update APIFY_TOKEN, and redeploy.",
        detail: { status: res.status },
      };
    }
    const j = (await res.json()) as {
      data?: { current?: Record<string, unknown>; limits?: Record<string, unknown>; monthlyUsageCycle?: Record<string, unknown> };
    };
    const current = (j.data?.current ?? {}) as Record<string, unknown>;
    const limits = (j.data?.limits ?? {}) as Record<string, unknown>;
    const cycle = (j.data?.monthlyUsageCycle ?? {}) as Record<string, unknown>;
    const usage = typeof current.monthlyUsageUsd === "number" ? current.monthlyUsageUsd : undefined;
    const limit = typeof limits.maxMonthlyUsageUsd === "number" ? limits.maxMonthlyUsageUsd : undefined;
    const resetAt = typeof cycle.endAt === "string" ? cycle.endAt.slice(0, 10) : undefined;
    const exhausted = usage != null && limit != null && usage >= limit - 1e-9;
    return {
      ok: !exhausted,
      message: exhausted
        ? `Apify monthly usage limit reached (~$${usage?.toFixed(2)} of $${limit}).`
        : `Apify reachable. Usage ~$${usage != null ? usage.toFixed(2) : "?"} of $${limit ?? "?"} this cycle.`,
      fix: exhausted
        ? `The free credit is used up. Add a payment method in Apify or raise the monthly limit${resetAt ? `, or wait for the reset on ${resetAt}` : ""}.`
        : undefined,
      detail: { usage, limit, resetAt, current, limits },
    };
  } catch (e) {
    return {
      ok: false,
      message: `Could not reach Apify: ${e instanceof Error ? e.message : String(e)}`,
      fix: "Likely transient; retry shortly.",
    };
  }
}

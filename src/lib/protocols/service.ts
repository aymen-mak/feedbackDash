import { fetchProtocols, type LlamaProtocol } from "@/lib/sources/defillama";
import { type Severity } from "@/lib/risk/severity";
import { PROTOCOL_WATCHLIST, type ProtocolCategory } from "./watchlist";
import {
  type ProtocolHealth,
  type ProtocolReport,
  type ProtocolBrief,
  TVL_CRITICAL_1D,
  TVL_CRITICAL_7D,
  TVL_WARN_1D,
  TVL_WARN_7D,
} from "./types";

const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** TVL-trend health from the 1d/7d change windows (the core exodus signal). */
function tvlHealth(c1d: number | null, c7d: number | null): { severity: Severity; headline: string } {
  if ((c1d != null && c1d <= TVL_CRITICAL_1D) || (c7d != null && c7d <= TVL_CRITICAL_7D)) {
    const worst = Math.min(c1d ?? 0, c7d ?? 0);
    return { severity: "critical", headline: `Sharp TVL drop (${worst.toFixed(0)}%)` };
  }
  if ((c1d != null && c1d <= TVL_WARN_1D) || (c7d != null && c7d <= TVL_WARN_7D)) {
    return { severity: "warn", headline: "TVL outflows" };
  }
  if (c7d != null && c7d >= 5) return { severity: "ok", headline: "TVL growing" };
  return { severity: "ok", headline: "TVL stable" };
}

export async function getProtocolHealth(): Promise<ProtocolReport> {
  const protocols = await fetchProtocols();

  // Index for robust matching: by slug, and by normalized name.
  const bySlug = new Map<string, LlamaProtocol>();
  const byName = new Map<string, LlamaProtocol>();
  for (const p of protocols) {
    if (p.slug) bySlug.set(p.slug.toLowerCase(), p);
    if (p.name) byName.set(slugify(p.name), p);
  }

  const watched: ProtocolHealth[] = [];
  const unmatched: string[] = [];
  for (const w of PROTOCOL_WATCHLIST) {
    const p =
      bySlug.get(w.slug.toLowerCase()) ?? byName.get(slugify(w.label)) ?? byName.get(slugify(w.slug));
    if (!p) {
      unmatched.push(w.label);
      watched.push({
        slug: w.slug,
        name: w.label,
        category: w.category,
        chains: [],
        tvl: null,
        change1d: null,
        change7d: null,
        change30d: null,
        mcap: null,
        severity: "info",
        headline: "Not found on DefiLlama",
        matched: false,
        signals: [],
      });
      continue;
    }
    const c1d = numOrNull(p.change_1d);
    const c7d = numOrNull(p.change_7d);
    const c30d = numOrNull(p.change_1m);
    const { severity, headline } = tvlHealth(c1d, c7d);
    watched.push({
      slug: p.slug ?? w.slug,
      name: p.name ?? w.label,
      category: w.category,
      chains: Array.isArray(p.chains) ? p.chains : [],
      tvl: numOrNull(p.tvl),
      change1d: c1d,
      change7d: c7d,
      change30d: c30d,
      mcap: numOrNull(p.mcap),
      severity,
      headline,
      matched: true,
      signals: [{ label: headline, severity, detail: "DefiLlama TVL" }],
    });
  }

  // Browse-all: top protocols by TVL (the full ~3k list is too much to ship).
  const all: ProtocolBrief[] = protocols
    .filter((p) => numOrNull(p.tvl) != null)
    .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
    .slice(0, 300)
    .map((p) => ({
      slug: p.slug ?? slugify(p.name ?? ""),
      name: p.name ?? p.slug ?? "Unknown",
      category: p.category ?? "Other",
      tvl: numOrNull(p.tvl),
      change1d: numOrNull(p.change_1d),
      change7d: numOrNull(p.change_7d),
      chains: Array.isArray(p.chains) ? p.chains : [],
    }));

  const flagged = watched.filter((p) => p.severity === "warn" || p.severity === "critical");
  return {
    at: new Date().toISOString(),
    watched,
    all,
    summary: {
      watched: watched.length,
      flagged: flagged.length,
      critical: watched.filter((p) => p.severity === "critical").length,
      totalTvl: watched.reduce((s, p) => s + (p.tvl ?? 0), 0),
      unmatched,
    },
  };
}

export type { ProtocolCategory };

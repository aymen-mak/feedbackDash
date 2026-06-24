import {
  type StablecoinReport,
  type StablecoinRow,
  type DepegStatus,
  DEPEG_THRESHOLD,
  WATCH_THRESHOLD,
  SIGNIFICANT_MCAP,
} from "./types";

// DefiLlama stablecoins API (free, no key) — the same provider already used for
// on-chain competitor metrics. `includePrices=true` attaches a USD price to each
// pegged asset, which is what lets us measure deviation from the peg.
const STABLECOINS_URL = "https://stablecoins.llama.fi/stablecoins?includePrices=true";

const PEG_LABEL: Record<string, string> = {
  peggedUSD: "USD",
  peggedEUR: "EUR",
  peggedGBP: "GBP",
  peggedJPY: "JPY",
  peggedCHF: "CHF",
  peggedCAD: "CAD",
  peggedAUD: "AUD",
  peggedCNY: "CNY",
  peggedKRW: "KRW",
  peggedBRL: "BRL",
  peggedREAL: "BRL",
  peggedTRY: "TRY",
  peggedRUB: "RUB",
  peggedSGD: "SGD",
  peggedHKD: "HKD",
  peggedINR: "INR",
  peggedIDR: "IDR",
  peggedARS: "ARS",
  peggedMXN: "MXN",
  peggedXAU: "Gold",
  peggedGold: "Gold",
  peggedVAR: "Variable",
};

function pegLabelFor(pegType: string): string {
  return PEG_LABEL[pegType] ?? pegType.replace(/^pegged/, "");
}

function mechanismLabel(m: string): string {
  const x = (m || "").toLowerCase();
  if (x.includes("fiat")) return "Fiat-backed";
  if (x.includes("crypto")) return "Crypto-backed";
  if (x.includes("algo")) return "Algorithmic";
  return m || "—";
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

interface RawAsset {
  id?: string | number;
  name?: string;
  symbol?: string;
  pegType?: string;
  pegMechanism?: string;
  price?: number | null;
  circulating?: Record<string, number> | null;
  chains?: string[];
}

export async function getStablecoins(): Promise<StablecoinReport> {
  const res = await fetch(STABLECOINS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`DefiLlama stablecoins API HTTP ${res.status}`);
  const json = (await res.json()) as { peggedAssets?: RawAsset[] };
  const raw = Array.isArray(json.peggedAssets) ? json.peggedAssets : [];

  // Peg target per type: $1 for USD; for other fiat pegs we don't have an FX
  // feed, so use the median price across that peg group as the implied target —
  // a coin is "depegged" when it strays from where its peers sit.
  const pricesByType: Record<string, number[]> = {};
  for (const a of raw) {
    const p = typeof a.price === "number" && Number.isFinite(a.price) ? a.price : null;
    if (p != null && p > 0) (pricesByType[String(a.pegType)] ??= []).push(p);
  }
  const targetByType: Record<string, number | null> = {};
  for (const [t, arr] of Object.entries(pricesByType)) targetByType[t] = median(arr);
  targetByType.peggedUSD = 1;

  const assets: StablecoinRow[] = raw.map((a) => {
    const pegType = String(a.pegType || "peggedUSD");
    const price = typeof a.price === "number" && Number.isFinite(a.price) ? a.price : null;
    const circulating =
      a.circulating && typeof a.circulating[pegType] === "number" ? a.circulating[pegType] : null;
    const target = pegType === "peggedVAR" ? null : pegType === "peggedUSD" ? 1 : targetByType[pegType] ?? null;
    const deviation = price != null && target != null && target > 0 ? price / target - 1 : null;

    let status: DepegStatus;
    if (pegType === "peggedVAR") status = "variable";
    else if (price == null || deviation == null) status = "unknown";
    else if (deviation > DEPEG_THRESHOLD) status = "depegged-above";
    else if (deviation < -DEPEG_THRESHOLD) status = "depegged-below";
    else if (Math.abs(deviation) > WATCH_THRESHOLD) status = "watch";
    else status = "on-peg";
    const direction: StablecoinRow["direction"] =
      deviation == null ? null : deviation > 0.0005 ? "above" : deviation < -0.0005 ? "below" : "flat";

    const mcap = circulating != null ? circulating * (price ?? 1) : null;
    const significant = price != null && mcap != null && mcap >= SIGNIFICANT_MCAP;

    return {
      id: String(a.id ?? a.symbol ?? a.name ?? Math.random()),
      name: String(a.name || a.symbol || "Unknown"),
      symbol: String(a.symbol || "?").toUpperCase(),
      pegType,
      pegLabel: pegLabelFor(pegType),
      mechanism: mechanismLabel(String(a.pegMechanism || "")),
      price,
      target,
      deviation,
      status,
      direction,
      mcap,
      circulating,
      chains: Array.isArray(a.chains) ? a.chains.map(String) : [],
      significant,
    };
  });

  // Headline + tiles describe the MONITORED set (≥ $10M mcap), so a dead coin's
  // illiquid "depeg" can't pollute the summary. The full catalogue is still
  // returned (flagged) so the page's "Show all" toggle can reveal it.
  const monitored = assets.filter((a) => a.significant);
  const count = (s: DepegStatus) => monitored.filter((a) => a.status === s).length;
  const worst = monitored
    .filter((a) => a.deviation != null && a.status !== "variable")
    .sort((a, b) => Math.abs(b.deviation!) - Math.abs(a.deviation!))
    .slice(0, 5)
    .map((a) => ({ symbol: a.symbol, name: a.name, deviation: a.deviation! }));

  return {
    at: new Date().toISOString(),
    assets,
    summary: {
      total: monitored.length,
      onPeg: count("on-peg"),
      watch: count("watch"),
      depeggedBelow: count("depegged-below"),
      depeggedAbove: count("depegged-above"),
      variable: count("variable"),
      noPrice: count("unknown"),
      totalMcap: monitored.reduce((s, a) => s + (a.mcap ?? 0), 0),
      catalog: assets.length,
      hidden: assets.length - monitored.length,
      worst,
    },
  };
}

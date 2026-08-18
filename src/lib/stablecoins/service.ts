import {
  type StablecoinReport,
  type StablecoinRow,
  type DepegStatus,
  DEPEG_THRESHOLD,
  WATCH_THRESHOLD,
  SIGNIFICANT_MCAP,
} from "./types";
import { fetchStablecoins, fetchPrices, type LlamaStablecoinRaw } from "@/lib/sources/defillama";
import { DERIVATIVES } from "./registry";

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

const pegLabelFor = (pegType: string): string => PEG_LABEL[pegType] ?? pegType.replace(/^pegged/, "");

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

const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Classify a deviation from a fixed peg target (used for $1 / median-peg assets). */
function classifyVsTarget(price: number | null, target: number | null): Pick<StablecoinRow, "deviation" | "status" | "direction"> {
  const deviation = price != null && target != null && target > 0 ? price / target - 1 : null;
  let status: DepegStatus;
  if (price == null || deviation == null) status = "unknown";
  else if (deviation > DEPEG_THRESHOLD) status = "depegged-above";
  else if (deviation < -DEPEG_THRESHOLD) status = "depegged-below";
  else if (Math.abs(deviation) > WATCH_THRESHOLD) status = "watch";
  else status = "on-peg";
  const direction: StablecoinRow["direction"] =
    deviation == null ? null : deviation > 0.0005 ? "above" : deviation < -0.0005 ? "below" : "flat";
  return { deviation, status, direction };
}

function toBaseRow(a: LlamaStablecoinRaw, targetByType: Record<string, number | null>): StablecoinRow {
  const pegType = String(a.pegType || "peggedUSD");
  const price = numOrNull(a.price);
  const circulating = a.circulating && typeof a.circulating[pegType] === "number" ? a.circulating[pegType] : null;
  const isVar = pegType === "peggedVAR";
  const target = isVar ? null : pegType === "peggedUSD" ? 1 : targetByType[pegType] ?? null;
  const cls = isVar
    ? { deviation: null, status: "variable" as DepegStatus, direction: null }
    : classifyVsTarget(price, target);
  const mcap = circulating != null ? circulating * (price ?? 1) : null;
  return {
    id: String(a.id ?? a.symbol ?? a.name ?? Math.random()),
    name: String(a.name || a.symbol || "Unknown"),
    symbol: String(a.symbol || "?").toUpperCase(),
    pegType,
    pegLabel: pegLabelFor(pegType),
    mechanism: mechanismLabel(String(a.pegMechanism || "")),
    price,
    target,
    ...cls,
    mcap,
    circulating,
    chains: Array.isArray(a.chains) ? a.chains.map(String) : [],
    significant: price != null && mcap != null && mcap >= SIGNIFICANT_MCAP,
    category: "base",
    underlying: null,
    yieldBearing: false,
  };
}

export async function getStablecoins(): Promise<StablecoinReport> {
  const raw = await fetchStablecoins();

  // Peg target per type: $1 for USD; median of the group for other fiats.
  const pricesByType: Record<string, number[]> = {};
  for (const a of raw) {
    const p = numOrNull(a.price);
    if (p != null && p > 0) (pricesByType[String(a.pegType)] ??= []).push(p);
  }
  const targetByType: Record<string, number | null> = {};
  for (const [t, arr] of Object.entries(pricesByType)) targetByType[t] = median(arr);
  targetByType.peggedUSD = 1;

  const base = raw.map((a) => toBaseRow(a, targetByType));
  const bySymbol = new Map(base.map((r) => [r.symbol.toUpperCase(), r]));

  // Staked/wrapped derivatives (not in the feed): price via the coins API.
  let prices: Record<string, { price: number }> = {};
  try {
    prices = await fetchPrices(DERIVATIVES.map((d) => d.priceId));
  } catch {
    /* derivatives still render with underlying-derived status, just no live price */
  }

  const derivatives: StablecoinRow[] = [];
  for (const d of DERIVATIVES) {
    if (bySymbol.has(d.symbol.toUpperCase())) continue; // feed already lists it
    const price = numOrNull(prices[d.priceId]?.price);
    const under = d.underlying ? bySymbol.get(d.underlying.toUpperCase()) ?? null : null;

    let row: Pick<StablecoinRow, "deviation" | "status" | "direction" | "target" | "pegLabel" | "pegType">;
    if (d.category !== "base" && d.yieldBearing) {
      // Appreciating wrapper: its peg risk IS the underlying's. Inherit it.
      row = {
        deviation: under?.deviation ?? null,
        status: under?.status ?? "unknown",
        direction: under?.direction ?? null,
        target: under?.target ?? null,
        pegLabel: under?.pegLabel ?? "USD",
        pegType: under?.pegType ?? "peggedUSD",
      };
    } else {
      // 1:1 wrapper or a base supplement DefiLlama misses → measured against $1.
      row = { ...classifyVsTarget(price, 1), target: 1, pegLabel: "USD", pegType: "peggedUSD" };
    }

    derivatives.push({
      id: `deriv:${d.symbol}`,
      name: d.name,
      symbol: d.symbol.toUpperCase(),
      mechanism: under?.mechanism ?? (d.category === "staked" ? "Staked" : d.category === "wrapped" ? "Wrapped" : "—"),
      price,
      mcap: null,
      circulating: null,
      chains: under?.chains ?? [],
      significant: true, // curated, always monitored
      category: d.category,
      underlying: d.underlying,
      yieldBearing: d.yieldBearing,
      ...row,
    });
  }

  const assets = [...base, ...derivatives];

  // Headline + tiles describe the MONITORED set (significant base + all derivatives).
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
      derivatives: derivatives.length,
      worst,
    },
  };
}

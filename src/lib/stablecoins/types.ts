// Shared types for the stablecoin depeg monitor (DefiLlama stablecoins API).

export type DepegStatus = "on-peg" | "watch" | "depegged" | "variable" | "unknown";

export interface StablecoinRow {
  id: string;
  name: string;
  symbol: string;
  /** Raw DefiLlama peg type, e.g. "peggedUSD", "peggedEUR", "peggedVAR". */
  pegType: string;
  /** Friendly peg label, e.g. "USD", "EUR", "Gold", "Variable". */
  pegLabel: string;
  /** Backing mechanism, e.g. "Fiat-backed", "Crypto-backed", "Algorithmic". */
  mechanism: string;
  /** Current price in USD (null if DefiLlama has none). */
  price: number | null;
  /** Peg target in USD ($1 for USD pegs; group-median for other fiat pegs). */
  target: number | null;
  /** Signed fractional deviation from the peg (price / target − 1). */
  deviation: number | null;
  status: DepegStatus;
  /** Circulating market cap in USD. */
  mcap: number | null;
  circulating: number | null;
  chains: string[];
}

export interface StablecoinReport {
  at: string;
  assets: StablecoinRow[];
  summary: {
    total: number;
    onPeg: number;
    watch: number;
    depegged: number;
    variable: number;
    noPrice: number;
    totalMcap: number;
    /** Largest absolute deviations (excluding variable-peg), for the headline. */
    worst: { symbol: string; name: string; deviation: number }[];
  };
}

/** Off the peg by more than this fraction = a real depeg. */
export const DEPEG_THRESHOLD = 0.02; // 2%
/** Off the peg by more than this (but under DEPEG) = worth watching. */
export const WATCH_THRESHOLD = 0.005; // 0.5%

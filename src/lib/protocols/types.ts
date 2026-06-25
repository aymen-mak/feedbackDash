import { type Severity } from "@/lib/risk/severity";
import { type ProtocolCategory } from "./watchlist";

/** An extensible health signal — TVL trend today, on-chain utilization /
 *  incident feeds later, without changing the shape. */
export interface ProtocolSignal {
  label: string;
  severity: Severity;
  detail?: string;
}

export interface ProtocolHealth {
  slug: string;
  name: string;
  category: ProtocolCategory;
  chains: string[];
  tvl: number | null;
  change1d: number | null; // percent
  change7d: number | null;
  change30d: number | null;
  mcap: number | null;
  severity: Severity;
  headline: string;
  /** False when the watchlist entry couldn't be matched on DefiLlama. */
  matched: boolean;
  signals: ProtocolSignal[];
}

/** A lightweight protocol row for the browse-all view. */
export interface ProtocolBrief {
  slug: string;
  name: string;
  category: string;
  tvl: number | null;
  change1d: number | null;
  change7d: number | null;
  chains: string[];
}

export interface ProtocolReport {
  at: string;
  watched: ProtocolHealth[];
  all: ProtocolBrief[];
  summary: {
    watched: number;
    flagged: number; // warn + critical
    critical: number;
    totalTvl: number;
    unmatched: string[];
  };
}

/** TVL drop thresholds (percent). A sharp 1d/7d drop is the exodus/exploit tell. */
export const TVL_CRITICAL_1D = -10;
export const TVL_CRITICAL_7D = -25;
export const TVL_WARN_1D = -3;
export const TVL_WARN_7D = -12;

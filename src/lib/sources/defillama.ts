import { getJson } from "./http";

// Typed DefiLlama clients (free, no key). Shared by every tool that needs
// DefiLlama data — they call these and own their domain logic, never the URL.

export interface LlamaStablecoinRaw {
  id?: string | number;
  name?: string;
  symbol?: string;
  pegType?: string;
  pegMechanism?: string;
  price?: number | null;
  circulating?: Record<string, number> | null;
  chains?: string[];
}

/** All base pegged assets DefiLlama tracks (USDT, USDC, USDe, DAI, …). */
export async function fetchStablecoins(): Promise<LlamaStablecoinRaw[]> {
  const j = await getJson<{ peggedAssets?: LlamaStablecoinRaw[] }>(
    "https://stablecoins.llama.fi/stablecoins?includePrices=true",
    20000
  );
  return Array.isArray(j.peggedAssets) ? j.peggedAssets : [];
}

export interface CoinPrice {
  price: number;
  symbol?: string;
  decimals?: number;
  timestamp?: number;
  confidence?: number;
}

/**
 * Current USD prices for arbitrary tokens via the DefiLlama coins API.
 * `ids` are like "coingecko:savings-dai" or "ethereum:0xabc…". Used to price
 * staked/wrapped stablecoins, which the stablecoins feed doesn't include.
 */
export async function fetchPrices(ids: string[]): Promise<Record<string, CoinPrice>> {
  const clean = [...new Set(ids.filter(Boolean))];
  if (clean.length === 0) return {};
  const j = await getJson<{ coins?: Record<string, CoinPrice> }>(
    `https://coins.llama.fi/prices/current/${clean.join(",")}`,
    20000
  );
  return j.coins ?? {};
}

export interface LlamaProtocol {
  name: string;
  slug: string;
  category?: string;
  chains?: string[];
  tvl?: number | null;
  change_1d?: number | null;
  change_7d?: number | null;
  change_1m?: number | null;
  mcap?: number | null;
}

/** All protocols DefiLlama tracks, with current TVL and change windows. */
export async function fetchProtocols(): Promise<LlamaProtocol[]> {
  const j = await getJson<LlamaProtocol[]>("https://api.llama.fi/protocols", 25000);
  return Array.isArray(j) ? j : [];
}

// The protocols Makina vaults / curators are likely exposed to. This is the
// "what we depend on" focus list; matched against DefiLlama by slug OR name so a
// slightly-off slug still resolves. Edit this to mirror real strategy exposure.

export type ProtocolCategory =
  | "Lending"
  | "DEX"
  | "Yield"
  | "LST/LRT"
  | "Stablecoin"
  | "RWA"
  | "Perps"
  | "Other";

export const PROTOCOL_CATEGORIES: ProtocolCategory[] = [
  "Lending",
  "DEX",
  "Yield",
  "LST/LRT",
  "Stablecoin",
  "RWA",
  "Perps",
  "Other",
];

export interface WatchedProtocol {
  /** DefiLlama slug (best-effort; name match is the fallback). */
  slug: string;
  label: string;
  category: ProtocolCategory;
}

export const PROTOCOL_WATCHLIST: WatchedProtocol[] = [
  // Lending / money markets — withdrawability is existential for vaults
  { slug: "aave-v3", label: "Aave V3", category: "Lending" },
  { slug: "morpho-blue", label: "Morpho", category: "Lending" },
  { slug: "compound-v3", label: "Compound V3", category: "Lending" },
  { slug: "spark", label: "Spark", category: "Lending" },
  { slug: "fluid", label: "Fluid", category: "Lending" },
  { slug: "euler-v2", label: "Euler V2", category: "Lending" },
  // Yield / synthetic dollars
  { slug: "pendle", label: "Pendle", category: "Yield" },
  { slug: "ethena", label: "Ethena", category: "Yield" },
  // DEX / liquidity
  { slug: "curve-dex", label: "Curve", category: "DEX" },
  { slug: "uniswap-v3", label: "Uniswap V3", category: "DEX" },
  { slug: "balancer-v2", label: "Balancer V2", category: "DEX" },
  { slug: "aerodrome-slipstream", label: "Aerodrome", category: "DEX" },
  // LST / LRT
  { slug: "lido", label: "Lido", category: "LST/LRT" },
  { slug: "ether.fi", label: "ether.fi", category: "LST/LRT" },
  { slug: "kelp", label: "Kelp", category: "LST/LRT" },
  { slug: "renzo", label: "Renzo", category: "LST/LRT" },
  // Stablecoin issuers / CDPs
  { slug: "sky-lending", label: "Sky", category: "Stablecoin" },
  { slug: "liquity-v2", label: "Liquity V2", category: "Stablecoin" },
  // RWA
  { slug: "usual", label: "Usual", category: "RWA" },
  // Perps
  { slug: "gmx-v2", label: "GMX V2", category: "Perps" },
];

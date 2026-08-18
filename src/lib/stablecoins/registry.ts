// Staked / wrapped / wrapped-staked stablecoins are NOT in DefiLlama's
// stablecoins feed (they're wrappers, not separately-issued pegged assets), so
// we curate them here and price them via the DefiLlama coins API.
//
// Peg semantics:
//  • yieldBearing (sUSDe, sDAI, sUSDS, …): the token appreciates vs its
//    underlying, so measuring it against $1 is meaningless. Its peg RISK is the
//    underlying's — so we inherit the underlying's status and just display the
//    wrapper's live price for reference.
//  • non-yield wrapped (1:1) / base supplements DefiLlama misses: measured
//    against $1 directly.
//
// `priceId` is a DefiLlama coins API id ("coingecko:<id>" or "<chain>:0x<addr>").
// `underlying` must match a base stablecoin symbol from the DefiLlama feed.
// This list is meant to be edited as new derivatives ship.

export type DerivativeCategory = "staked" | "wrapped" | "base";

export interface DerivativeDef {
  symbol: string;
  name: string;
  priceId: string;
  /** Base stablecoin symbol this tracks; null for base supplements. */
  underlying: string | null;
  category: DerivativeCategory;
  yieldBearing: boolean;
}

export const DERIVATIVES: DerivativeDef[] = [
  // ── Ethena ──
  { symbol: "sUSDe", name: "Staked USDe", priceId: "coingecko:ethena-staked-usde", underlying: "USDe", category: "staked", yieldBearing: true },
  // ── Sky / Maker ──
  { symbol: "sDAI", name: "Savings DAI", priceId: "coingecko:savings-dai", underlying: "DAI", category: "staked", yieldBearing: true },
  { symbol: "sUSDS", name: "Savings USDS", priceId: "coingecko:susds", underlying: "USDS", category: "staked", yieldBearing: true },
  // ── Frax ──
  { symbol: "sfrxUSD", name: "Staked frxUSD", priceId: "coingecko:staked-frax-usd", underlying: "frxUSD", category: "staked", yieldBearing: true },
  // ── Curve ──
  { symbol: "scrvUSD", name: "Savings crvUSD", priceId: "coingecko:savings-crvusd", underlying: "crvUSD", category: "staked", yieldBearing: true },
  // ── Stables Labs ──
  { symbol: "sUSDX", name: "Staked USDX", priceId: "coingecko:staked-usdx", underlying: "USDX", category: "staked", yieldBearing: true },
  // ── Elixir ──
  { symbol: "sdeUSD", name: "Staked deUSD", priceId: "coingecko:elixir-staked-deusd", underlying: "deUSD", category: "staked", yieldBearing: true },
  // ── Inverse ──
  { symbol: "sDOLA", name: "Staked DOLA", priceId: "coingecko:sdola", underlying: "DOLA", category: "staked", yieldBearing: true },
  // ── Mountain ──
  { symbol: "wUSDM", name: "Wrapped USDM", priceId: "coingecko:wrapped-usdm", underlying: "USDM", category: "wrapped", yieldBearing: true },
  // ── Resolv ──
  { symbol: "wstUSR", name: "Wrapped staked USR", priceId: "coingecko:wrapped-staked-usr", underlying: "USR", category: "wrapped", yieldBearing: true },
  // ── Level ──
  { symbol: "slvlUSD", name: "Staked lvlUSD", priceId: "coingecko:staked-level-usd", underlying: "lvlUSD", category: "staked", yieldBearing: true },
  // ── Avalon ──
  { symbol: "sUSDa", name: "Staked USDa", priceId: "coingecko:susda", underlying: "USDa", category: "staked", yieldBearing: true },

  // ── Base supplements: issuers DefiLlama's stablecoins feed may not list.
  //    (Deduped against the feed by symbol, so harmless if already present.) ──
  { symbol: "M", name: "M by M^0", priceId: "coingecko:m-by-m-0", underlying: null, category: "base", yieldBearing: false },
];

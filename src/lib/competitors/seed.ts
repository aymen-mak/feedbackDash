import { type Competitor, type PlatformMetric, makeMetric } from "./types";

// Initial competitor set — community values encoded from Aymen's manual
// analysis (2026-05-31); platform identifiers (handles / invite codes / org
// slugs) verified by a research pass. Unknown / unverified = `null` ("N/A").
//
// `autoKey` is pre-filled ONLY where the identifier was verified from a
// primary source, so production refreshes auto-collect those out of the box.
// X/Twitter handles are filled for display but kept manual (no free API);
// anything still manual is one paste away from auto in the editor.

export const SEED_DATE = "2026-05-31T00:00:00.000Z";

function xUrl(handle: string | null): string | null {
  return handle ? `https://x.com/${handle.replace(/^@/, "")}` : null;
}
function liUrl(slug: string): string {
  return `https://www.linkedin.com/company/${slug}`;
}
function ghUrl(slug: string): string {
  return `https://github.com/${slug}`;
}

interface SeedInput {
  id: string;
  name: string;
  isSelf?: boolean;
  segment: string;
  tvl?: string | null;
  token?: string | null;
  website?: string | null;
  defillamaSlug?: string | null;
  remark: string;
  communityStrength: number;
  platforms: PlatformMetric[];
}

function build(input: SeedInput): Competitor {
  // Derive best-effort auto keys for X / LinkedIn from their handles, so the
  // scrape collectors run on deploy without per-row config.
  const platforms = input.platforms.map((p) => {
    if (p.autoKey) return p;
    if (p.platform === "twitter" && p.handle) return { ...p, autoKey: p.handle.replace(/^@/, "") };
    if (p.platform === "linkedin" && p.handle) return { ...p, autoKey: p.handle };
    return p;
  });
  return {
    id: input.id,
    name: input.name,
    isSelf: input.isSelf ?? false,
    segment: input.segment,
    tvl: input.tvl ?? null,
    token: input.token ?? null,
    website: input.website ?? null,
    defillamaSlug: input.defillamaSlug ?? null,
    onchain: null,
    remark: input.remark,
    communityStrength: input.communityStrength,
    platforms,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  };
}

// Seed IDENTIFIERS only (handles, slugs, presence, notes) — never seed follower
// COUNTS. Hardcoded counts go stale fast and read as "false data"; real values
// are collected live. Any value passed below is intentionally forced to null.
function manual(v: Partial<PlatformMetric> & { platform: PlatformMetric["platform"] }): PlatformMetric {
  return makeMetric({
    ...v,
    value: null,
    source: "manual",
    lastUpdated: null,
  });
}

export function competitorSeed(): Competitor[] {
  return [
    build({
      id: "lombard",
      defillamaSlug: "lombard",
      name: "Lombard",
      segment: "Bitcoin LST (LBTC)",
      tvl: "$700M+",
      token: "$BARD",
      website: "https://www.lombard.finance",
      remark:
        "The standout — a genuinely large, active, community-first operation. Real engagement programs (ambassadors, Kaito Yapper leaderboard, 6,000+ in-person event attendees, referral/Lux campaigns) and institutional backing (Polychain, Franklin Templeton, Binance Labs). The opposite of Veda: heavy, deliberate retail + creator community investment.",
      communityStrength: 92,
      platforms: [
        manual({ platform: "twitter", handle: "@Lombard_Finance", url: xUrl("@Lombard_Finance"), value: 70000, presence: "active", note: "70k+ per their own 1-year recap; likely higher post-token." }),
        manual({ platform: "linkedin", handle: "lombardfinance", url: liUrl("lombardfinance"), presence: "active" }),
        manual({ platform: "discord", handle: "discord.gg/2HG7G69twc", url: "https://discord.com/invite/2HG7G69twc", autoKey: "2HG7G69twc", value: 35000, presence: "active" }),
        manual({ platform: "telegram", presence: "private", note: "Dev/support contact, not a public-subscriber broadcast channel — no follower count." }),
        manual({ platform: "github", handle: "lombard-finance", url: ghUrl("lombard-finance"), autoKey: "lombard-finance", presence: "active" }),
        manual({ platform: "other", handle: "Programs", presence: "active", note: "Ambassador Program · Kaito Yapper leaderboard · 6,000+ event attendees." }),
      ],
    }),

    build({
      id: "superform",
      defillamaSlug: "superform",
      name: "Superform",
      segment: "Yield / user-owned neobank",
      token: "$UP",
      website: "https://www.superform.xyz",
      remark:
        "By far the most retail/community-heavy of the set. Launched $UP token (Feb 2026), positions as a \"user-owned neobank.\" Big numbers, but the token + airdrop/points history means a chunk of the 125k likely came from farming — worth scrutinizing engagement quality vs. raw count (though genuinely more active than Veda).",
      communityStrength: 80,
      platforms: [
        manual({ platform: "twitter", handle: "@superformxyz", url: xUrl("@superformxyz"), value: 125700, presence: "active" }),
        manual({ platform: "linkedin", handle: "superformxyz", url: liUrl("superformxyz"), presence: "active" }),
        manual({ platform: "discord", handle: "discord.gg/superform", url: "https://discord.gg/superform", autoKey: "superform", value: 47600, presence: "active", note: "Guild leveling system, levels 1–60." }),
        manual({ platform: "telegram", presence: "none", note: "Official socials are X + Discord + Mirror only — no Telegram." }),
        manual({ platform: "github", handle: "superform-xyz", url: ghUrl("superform-xyz"), autoKey: "superform-xyz", presence: "active" }),
        manual({ platform: "other", handle: "Mirror / Guild.xyz", presence: "active" }),
      ],
    }),

    build({
      id: "mellow",
      defillamaSlug: "mellow-protocol",
      name: "Mellow",
      segment: "Restaking / vault infra",
      tvl: "~$145M",
      website: "https://mellow.finance",
      remark:
        "Real but modest community for a restaking/vault infra protocol. Follower base looks more organic than Veda's, with genuine smart-follower overlap (Stani, Larry Cermak, Santiago Santos). Communication is product/strategy-led, not retail hype.",
      communityStrength: 46,
      platforms: [
        manual({ platform: "twitter", handle: "@Mellowprotocol", url: xUrl("@Mellowprotocol"), value: 45400, presence: "active", note: "~45.4k per TwitterScore." }),
        manual({ platform: "linkedin", handle: "mellow-protocol", url: liUrl("mellow-protocol"), presence: "active" }),
        manual({ platform: "discord", handle: "discord.gg/mellow", url: "https://discord.gg/mellow", autoKey: "mellow", presence: "active", note: "~17k members." }),
        manual({ platform: "telegram", handle: "t.me/mellowprotocol", url: "https://t.me/mellowprotocol", autoKey: "mellowprotocol", presence: "active" }),
        manual({ platform: "github", handle: "mellow-finance", url: ghUrl("mellow-finance"), autoKey: "mellow-finance", presence: "active" }),
        manual({ platform: "other", handle: "Medium", presence: "active" }),
      ],
    }),

    build({
      id: "midas",
      defillamaSlug: "midas-rwa",
      name: "Midas",
      segment: "RWA tokenization (mTBILL, mBASIS)",
      website: "https://midas.app",
      remark:
        "RWA/tokenization protocol (mTBILL, mBASIS, LYTs). Has a real but small retail-facing community with a gamified Discord (role tiers), sitting alongside an institutional/regulated positioning (EU-registered, BlackRock BUIDL collateral). More community effort than Lagoon, far less than Lombard/Superform. NB: name clash with the Turkish brokerage 'Midas' — this row is Midas RWA only.",
      communityStrength: 34,
      platforms: [
        manual({ platform: "twitter", handle: "@MidasRWA", url: xUrl("@MidasRWA"), presence: "active", tag: "inflated?", note: "~524K on a Jan-2024 account — anomalously high vs older/bigger peers; likely incentive-driven." }),
        manual({ platform: "linkedin", handle: "midasrwa", url: liUrl("midasrwa"), presence: "active" }),
        manual({ platform: "discord", handle: "discord.gg/midasrwa", url: "https://discord.gg/midasrwa", autoKey: "midasrwa", presence: "active", note: "Role tiers — Early Joiner, Holder. Launched Dec 2024." }),
        manual({ platform: "telegram", handle: "t.me/midasrwa", url: "https://t.me/midasrwa", autoKey: "midasrwa", presence: "active", tag: "announcement", reachExcluded: true, note: "'Official Announcements' broadcast channel — 1.37M subs but only ~23% view posts (~1M dormant); base amassed via the Yielder airdrop campaign, then renamed. Overstates community → excluded from reach." }),
        manual({ platform: "other", handle: "YouTube", presence: "active", note: "Tutorials / updates." }),
      ],
    }),

    build({
      id: "upshift",
      defillamaSlug: "upshift",
      name: "Upshift",
      segment: "Vault-as-a-Service (by August Digital)",
      website: "https://upshift.finance",
      remark:
        "\"Vault-as-a-Service\" yield platform spun out of August (Dragonfly-backed). Community is incentive-driven — points seasons with multipliers to farm TVL toward a future token/airdrop. Engagement is real but mercenary; hard to separate genuine community from airdrop farmers.",
      communityStrength: 24,
      platforms: [
        manual({ platform: "twitter", handle: "@upshift_fi", url: xUrl("@upshift_fi"), presence: "active", note: "~2,779 posts; fairly active poster. Exact follower count N/A." }),
        manual({ platform: "linkedin", handle: "upshiftfinance", url: liUrl("upshiftfinance"), presence: "active" }),
        manual({ platform: "discord", handle: "discord.gg/upshift", url: "https://discord.gg/upshift", autoKey: "upshift", presence: "active", note: "discord.gg/upshift (~2.5k)." }),
        manual({ platform: "telegram", presence: "active" }),
        manual({ platform: "other", handle: "Points program", presence: "active", note: "Season 1 & 2 with multipliers." }),
      ],
    }),

    build({
      id: "lagoon",
      defillamaSlug: "lagoon",
      name: "Lagoon",
      segment: "Institutional vault infra (Hopper Labs)",
      tvl: "~$139M",
      website: "https://lagoon.finance",
      remark:
        "Pure B2B/institutional vault infrastructure (120+ vaults, 18 chains). Effectively no retail community by design — they sell to asset managers/curators, not depositors. Closest in posture to Veda: minimal community investment, dev- and partner-driven presence. GitHub is where they live.",
      communityStrength: 12,
      platforms: [
        manual({ platform: "twitter", handle: "@lagoon_finance", url: xUrl("@lagoon_finance"), presence: "active", note: "~669 posts; small account, exact follower count N/A." }),
        manual({ platform: "linkedin", handle: "lagoon-finance", url: liUrl("lagoon-finance"), presence: "active", note: "Company page exists, small." }),
        manual({ platform: "discord", presence: "none" }),
        manual({ platform: "telegram", presence: "none" }),
        manual({ platform: "github", handle: "hopperlabsxyz", url: ghUrl("hopperlabsxyz"), autoKey: "hopperlabsxyz", presence: "active", note: "Very active — this is where they live (Hopper Labs org)." }),
      ],
    }),

    build({
      id: "flux",
      defillamaSlug: "flux-finance",
      name: "Flux Finance",
      segment: "RWA lending (Ondo DAO)",
      website: "https://fluxfinance.com",
      remark:
        "Not really an independent community. Flux is a Compound-V2 fork governed by Ondo DAO ($ONDO holders); its socials are largely dormant and it leans entirely on Ondo's audience. Effectively a sub-product, not a standalone brand — even less of its own community than Veda.",
      communityStrength: 8,
      platforms: [
        manual({ platform: "twitter", handle: "@FluxDeFi", url: xUrl("@FluxDeFi"), presence: "inactive", note: "Low engagement; older posts ~16–20k views were airdrop/governance-driven." }),
        manual({ platform: "linkedin", presence: "external", note: "Rolls up under Ondo." }),
        manual({ platform: "discord", presence: "external", note: "Via Ondo DAO Discord, not its own." }),
        manual({ platform: "telegram", presence: "inactive", note: "Legacy." }),
        manual({ platform: "github", handle: "flux-finance", url: ghUrl("flux-finance"), autoKey: "flux-finance", presence: "active", note: "Compound-v2 fork; contracts repo." }),
        manual({ platform: "other", handle: "Blog", url: "https://blog.fluxfinance.com", presence: "inactive" }),
      ],
    }),

    build({
      id: "veda",
      defillamaSlug: "veda",
      name: "Veda",
      segment: "Yield vault infra (BoringVault)",
      website: "https://veda.tech",
      remark:
        "No active community. Presence comes only from the team's personal accounts on X & LinkedIn (e.g. Kate Irwin, Sunand Raghupathi). They basically don't invest in retail perception / community. Follower/engagement ratio on the brand account suggests inflated/bought numbers — a façade count, not an active base.",
      communityStrength: 7,
      platforms: [
        manual({ platform: "twitter", handle: "@veda_labs", url: xUrl("@veda_labs"), value: 33300, presence: "active", note: "33.3k followers but follower/engagement ratio indicates inflated/bought numbers — a façade." }),
        manual({ platform: "linkedin", value: 1000, presence: "active", note: "Protocol update announcements + exec quotes. Page slug unconfirmed (candidate: company/veda-tech)." }),
        manual({ platform: "discord", presence: "inactive", note: "Server sunsetted Feb 2026." }),
        manual({ platform: "telegram", presence: "inactive", note: "Channel sunsetted (date N/A)." }),
        manual({ platform: "github", handle: "Veda-Labs", url: ghUrl("Veda-Labs"), autoKey: "Veda-Labs", presence: "active", note: "Tech = BoringVault." }),
      ],
    }),
  ];
}

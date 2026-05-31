import { type Competitor, type PlatformMetric, makeMetric } from "./types";

// Initial competitor set — encoded from Aymen's manual community analysis
// (2026-05-31). Unknown / unverified values are `null` (rendered as "N/A").
// `autoKey` is only pre-filled where the identifier is confidently known;
// everything else is one paste away from auto-collection in the editor.

const SEED_DATE = "2026-05-31T00:00:00.000Z";

function xUrl(handle: string | null): string | null {
  if (!handle) return null;
  return `https://x.com/${handle.replace(/^@/, "")}`;
}

interface SeedInput {
  id: string;
  name: string;
  isSelf?: boolean;
  segment: string;
  tvl?: string | null;
  token?: string | null;
  website?: string | null;
  remark: string;
  communityStrength: number;
  platforms: PlatformMetric[];
}

function build(input: SeedInput): Competitor {
  return {
    id: input.id,
    name: input.name,
    isSelf: input.isSelf ?? false,
    segment: input.segment,
    tvl: input.tvl ?? null,
    token: input.token ?? null,
    website: input.website ?? null,
    remark: input.remark,
    communityStrength: input.communityStrength,
    platforms: input.platforms,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  };
}

// Mark a seeded value as manually-sourced as of the analysis date.
function manual(v: Partial<PlatformMetric> & { platform: PlatformMetric["platform"] }): PlatformMetric {
  return makeMetric({
    ...v,
    source: "manual",
    lastUpdated: v.value != null ? SEED_DATE : null,
  });
}

export function competitorSeed(): Competitor[] {
  return [
    build({
      id: "makina",
      name: "Makina",
      isSelf: true,
      segment: "Vault infra / curated strategies",
      website: "https://makina.finance",
      remark:
        "Us — the reference row. Fill in our own community numbers here to benchmark against the competitive set.",
      communityStrength: 0,
      platforms: [
        manual({ platform: "twitter", presence: "unknown" }),
        manual({ platform: "linkedin", presence: "unknown" }),
        manual({ platform: "discord", presence: "unknown" }),
        manual({ platform: "telegram", presence: "unknown" }),
      ],
    }),

    build({
      id: "lombard",
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
        manual({ platform: "linkedin", handle: "lombardfinance", url: "https://www.linkedin.com/company/lombardfinance", presence: "active" }),
        manual({ platform: "discord", value: 35000, presence: "active" }),
        manual({ platform: "telegram", presence: "active" }),
        manual({ platform: "other", handle: "Programs", presence: "active", note: "Ambassador Program · Kaito Yapper leaderboard · 6,000+ event attendees." }),
      ],
    }),

    build({
      id: "superform",
      name: "Superform",
      segment: "Yield / user-owned neobank",
      token: "$UP",
      website: "https://www.superform.xyz",
      remark:
        "By far the most retail/community-heavy of the set. Launched $UP token (Feb 2026), positions as a \"user-owned neobank.\" Big numbers, but the token + airdrop/points history means a chunk of the 125k likely came from farming — worth scrutinizing engagement quality vs. raw count (though genuinely more active than Veda).",
      communityStrength: 80,
      platforms: [
        manual({ platform: "twitter", handle: "@superformxyz", url: xUrl("@superformxyz"), value: 125700, presence: "active" }),
        manual({ platform: "linkedin", presence: "unknown", note: "Superform Labs; not a major channel." }),
        manual({ platform: "discord", value: 47600, presence: "active", note: "Guild leveling system, levels 1–60." }),
        manual({ platform: "telegram", presence: "active" }),
        manual({ platform: "other", handle: "Mirror / Guild.xyz / Facebook", presence: "active" }),
      ],
    }),

    build({
      id: "mellow",
      name: "Mellow",
      segment: "Restaking / vault infra",
      tvl: "~$145M",
      website: "https://mellow.finance",
      remark:
        "Real but modest community for a restaking/vault infra protocol. Follower base looks more organic than Veda's, with genuine smart-follower overlap (Stani, Larry Cermak, Santiago Santos). Communication is product/strategy-led, not retail hype.",
      communityStrength: 46,
      platforms: [
        manual({ platform: "twitter", handle: "@Mellowprotocol", url: xUrl("@Mellowprotocol"), value: 45400, presence: "active", note: "~45.4k per TwitterScore." }),
        manual({ platform: "linkedin", presence: "none", note: "No prominent company page found." }),
        manual({ platform: "discord", presence: "active" }),
        manual({ platform: "telegram", presence: "active" }),
        manual({ platform: "github", presence: "active" }),
        manual({ platform: "other", handle: "Medium", presence: "active" }),
      ],
    }),

    build({
      id: "midas",
      name: "Midas",
      segment: "RWA tokenization (mTBILL, mBASIS)",
      website: "https://midas.app",
      remark:
        "RWA/tokenization protocol (mTBILL, mBASIS, LYTs). Has a real but small retail-facing community with a gamified Discord (role tiers), sitting alongside an institutional/regulated positioning (EU-registered, BlackRock BUIDL collateral). More community effort than Lagoon, far less than Lombard/Superform. NB: name clash with the Turkish brokerage 'Midas' — this row is Midas RWA only.",
      communityStrength: 34,
      platforms: [
        manual({ platform: "twitter", handle: "@MidasRWA", url: xUrl("@MidasRWA"), presence: "active", note: "~1,333 posts; exact follower count N/A." }),
        manual({ platform: "linkedin", handle: "midasrwa", url: "https://www.linkedin.com/company/midasrwa", presence: "active" }),
        manual({ platform: "discord", handle: "discord.gg/midasrwa", url: "https://discord.gg/midasrwa", autoKey: "midasrwa", presence: "active", note: "Role tiers — Early Joiner, Holder." }),
        manual({ platform: "telegram", presence: "active" }),
        manual({ platform: "other", handle: "YouTube", presence: "active", note: "Tutorials / updates." }),
      ],
    }),

    build({
      id: "upshift",
      name: "Upshift",
      segment: "Vault-as-a-Service (by August Digital)",
      website: "https://upshift.finance",
      remark:
        "\"Vault-as-a-Service\" yield platform spun out of August (Dragonfly-backed). Community is incentive-driven — points seasons with multipliers to farm TVL toward a future token/airdrop. Engagement is real but mercenary; hard to separate genuine community from airdrop farmers.",
      communityStrength: 24,
      platforms: [
        manual({ platform: "twitter", handle: "@upshift_fi", url: xUrl("@upshift_fi"), presence: "active", note: "~2,779 posts; fairly active poster. Exact follower count N/A." }),
        manual({ platform: "linkedin", presence: "external", note: "August Digital is the corporate entity." }),
        manual({ platform: "discord", presence: "active" }),
        manual({ platform: "telegram", presence: "active" }),
        manual({ platform: "other", handle: "Points program", presence: "active", note: "Season 1 & 2 with multipliers." }),
      ],
    }),

    build({
      id: "lagoon",
      name: "Lagoon",
      segment: "Institutional vault infra (Hopper Labs)",
      tvl: "~$139M",
      website: "https://lagoon.finance",
      remark:
        "Pure B2B/institutional vault infrastructure (120+ vaults, 18 chains). Effectively no retail community by design — they sell to asset managers/curators, not depositors. Closest in posture to Veda: minimal community investment, dev- and partner-driven presence. GitHub is where they live.",
      communityStrength: 12,
      platforms: [
        manual({ platform: "twitter", handle: "@lagoon_finance", url: xUrl("@lagoon_finance"), presence: "active", note: "~669 posts; small account, exact follower count N/A." }),
        manual({ platform: "linkedin", presence: "active", note: "Company page exists, small." }),
        manual({ platform: "discord", presence: "none" }),
        manual({ platform: "telegram", presence: "none" }),
        manual({ platform: "github", presence: "active", note: "Very active — this is where they live." }),
      ],
    }),

    build({
      id: "flux",
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
        manual({ platform: "other", handle: "Blog", url: "https://blog.fluxfinance.com", presence: "inactive" }),
      ],
    }),

    build({
      id: "veda",
      name: "Veda",
      segment: "Yield vault infra",
      website: "https://veda.tech",
      remark:
        "No active community. Presence comes only from the team's personal accounts on X & LinkedIn (e.g. Kate Irwin, Sunand Raghupathi). They basically don't invest in retail perception / community. Follower/engagement ratio on the brand account suggests inflated/bought numbers — a façade count, not an active base.",
      communityStrength: 7,
      platforms: [
        manual({ platform: "twitter", value: 33300, presence: "active", note: "33.3k followers but follower/engagement ratio indicates inflated/bought numbers — a façade." }),
        manual({ platform: "linkedin", value: 1000, presence: "active", note: "Used for protocol update announcements + exec quotes." }),
        manual({ platform: "discord", presence: "inactive", note: "Server sunsetted Feb 2026." }),
        manual({ platform: "telegram", presence: "inactive", note: "Channel sunsetted (date N/A)." }),
      ],
    }),
  ];
}

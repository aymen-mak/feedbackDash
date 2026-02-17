export type FeedbackType = "praise" | "issue" | "suggestion" | "question";
export type FeedbackStatus = "new" | "reviewed" | "addressed" | "dismissed";
export type VaultId = "DBIT" | "DETH" | "DUSD";

export interface FeedbackItem {
  id: string;
  user: {
    address: string;
    displayName: string;
    ethos: number;
    avatar: string;
  };
  vault: VaultId;
  type: FeedbackType;
  message: string;
  quickAction?: string;
  timestamp: Date;
  status: FeedbackStatus;
  upvotes: number;
}

export interface VaultStats {
  id: VaultId;
  apy: number;
  tvl: string;
  feedbackCount: number;
  sentiment: number; // -1 to 1
  trend: number[]; // last 7 days sentiment
}

export const QUICK_ACTIONS = [
  { id: "great-yields", emoji: "🔥", label: "Great yields" },
  { id: "smooth-ux", emoji: "✨", label: "Smooth UX" },
  { id: "need-more-vaults", emoji: "🏗️", label: "Need more vaults" },
  { id: "gas-too-high", emoji: "⛽", label: "Gas too high" },
  { id: "love-strategy", emoji: "🧠", label: "Love the strategy" },
  { id: "withdrawals-slow", emoji: "🐌", label: "Withdrawals slow" },
  { id: "docs-unclear", emoji: "📖", label: "Docs unclear" },
  { id: "feels-safe", emoji: "🛡️", label: "Feels safe" },
] as const;

export const VAULT_STATS: VaultStats[] = [
  {
    id: "DBIT",
    apy: 12.1,
    tvl: "$4.2M",
    feedbackCount: 142,
    sentiment: 0.72,
    trend: [0.6, 0.65, 0.7, 0.68, 0.71, 0.74, 0.72],
  },
  {
    id: "DETH",
    apy: 18.4,
    tvl: "$8.7M",
    feedbackCount: 238,
    sentiment: 0.85,
    trend: [0.7, 0.75, 0.78, 0.82, 0.8, 0.83, 0.85],
  },
  {
    id: "DUSD",
    apy: 24.6,
    tvl: "$12.1M",
    feedbackCount: 391,
    sentiment: 0.64,
    trend: [0.8, 0.75, 0.7, 0.68, 0.65, 0.63, 0.64],
  },
];

const MOCK_USERS = [
  { address: "0x1a2b...3c4d", displayName: "vitalik.eth", ethos: 2450, avatar: "V" },
  { address: "0x5e6f...7g8h", displayName: "defi_whale", ethos: 1820, avatar: "D" },
  { address: "0x9i0j...1k2l", displayName: "0x9i0j...1k2l", ethos: 340, avatar: "0" },
  { address: "0x3m4n...5o6p", displayName: "yield_farmer", ethos: 890, avatar: "Y" },
  { address: "0x7q8r...9s0t", displayName: "makina_og", ethos: 3100, avatar: "M" },
  { address: "0xab12...cd34", displayName: "cryptonaut", ethos: 1560, avatar: "C" },
  { address: "0xef56...gh78", displayName: "ser_degen", ethos: 720, avatar: "S" },
  { address: "0xij90...kl12", displayName: "stable_andy", ethos: 2100, avatar: "A" },
];

export const MOCK_FEEDBACK: FeedbackItem[] = [
  {
    id: "fb-001",
    user: MOCK_USERS[0],
    vault: "DUSD",
    type: "praise",
    message: "DUSD vault has been consistently hitting 24%+ APY. Best stable yield in DeFi right now.",
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    status: "new",
    upvotes: 24,
  },
  {
    id: "fb-002",
    user: MOCK_USERS[1],
    vault: "DETH",
    type: "suggestion",
    message: "Would love to see a leveraged ETH vault option. Maybe 2x or 3x with auto-deleverage.",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    status: "reviewed",
    upvotes: 18,
  },
  {
    id: "fb-003",
    user: MOCK_USERS[2],
    vault: "DBIT",
    type: "issue",
    message: "Withdrawal from DBIT took 45 minutes yesterday. Is that normal?",
    timestamp: new Date(Date.now() - 1000 * 60 * 32),
    status: "addressed",
    upvotes: 7,
  },
  {
    id: "fb-004",
    user: MOCK_USERS[3],
    vault: "DUSD",
    type: "praise",
    quickAction: "great-yields",
    message: "",
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    status: "new",
    upvotes: 12,
  },
  {
    id: "fb-005",
    user: MOCK_USERS[4],
    vault: "DETH",
    type: "praise",
    quickAction: "love-strategy",
    message: "",
    timestamp: new Date(Date.now() - 1000 * 60 * 58),
    status: "new",
    upvotes: 31,
  },
  {
    id: "fb-006",
    user: MOCK_USERS[5],
    vault: "DBIT",
    type: "suggestion",
    message: "The risk metrics on the vault page could use more detail. Show IL estimates, max drawdown, etc.",
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    status: "new",
    upvotes: 15,
  },
  {
    id: "fb-007",
    user: MOCK_USERS[6],
    vault: "DUSD",
    type: "issue",
    quickAction: "gas-too-high",
    message: "",
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    status: "reviewed",
    upvotes: 9,
  },
  {
    id: "fb-008",
    user: MOCK_USERS[7],
    vault: "DETH",
    type: "praise",
    quickAction: "feels-safe",
    message: "The audit report and insurance coverage gives me confidence. Deposited 50 ETH.",
    timestamp: new Date(Date.now() - 1000 * 60 * 180),
    status: "new",
    upvotes: 42,
  },
  {
    id: "fb-009",
    user: MOCK_USERS[0],
    vault: "DBIT",
    type: "question",
    message: "What's the rebalancing frequency for DBIT? Can't find it in the docs.",
    timestamp: new Date(Date.now() - 1000 * 60 * 240),
    status: "addressed",
    upvotes: 5,
  },
  {
    id: "fb-010",
    user: MOCK_USERS[3],
    vault: "DETH",
    type: "suggestion",
    quickAction: "smooth-ux",
    message: "Deposit flow is super clean. Would be perfect with a gas estimate before signing.",
    timestamp: new Date(Date.now() - 1000 * 60 * 300),
    status: "reviewed",
    upvotes: 20,
  },
];

export const SENTIMENT_OVER_TIME = [
  { date: "Feb 10", positive: 65, neutral: 25, negative: 10 },
  { date: "Feb 11", positive: 70, neutral: 20, negative: 10 },
  { date: "Feb 12", positive: 62, neutral: 28, negative: 10 },
  { date: "Feb 13", positive: 75, neutral: 18, negative: 7 },
  { date: "Feb 14", positive: 68, neutral: 22, negative: 10 },
  { date: "Feb 15", positive: 72, neutral: 20, negative: 8 },
  { date: "Feb 16", positive: 78, neutral: 16, negative: 6 },
  { date: "Feb 17", positive: 74, neutral: 19, negative: 7 },
];

export const FEEDBACK_BY_TYPE = [
  { name: "Praise", value: 45, color: "#22c55e" },
  { name: "Suggestion", value: 28, color: "#3b82f6" },
  { name: "Issue", value: 17, color: "#ef4444" },
  { name: "Question", value: 10, color: "#e8e034" },
];

export const TOP_QUICK_ACTIONS = [
  { action: "Great yields", count: 89 },
  { action: "Love the strategy", count: 67 },
  { action: "Feels safe", count: 54 },
  { action: "Smooth UX", count: 48 },
  { action: "Gas too high", count: 31 },
  { action: "Need more vaults", count: 24 },
];

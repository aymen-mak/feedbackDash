export type FeedbackType = "praise" | "issue" | "suggestion" | "question";
export type FeedbackStatus = "new" | "reviewed" | "addressed" | "dismissed";
export type CategoryId = "Product" | "UX" | "Support";

export interface FeedbackItem {
  id: string;
  user: {
    displayName: string;
    avatar: string;
  };
  category: CategoryId;
  type: FeedbackType;
  message: string;
  quickAction?: string;
  timestamp: Date;
  status: FeedbackStatus;
  upvotes: number;
}

export interface CategoryStats {
  id: CategoryId;
  submissions: number;
  openIssues: number;
  satisfaction: number; // 0 to 1
}

export const QUICK_ACTIONS = [
  { id: "love-it", emoji: "🎉", label: "Love it!" },
  { id: "easy-to-use", emoji: "✨", label: "Easy to use" },
  { id: "feature-request", emoji: "💡", label: "Feature request" },
  { id: "bug-report", emoji: "🐛", label: "Bug report" },
  { id: "great-support", emoji: "👏", label: "Great support" },
  { id: "confusing", emoji: "😕", label: "Confusing" },
  { id: "too-slow", emoji: "🐌", label: "Too slow" },
  { id: "needs-improvement", emoji: "🔧", label: "Needs improvement" },
] as const;

export const CATEGORY_STATS: CategoryStats[] = [
  {
    id: "Product",
    submissions: 312,
    openIssues: 18,
    satisfaction: 0.82,
  },
  {
    id: "UX",
    submissions: 245,
    openIssues: 9,
    satisfaction: 0.76,
  },
  {
    id: "Support",
    submissions: 214,
    openIssues: 5,
    satisfaction: 0.91,
  },
];

const MOCK_USERS = [
  { displayName: "Alex M.", avatar: "A" },
  { displayName: "Jordan K.", avatar: "J" },
  { displayName: "Sam R.", avatar: "S" },
  { displayName: "Casey L.", avatar: "C" },
  { displayName: "Morgan T.", avatar: "M" },
  { displayName: "Riley P.", avatar: "R" },
  { displayName: "Taylor D.", avatar: "T" },
  { displayName: "Quinn W.", avatar: "Q" },
];

export const MOCK_FEEDBACK: FeedbackItem[] = [
  {
    id: "fb-001",
    user: MOCK_USERS[0],
    category: "Product",
    type: "praise",
    message: "The new dashboard is really clean. Everything I need is right there at a glance.",
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    status: "new",
    upvotes: 24,
  },
  {
    id: "fb-002",
    user: MOCK_USERS[1],
    category: "UX",
    type: "suggestion",
    message: "Would love a dark/light mode toggle. The dark theme is great but sometimes I work in bright spaces.",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    status: "reviewed",
    upvotes: 18,
  },
  {
    id: "fb-003",
    user: MOCK_USERS[2],
    category: "Support",
    type: "issue",
    message: "Couldn't find where to reset my notification preferences. Had to dig through three menus.",
    timestamp: new Date(Date.now() - 1000 * 60 * 32),
    status: "addressed",
    upvotes: 7,
  },
  {
    id: "fb-004",
    user: MOCK_USERS[3],
    category: "Product",
    type: "praise",
    quickAction: "love-it",
    message: "",
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    status: "new",
    upvotes: 12,
  },
  {
    id: "fb-005",
    user: MOCK_USERS[4],
    category: "UX",
    type: "praise",
    quickAction: "easy-to-use",
    message: "",
    timestamp: new Date(Date.now() - 1000 * 60 * 58),
    status: "new",
    upvotes: 31,
  },
  {
    id: "fb-006",
    user: MOCK_USERS[5],
    category: "Product",
    type: "suggestion",
    message: "It would help to see a priority label on each feedback item so the team knows what to tackle first.",
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    status: "new",
    upvotes: 15,
  },
  {
    id: "fb-007",
    user: MOCK_USERS[6],
    category: "UX",
    type: "issue",
    quickAction: "too-slow",
    message: "",
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    status: "reviewed",
    upvotes: 9,
  },
  {
    id: "fb-008",
    user: MOCK_USERS[7],
    category: "Support",
    type: "praise",
    quickAction: "great-support",
    message: "Got a reply within 10 minutes. Super helpful and friendly. Keep it up!",
    timestamp: new Date(Date.now() - 1000 * 60 * 180),
    status: "new",
    upvotes: 42,
  },
  {
    id: "fb-009",
    user: MOCK_USERS[0],
    category: "Product",
    type: "question",
    message: "Is there a way to export my feedback history? I'd like to keep a copy for my records.",
    timestamp: new Date(Date.now() - 1000 * 60 * 240),
    status: "addressed",
    upvotes: 5,
  },
  {
    id: "fb-010",
    user: MOCK_USERS[3],
    category: "UX",
    type: "suggestion",
    quickAction: "feature-request",
    message: "A mobile app or at least a responsive version would make it much easier to submit feedback on the go.",
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
  { name: "Question", value: 10, color: "#C4B5FD" },
];

export const TOP_QUICK_ACTIONS = [
  { action: "Love it!", count: 89 },
  { action: "Easy to use", count: 67 },
  { action: "Feature request", count: 54 },
  { action: "Great support", count: 48 },
  { action: "Too slow", count: 31 },
  { action: "Confusing", count: 24 },
];

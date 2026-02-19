import fs from "fs";
import path from "path";

// ── Types ──
export type FeedbackType = "praise" | "issue" | "suggestion" | "question";
export type FeedbackStatus = "new" | "reviewed" | "addressed" | "dismissed";
export type CategoryId = "Product" | "UX" | "Support";
export type Priority = "none" | "low" | "medium" | "high";

export interface Reply {
  id: string;
  message: string;
  createdAt: string;
}

export interface StoredFeedback {
  id: string;
  userName: string;
  userAvatar: string;
  category: CategoryId;
  type: FeedbackType;
  message: string;
  quickAction: string | null;
  anonymous: boolean;
  status: FeedbackStatus;
  priority: Priority;
  starred: boolean;
  escalated: boolean;
  dismissed: boolean;
  archived: boolean;
  deletedAt: string | null;
  upvotes: number;
  upvotedBy: string[];
  tags: string[];
  replies: Reply[];
  createdAt: string;
}

interface Store {
  feedback: StoredFeedback[];
}

// ── File I/O (works locally + on Vercel) ──

// In-memory fallback for serverless environments where /tmp isn't shared
let memoryStore: Store | null = null;

function resolveDataFile(): string {
  // 1. Try project-local data/ directory (works in local dev)
  const local = path.join(process.cwd(), "data", "feedback.json");
  const localDir = path.dirname(local);
  try {
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    // Test writability by touching a temp file
    const testFile = path.join(localDir, ".write-test");
    fs.writeFileSync(testFile, "");
    fs.unlinkSync(testFile);
    return local;
  } catch {
    // Not writable (e.g. Vercel read-only filesystem)
  }

  // 2. Fall back to /tmp (writable on Vercel serverless)
  return path.join("/tmp", "feedback.json");
}

const DATA_FILE = resolveDataFile();

function read(): Store {
  // Try file system
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      memoryStore = data;
      return data;
    }
  } catch {
    // File read failed, fall through
  }

  // Try in-memory cache
  if (memoryStore) return memoryStore;

  // Seed fresh data
  const store: Store = { feedback: seed() };
  // Try to persist to file
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch {
    // File write failed, keep in memory only
  }
  memoryStore = store;
  return store;
}

function write(store: Store) {
  memoryStore = store;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch {
    // File write failed (read-only fs), data lives in memory only
  }
}

function uid(): string {
  return "fb-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Seed data (30 items over 15 days) ──
export function seed(): StoredFeedback[] {
  const now = Date.now();
  const H = 3600000;
  const D = 86400000;

  type Row = [string, string, CategoryId, FeedbackType, string, string | null, number, number];
  const raw: Row[] = [
    ["Alex M.", "A", "Product", "praise", "The new dashboard is really clean. Everything I need is right there at a glance.", null, 24, 0.5],
    ["Jordan K.", "J", "UX", "suggestion", "Would love a dark/light mode toggle. The dark theme is great but sometimes I work in bright spaces.", null, 18, 2],
    ["Sam R.", "S", "Support", "issue", "Couldn't find where to reset my notification preferences. Had to dig through three menus.", null, 7, 6],
    ["Casey L.", "C", "Product", "praise", "", "love-it", 12, 12],
    ["Morgan T.", "M", "UX", "praise", "", "easy-to-use", 31, 18],
    ["Riley P.", "R", "Product", "suggestion", "It would help to see a priority label on each feedback item so the team knows what to tackle first.", null, 15, 26],
    ["Taylor D.", "T", "UX", "issue", "", "too-slow", 9, 36],
    ["Quinn W.", "Q", "Support", "praise", "Got a reply within 10 minutes. Super helpful and friendly. Keep it up!", "great-support", 42, 48],
    ["Alex M.", "A", "Product", "question", "Is there a way to export my feedback history? I'd like to keep a copy for my records.", null, 5, 60],
    ["Casey L.", "C", "UX", "suggestion", "A mobile app or at least a responsive version would make it much easier to submit feedback on the go.", "feature-request", 20, 72],
    ["Jordan K.", "J", "Product", "praise", "Love the analytics page. The charts are clear and useful.", null, 16, 96],
    ["Sam R.", "S", "UX", "issue", "The text is too small on some cards. Hard to read on my laptop.", null, 11, 108],
    ["Morgan T.", "M", "Support", "suggestion", "A live chat option would be nice for urgent issues.", null, 14, 120],
    ["Riley P.", "R", "Product", "suggestion", "Add keyboard shortcuts for power users.", null, 22, 144],
    ["Taylor D.", "T", "UX", "praise", "The onboarding flow was seamless, got up and running in 2 minutes.", null, 28, 156],
    ["Quinn W.", "Q", "Product", "issue", "Charts don't render correctly on Safari. The bars overlap.", null, 8, 168],
    ["Alex M.", "A", "Support", "praise", "Your documentation is excellent. Found my answer without submitting a ticket.", null, 19, 192],
    ["Casey L.", "C", "UX", "suggestion", "Drag-and-drop reordering for dashboard widgets would be amazing.", "feature-request", 17, 204],
    ["Jordan K.", "J", "Product", "question", "Can we get webhook notifications for new feedback?", null, 6, 216],
    ["Sam R.", "S", "Support", "issue", "My support ticket from last week was never answered.", null, 3, 240],
    ["Morgan T.", "M", "Product", "praise", "The filtering system is powerful. Exactly what I needed.", null, 21, 252],
    ["Riley P.", "R", "UX", "issue", "Navigation gets confusing when there are too many items.", "confusing", 10, 264],
    ["Taylor D.", "T", "Support", "suggestion", "Add a FAQ section so common questions don't need support tickets.", null, 13, 288],
    ["Quinn W.", "Q", "Product", "praise", "Export to CSV works perfectly. Saved me hours of manual work.", null, 26, 300],
    ["Alex M.", "A", "UX", "suggestion", "Would love customizable color themes beyond dark and light.", null, 15, 312],
    ["Casey L.", "C", "Support", "praise", "The team is super responsive. Best support experience I've had.", "great-support", 33, 324],
    ["Jordan K.", "J", "Product", "issue", "The page takes a while to load when there's a lot of data.", "too-slow", 7, 336],
    ["Sam R.", "S", "UX", "praise", "Love the new card layout. Much better than the old table view.", null, 18, 348],
    ["Morgan T.", "M", "Product", "suggestion", "Add the ability to attach screenshots to feedback.", "feature-request", 25, 360],
    ["Riley P.", "R", "Support", "question", "How do I change my email notification frequency?", null, 4, 372],
  ];

  return raw.map(([userName, userAvatar, category, type, message, quickAction, upvotes, hoursAgo], i) => ({
    id: `fb-seed-${String(i).padStart(3, "0")}`,
    userName,
    userAvatar,
    category,
    type,
    message,
    quickAction,
    anonymous: false,
    status: (i < 5 ? "new" : i < 15 ? "reviewed" : "addressed") as FeedbackStatus,
    priority: (i === 2 || i === 6 ? "high" : i === 5 || i === 15 ? "medium" : i === 11 ? "low" : "none") as Priority,
    starred: false,
    escalated: i === 2 || i === 6 || i === 15 || i === 19,
    dismissed: false,
    archived: false,
    deletedAt: null,
    upvotes,
    upvotedBy: [],
    tags: [],
    replies: [],
    createdAt: new Date(now - hoursAgo * H).toISOString(),
  }));
}

// ── CRUD Operations ──

/** Active items: not archived, not soft-deleted */
export function getAllFeedback(): StoredFeedback[] {
  return read().feedback
    .filter((f) => !f.archived && !f.deletedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Archived items (not deleted) */
export function getArchivedFeedback(): StoredFeedback[] {
  return read().feedback
    .filter((f) => f.archived && !f.deletedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Soft-deleted items within the last 30 days */
export function getTrashFeedback(): StoredFeedback[] {
  const cutoff = Date.now() - 30 * 86400000;
  return read().feedback
    .filter((f) => f.deletedAt && new Date(f.deletedAt).getTime() > cutoff)
    .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
}

/** Permanently remove items deleted more than 30 days ago */
export function cleanupTrash(): number {
  const store = read();
  const cutoff = Date.now() - 30 * 86400000;
  const before = store.feedback.length;
  store.feedback = store.feedback.filter(
    (f) => !f.deletedAt || new Date(f.deletedAt).getTime() > cutoff
  );
  write(store);
  return before - store.feedback.length;
}

export function getFeedbackById(id: string): StoredFeedback | null {
  return read().feedback.find((f) => f.id === id) ?? null;
}

export function createFeedback(data: {
  userName: string;
  userAvatar: string;
  category: CategoryId;
  type: FeedbackType;
  message: string;
  quickAction: string | null;
  anonymous: boolean;
}): StoredFeedback {
  const store = read();
  const item: StoredFeedback = {
    id: uid(),
    ...data,
    status: "new",
    priority: "none",
    starred: false,
    escalated: false,
    dismissed: false,
    archived: false,
    deletedAt: null,
    upvotes: 0,
    upvotedBy: [],
    tags: [],
    replies: [],
    createdAt: new Date().toISOString(),
  };
  store.feedback.push(item);
  write(store);
  return item;
}

export function updateFeedback(
  id: string,
  updates: Partial<Pick<StoredFeedback, "status" | "priority" | "starred" | "escalated" | "dismissed" | "archived" | "deletedAt" | "tags">>
): StoredFeedback | null {
  const store = read();
  const idx = store.feedback.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  store.feedback[idx] = { ...store.feedback[idx], ...updates };
  write(store);
  return store.feedback[idx];
}

export function toggleUpvote(id: string, sessionId: string): StoredFeedback | null {
  const store = read();
  const idx = store.feedback.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  const item = store.feedback[idx];
  if (item.upvotedBy.includes(sessionId)) {
    item.upvotedBy = item.upvotedBy.filter((s) => s !== sessionId);
    item.upvotes = Math.max(0, item.upvotes - 1);
  } else {
    item.upvotedBy.push(sessionId);
    item.upvotes += 1;
  }
  write(store);
  return item;
}

export function addReply(id: string, message: string): StoredFeedback | null {
  const store = read();
  const idx = store.feedback.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  store.feedback[idx].replies.push({
    id: "re-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    message,
    createdAt: new Date().toISOString(),
  });
  write(store);
  return store.feedback[idx];
}

// ── Stats ──

export interface DailyMetric {
  date: string;
  submissions: number;
  sentiment: number;
  issues: number;
  resolved: number;
}

export function getStats() {
  const active = read().feedback.filter((f) => !f.archived && !f.deletedAt);
  const total = active.length;
  const notDismissed = active.filter((f) => !f.dismissed);

  // Type counts
  const byType = {
    praise: notDismissed.filter((f) => f.type === "praise").length,
    suggestion: notDismissed.filter((f) => f.type === "suggestion").length,
    issue: notDismissed.filter((f) => f.type === "issue").length,
    question: notDismissed.filter((f) => f.type === "question").length,
  };
  const typeTotal = byType.praise + byType.suggestion + byType.issue + byType.question;

  // Sentiment (praise = positive, suggestion/question = neutral, issue = needs attention)
  const positive = typeTotal > 0 ? Math.round((byType.praise / typeTotal) * 100) : 0;
  const neutral = typeTotal > 0 ? Math.round(((byType.suggestion + byType.question) / typeTotal) * 100) : 0;
  const needsAttention = typeTotal > 0 ? 100 - positive - neutral : 0;

  // Category stats
  const categories: CategoryId[] = ["Product", "UX", "Support"];
  const categoryStats = categories.map((cat) => {
    const items = notDismissed.filter((f) => f.category === cat);
    const openIssues = items.filter((f) => f.type === "issue" && f.status !== "addressed").length;
    const praised = items.filter((f) => f.type === "praise").length;
    return {
      id: cat,
      submissions: items.length,
      openIssues,
      satisfaction: items.length > 0 ? Math.round((praised / items.length) * 100) / 100 : 0,
    };
  });

  // Unique contributors
  const contributors = new Set(notDismissed.map((f) => f.userName)).size;

  // Quick action tallies
  const actionCounts: Record<string, number> = {};
  for (const f of notDismissed) {
    if (f.quickAction) {
      actionCounts[f.quickAction] = (actionCounts[f.quickAction] || 0) + 1;
    }
  }

  const quickActionLabels: Record<string, { emoji: string; label: string }> = {
    "love-it": { emoji: "🎉", label: "Love it!" },
    "easy-to-use": { emoji: "✨", label: "Easy to use" },
    "feature-request": { emoji: "💡", label: "Feature request" },
    "bug-report": { emoji: "🐛", label: "Bug report" },
    "great-support": { emoji: "👏", label: "Great support" },
    "confusing": { emoji: "😕", label: "Confusing" },
    "too-slow": { emoji: "🐌", label: "Too slow" },
    "needs-improvement": { emoji: "🔧", label: "Needs improvement" },
  };

  const reactionTotals = Object.entries(actionCounts)
    .map(([id, count]) => ({
      id,
      emoji: quickActionLabels[id]?.emoji ?? "❓",
      label: quickActionLabels[id]?.label ?? id,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const reactionTotal = reactionTotals.reduce((s, r) => s + r.count, 0);
  const reactionTotalsWithPct = reactionTotals.map((r) => ({
    ...r,
    pct: reactionTotal > 0 ? Math.round((r.count / reactionTotal) * 100) : 0,
  }));

  // Trending topics — simple keyword extraction from messages
  const stopWords = new Set(["the", "a", "an", "is", "was", "are", "to", "it", "i", "my", "in", "of", "for", "and", "on", "that", "this", "be", "have", "has", "had", "but", "or", "so", "if", "at", "by", "from", "with", "would", "could", "when", "there"]);
  const wordCounts: Record<string, { count: number; categories: Set<CategoryId> }> = {};
  for (const f of notDismissed) {
    if (!f.message) continue;
    const words = f.message.toLowerCase().replace(/[^a-z\s-]/g, "").split(/\s+/);
    // Extract 2-word phrases and meaningful single words
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w.length < 4 || stopWords.has(w)) continue;
      if (!wordCounts[w]) wordCounts[w] = { count: 0, categories: new Set() };
      wordCounts[w].count++;
      wordCounts[w].categories.add(f.category);
    }
  }
  const trendingTopics = Object.entries(wordCounts)
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([word, data], i) => ({
      topic: word.charAt(0).toUpperCase() + word.slice(1),
      mentions: data.count,
      trend: i === 0 ? "up" as const : i < 3 ? "steady" as const : "new" as const,
      category: [...data.categories][0],
    }));

  // Feedback by type (for dashboard breakdown)
  const feedbackByType = [
    { name: "Praise", value: byType.praise, pct: typeTotal > 0 ? Math.round((byType.praise / typeTotal) * 100) : 0, color: "#22c55e" },
    { name: "Suggestion", value: byType.suggestion, pct: typeTotal > 0 ? Math.round((byType.suggestion / typeTotal) * 100) : 0, color: "#3b82f6" },
    { name: "Issue", value: byType.issue, pct: typeTotal > 0 ? Math.round((byType.issue / typeTotal) * 100) : 0, color: "#ef4444" },
    { name: "Question", value: byType.question, pct: typeTotal > 0 ? Math.round((byType.question / typeTotal) * 100) : 0, color: "#C4B5FD" },
  ];

  // Daily metrics for chart (last 15 days)
  const dailyMetrics: DailyMetric[] = [];
  for (let d = 14; d >= 0; d--) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - d);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayItems = notDismissed.filter((f) => {
      const t = new Date(f.createdAt).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    });

    const dayTotal = dayItems.length;
    const dayPraise = dayItems.filter((f) => f.type === "praise").length;
    const dayIssues = dayItems.filter((f) => f.type === "issue").length;
    const dayResolved = dayItems.filter((f) => f.status === "addressed").length;

    const month = dayStart.toLocaleString("en-US", { month: "short" });
    const day = dayStart.getDate();

    dailyMetrics.push({
      date: `${month} ${day}`,
      submissions: dayTotal,
      sentiment: dayTotal > 0 ? Math.round((dayPraise / dayTotal) * 100) : 50,
      issues: dayIssues,
      resolved: dayResolved,
    });
  }

  // Weekly volume
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const weeklyVolume = notDismissed.filter((f) => new Date(f.createdAt) >= weekAgo).length;

  // Resolution rate
  const addressed = notDismissed.filter((f) => f.status === "addressed").length;
  const resolutionRate = total > 0 ? Math.round((addressed / total) * 100) : 0;

  return {
    total,
    contributors,
    positive,
    neutral,
    needsAttention,
    weeklyVolume,
    resolutionRate,
    categoryStats,
    reactionTotals: reactionTotalsWithPct,
    trendingTopics,
    feedbackByType,
    dailyMetrics,
  };
}

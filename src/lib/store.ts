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

  type Row = [string, string, CategoryId, FeedbackType, string, string | null, number, number];
  const raw: Row[] = [
    ["Lina C.", "L", "Product", "issue", "The checkout flow keeps freezing on the payment step. Tried three different browsers.", null, 34, 1],
    ["Marcus J.", "M", "UX", "suggestion", "The search bar should support filters like date range and category. Right now I have to scroll through everything.", "feature-request", 27, 3],
    ["Priya N.", "P", "Support", "praise", "Had an issue with my billing and the team sorted it out same day. Really appreciated the quick follow-up.", "great-support", 41, 6],
    ["Ethan G.", "E", "Product", "praise", "", "love-it", 19, 10],
    ["Sophie W.", "S", "UX", "issue", "The mobile layout is broken on the account settings page. Buttons overlap and the save button is hidden.", "bug-report", 13, 14],
    ["Omar B.", "O", "Product", "suggestion", "Would be great to have bulk import from CSV. Adding items one by one takes forever.", "feature-request", 22, 24],
    ["Aisha T.", "A", "UX", "issue", "", "too-slow", 16, 30],
    ["Daniel F.", "D", "Support", "question", "Is there a way to transfer ownership of a workspace to another team member?", null, 5, 42],
    ["Rachel K.", "R", "Product", "praise", "The new notification system is exactly what we needed. No more missed updates.", null, 29, 48],
    ["Kai L.", "K", "UX", "suggestion", "Add keyboard shortcuts for the most common actions. Would speed up our workflow significantly.", null, 21, 60],
    ["Nadia H.", "N", "Product", "issue", "PDF export cuts off content on the right side. Have to manually adjust margins every time.", null, 11, 72],
    ["James R.", "J", "Support", "praise", "Your knowledge base articles are thorough and well-written. Saved me from contacting support multiple times.", null, 17, 96],
    ["Zoe M.", "Z", "UX", "praise", "", "easy-to-use", 36, 108],
    ["Lucas P.", "L", "Product", "suggestion", "Two-factor authentication should support hardware keys, not just SMS and authenticator apps.", null, 14, 120],
    ["Mia S.", "M", "Support", "issue", "Submitted a ticket 5 days ago about data sync issues and haven't heard back yet.", null, 8, 144],
    ["Thomas A.", "T", "UX", "suggestion", "The color contrast on disabled buttons is too low. Hard to tell what's clickable vs what isn't.", "needs-improvement", 12, 156],
    ["Yuki O.", "Y", "Product", "praise", "The API documentation is excellent. Had our integration running in under an hour.", null, 25, 192],
    ["Isabella D.", "I", "UX", "issue", "Dropdown menus close when I try to scroll inside them on Firefox. Pretty frustrating.", "bug-report", 9, 204],
    ["Ben W.", "B", "Product", "question", "Are there plans to support SSO with SAML? Our IT team requires it for all vendor tools.", null, 7, 216],
    ["Camille R.", "C", "Support", "suggestion", "A live chat widget would be much faster than email for simple questions.", null, 18, 240],
    ["Arjun V.", "A", "Product", "praise", "The permissions system is flexible without being complicated. Nice balance.", null, 23, 264],
    ["Freya B.", "F", "UX", "issue", "Clicking the back button after saving sometimes loses my changes. Happened twice today.", "confusing", 10, 288],
    ["Noah E.", "N", "Support", "praise", "Called about an urgent issue and the support agent stayed on the line until it was fully resolved.", "great-support", 38, 300],
    ["Elena G.", "E", "Product", "suggestion", "Let us schedule reports to be sent automatically. Having to generate them manually weekly is tedious.", "feature-request", 30, 312],
    ["Ryan T.", "R", "UX", "praise", "The recent redesign of the settings page is a huge improvement. Everything is where I'd expect it.", null, 20, 324],
    ["Hana K.", "H", "Support", "question", "What's the difference between the Team and Business plans? The comparison page isn't clear on a few features.", null, 6, 336],
    ["Diego M.", "D", "Product", "issue", "Webhooks occasionally fire twice for the same event. Causing duplicate entries on our side.", "bug-report", 15, 348],
    ["Clara J.", "C", "UX", "suggestion", "Please add a way to undo actions. Accidentally archived an important item and had to dig to restore it.", null, 24, 360],
    ["Leo S.", "L", "Product", "praise", "The real-time sync across devices works flawlessly. Changed something on my phone and it was instant on desktop.", null, 33, 372],
    ["Amara P.", "A", "Support", "issue", "The help center search returns irrelevant results. Searched for 'billing' and got articles about integrations.", null, 4, 380],
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
    priority: (i === 0 || i === 4 ? "high" : i === 6 || i === 14 ? "medium" : i === 10 || i === 15 ? "low" : "none") as Priority,
    starred: i === 2 || i === 8 || i === 23,
    escalated: i === 0 || i === 4 || i === 6 || i === 14 || i === 26,
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

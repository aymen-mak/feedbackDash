import fs from "fs";
import path from "path";

// ── Types ──
export type FeedbackType = "issue" | "suggestion" | "question";
export type FeedbackStatus = "new" | "reviewed" | "addressed" | "dismissed";
export type CategoryId = "Core" | "UI/UX" | "App" | "Operator CLI" | "UX";
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
  screenshotUrl: string | null;
  rating: number | null;
  acknowledged: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
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

// ── Quick action labels (feelings/reactions only) ──
export const QUICK_ACTION_LABELS: Record<string, { emoji: string; label: string }> = {
  "love-it": { emoji: "🎉", label: "Love it!" },
  "easy-to-use": { emoji: "✨", label: "Easy to use" },
  "great-support": { emoji: "👏", label: "Great support" },
  "impressive": { emoji: "🤩", label: "Impressive" },
  "helpful": { emoji: "🙌", label: "Helpful" },
  "confusing": { emoji: "😕", label: "Confusing" },
};

// ── Input sanitization ──
export function sanitizeInput(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/https?:\/\/[^\s)}\]>]+/gi, "[link removed]")
    .replace(/www\.[^\s)}\]>]+/gi, "[link removed]")
    .replace(/data:[^\s]+/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim();
}

// ── Seed data (30 items over 15 days) ──
export function seed(): StoredFeedback[] {
  const now = Date.now();
  const H = 3600000;

  type Row = [string, string, CategoryId, FeedbackType, string, string | null, number, number, number | null];
  const raw: Row[] = [
    ["Lina C.", "L", "Core", "issue", "The checkout flow keeps freezing on the payment step. Tried three different browsers.", null, 34, 1, 2],
    ["Marcus J.", "M", "UX", "suggestion", "The search bar should support filters like date range and category.\nRight now I have to scroll through everything.", null, 27, 3, 4],
    ["Priya N.", "P", "Core", "suggestion", "Had an issue with my billing and the team sorted it out same day. Really appreciated the quick follow-up.", "great-support", 41, 6, 5],
    ["Ethan G.", "E", "Core", "suggestion", "Overall the product is great, keep it up!", "love-it", 19, 10, 5],
    ["Sophie W.", "S", "UX", "issue", "The mobile layout is broken on the account settings page.\nButtons overlap and the save button is hidden.", null, 13, 14, 2],
    ["Omar B.", "O", "Core", "suggestion", "Would be great to have bulk import from CSV.\nAdding items one by one takes forever.", null, 22, 24, 3],
    ["Aisha T.", "A", "UX", "issue", "Pages take too long to load, especially the dashboard.", null, 16, 30, 1],
    ["Daniel F.", "D", "Core", "question", "Is there a way to transfer ownership of a workspace to another team member?", null, 5, 42, null],
    ["Rachel K.", "R", "Core", "suggestion", "The new notification system is exactly what we needed. No more missed updates.", null, 29, 48, 5],
    ["Kai L.", "K", "UX", "suggestion", "Add keyboard shortcuts for the most common actions.\nWould speed up our workflow significantly.", null, 21, 60, 4],
    ["Nadia H.", "N", "Core", "issue", "PDF export cuts off content on the right side.\nHave to manually adjust margins every time.", null, 11, 72, 2],
    ["James R.", "J", "Core", "suggestion", "Your knowledge base articles are thorough and well-written. Saved me from contacting support multiple times.", null, 17, 96, 5],
    ["Zoe M.", "Z", "UX", "suggestion", "The interface is intuitive and easy to navigate.", "easy-to-use", 36, 108, 5],
    ["Lucas P.", "L", "Core", "suggestion", "Two-factor authentication should support hardware keys, not just SMS and authenticator apps.", null, 14, 120, 3],
    ["Mia S.", "M", "UX", "issue", "Submitted a ticket 5 days ago about data sync issues and haven't heard back yet.", null, 8, 144, 1],
    ["Thomas A.", "T", "UX", "suggestion", "The color contrast on disabled buttons is too low.\nHard to tell what's clickable vs what isn't.", null, 12, 156, 3],
    ["Yuki O.", "Y", "Core", "suggestion", "The API documentation is excellent. Had our integration running in under an hour.", "impressive", 25, 192, 5],
    ["Isabella D.", "I", "UX", "issue", "Dropdown menus close when I try to scroll inside them on Firefox. Pretty frustrating.", null, 9, 204, 2],
    ["Ben W.", "B", "Core", "question", "Are there plans to support SSO with SAML? Our IT team requires it for all vendor tools.", null, 7, 216, null],
    ["Camille R.", "C", "UX", "suggestion", "A live chat widget would be much faster than email for simple questions.", null, 18, 240, 4],
    ["Arjun V.", "A", "Core", "suggestion", "The permissions system is flexible without being complicated. Nice balance.", "helpful", 23, 264, 5],
    ["Freya B.", "F", "UX", "issue", "Clicking the back button after saving sometimes loses my changes.\nHappened twice today.", "confusing", 10, 288, 2],
    ["Noah E.", "N", "Core", "suggestion", "Called about an urgent issue and the team stayed on the line until it was fully resolved.", "great-support", 38, 300, 5],
    ["Elena G.", "E", "Core", "suggestion", "Let us schedule reports to be sent automatically.\nHaving to generate them manually weekly is tedious.", null, 30, 312, 3],
    ["Ryan T.", "R", "UX", "suggestion", "The recent redesign of the settings page is a huge improvement. Everything is where I'd expect it.", null, 20, 324, 5],
    ["Hana K.", "H", "Core", "question", "What's the difference between the Team and Business plans?\nThe comparison page isn't clear on a few features.", null, 6, 336, null],
    ["Diego M.", "D", "Core", "issue", "Webhooks occasionally fire twice for the same event.\nCausing duplicate entries on our side.", null, 15, 348, 2],
    ["Clara J.", "C", "UX", "suggestion", "Please add a way to undo actions.\nAccidentally archived an important item and had to dig to restore it.", null, 24, 360, 4],
    ["Leo S.", "L", "Core", "suggestion", "The real-time sync across devices works flawlessly. Changed something on my phone and it was instant on desktop.", "impressive", 33, 372, 5],
    ["Amara P.", "A", "UX", "issue", "The help center search returns irrelevant results.\nSearched for 'billing' and got articles about integrations.", null, 4, 380, 2],
  ];

  return raw.map(([userName, userAvatar, category, type, message, quickAction, upvotes, hoursAgo, rating], i) => ({
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
    screenshotUrl: null,
    rating: rating ?? null,
    acknowledged: i === 2 || i === 8 || i === 11 || i === 22,
    reviewedBy: i >= 5 && i < 15 ? "Sarah" : i >= 15 ? "Alex" : null,
    reviewedAt: i >= 5 ? new Date(now - (hoursAgo - 1) * H).toISOString() : null,
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

/** Get specific items by IDs (regardless of archived/deleted status) */
export function getFeedbackByIds(ids: string[]): StoredFeedback[] {
  const idSet = new Set(ids);
  return read().feedback
    .filter((f) => idSet.has(f.id))
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
  screenshotUrl?: string | null;
  rating?: number | null;
}): StoredFeedback {
  const store = read();
  const item: StoredFeedback = {
    id: uid(),
    userName: sanitizeInput(data.userName).slice(0, 50),
    userAvatar: data.userAvatar,
    category: data.category,
    type: data.type,
    message: sanitizeInput(data.message).slice(0, 5000),
    quickAction: data.quickAction,
    anonymous: data.anonymous,
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
    screenshotUrl: data.screenshotUrl ?? null,
    rating: data.rating ?? null,
    acknowledged: false,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
  };
  store.feedback.push(item);
  write(store);
  return item;
}

export function updateFeedback(
  id: string,
  updates: Partial<Pick<StoredFeedback, "status" | "priority" | "starred" | "escalated" | "dismissed" | "archived" | "deletedAt" | "tags" | "acknowledged" | "reviewedBy" | "reviewedAt">>
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

export function updateReply(feedbackId: string, replyId: string, message: string): StoredFeedback | null {
  const store = read();
  const idx = store.feedback.findIndex((f) => f.id === feedbackId);
  if (idx === -1) return null;
  const reply = store.feedback[idx].replies.find((r) => r.id === replyId);
  if (!reply) return null;
  reply.message = message;
  write(store);
  return store.feedback[idx];
}

export function deleteReply(feedbackId: string, replyId: string): StoredFeedback | null {
  const store = read();
  const idx = store.feedback.findIndex((f) => f.id === feedbackId);
  if (idx === -1) return null;
  store.feedback[idx].replies = store.feedback[idx].replies.filter((r) => r.id !== replyId);
  write(store);
  return store.feedback[idx];
}

export function permanentlyDeleteFeedback(id: string): boolean {
  const store = read();
  const before = store.feedback.length;
  store.feedback = store.feedback.filter((f) => f.id !== id);
  write(store);
  return store.feedback.length < before;
}

// ── Stats ──

export interface DailyMetric {
  date: string;
  submissions: number;
  core: number;
  uiux: number;
  app: number;
  operatorCli: number;
  issues: number;
  resolved: number;
}

export function getStats() {
  const active = read().feedback.filter((f) => !f.archived && !f.deletedAt);
  const total = active.length;
  const notDismissed = active.filter((f) => !f.dismissed);

  // Type counts
  const byType = {
    suggestion: notDismissed.filter((f) => f.type === "suggestion").length,
    issue: notDismissed.filter((f) => f.type === "issue").length,
    question: notDismissed.filter((f) => f.type === "question").length,
  };
  const typeTotal = byType.suggestion + byType.issue + byType.question;

  // Experience rating stats (from user ratings 1-5)
  const rated = notDismissed.filter((f) => f.rating !== null && f.rating !== undefined);
  const avgRating = rated.length > 0 ? rated.reduce((sum, f) => sum + (f.rating ?? 0), 0) / rated.length : 0;
  const satisfied = rated.filter((f) => (f.rating ?? 0) >= 4).length;
  const neutral = rated.filter((f) => (f.rating ?? 0) === 3).length;
  const unsatisfied = rated.filter((f) => (f.rating ?? 0) <= 2).length;
  const ratedTotal = satisfied + neutral + unsatisfied;
  const satisfiedPct = ratedTotal > 0 ? Math.round((satisfied / ratedTotal) * 100) : 0;
  const neutralPct = ratedTotal > 0 ? Math.round((neutral / ratedTotal) * 100) : 0;
  const unsatisfiedPct = ratedTotal > 0 ? 100 - satisfiedPct - neutralPct : 0;

  // Category stats
  const categories: CategoryId[] = ["Core", "UI/UX", "App", "Operator CLI"];
  const categoryStats = categories.map((cat) => {
    const items = notDismissed.filter((f) => f.category === cat);
    const openIssues = items.filter((f) => f.type === "issue" && f.status !== "addressed").length;
    const catRated = items.filter((f) => f.rating !== null && f.rating !== undefined);
    const catAvg = catRated.length > 0 ? catRated.reduce((s, f) => s + (f.rating ?? 0), 0) / catRated.length : 0;
    return {
      id: cat,
      submissions: items.length,
      openIssues,
      satisfaction: Math.round(catAvg * 100) / 100,
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

  const reactionTotals = Object.entries(actionCounts)
    .filter(([id]) => QUICK_ACTION_LABELS[id]) // skip unknown/legacy IDs
    .map(([id, count]) => ({
      id,
      emoji: QUICK_ACTION_LABELS[id].emoji,
      label: QUICK_ACTION_LABELS[id].label,
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
    { name: "Issue", value: byType.issue, pct: typeTotal > 0 ? Math.round((byType.issue / typeTotal) * 100) : 0, color: "#ef4444" },
    { name: "Suggestion", value: byType.suggestion, pct: typeTotal > 0 ? Math.round((byType.suggestion / typeTotal) * 100) : 0, color: "#3b82f6" },
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
    const dayIssues = dayItems.filter((f) => f.type === "issue").length;
    const dayResolved = dayItems.filter((f) => f.status === "addressed").length;

    const month = dayStart.toLocaleString("en-US", { month: "short" });
    const day = dayStart.getDate();

    dailyMetrics.push({
      date: `${month} ${day}`,
      submissions: dayTotal,
      core: dayItems.filter((f) => f.category === "Core").length,
      uiux: dayItems.filter((f) => f.category === "UI/UX" || f.category === "UX").length,
      app: dayItems.filter((f) => f.category === "App").length,
      operatorCli: dayItems.filter((f) => f.category === "Operator CLI").length,
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
    avgRating: Math.round(avgRating * 10) / 10,
    satisfiedPct,
    neutralPct,
    unsatisfiedPct,
    weeklyVolume,
    resolutionRate,
    categoryStats,
    reactionTotals: reactionTotalsWithPct,
    trendingTopics,
    feedbackByType,
    dailyMetrics,
  };
}

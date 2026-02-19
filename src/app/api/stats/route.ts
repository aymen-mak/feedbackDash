import { NextResponse } from "next/server";
import { getStats } from "@/lib/store";
import { hasPostgres, pgGetAllFeedback, pgSeedIfEmpty } from "@/lib/db";
import { seed, type StoredFeedback, type CategoryId, type DailyMetric } from "@/lib/store";

/** Compute stats from a list of feedback items (shared logic for both backends) */
function computeStats(all: StoredFeedback[]) {
  const total = all.length;
  const notDismissed = all.filter((f) => !f.dismissed);

  const byType = {
    praise: notDismissed.filter((f) => f.type === "praise").length,
    suggestion: notDismissed.filter((f) => f.type === "suggestion").length,
    issue: notDismissed.filter((f) => f.type === "issue").length,
    question: notDismissed.filter((f) => f.type === "question").length,
  };
  const typeTotal = byType.praise + byType.suggestion + byType.issue + byType.question;

  const positive = typeTotal > 0 ? Math.round((byType.praise / typeTotal) * 100) : 0;
  const neutral = typeTotal > 0 ? Math.round(((byType.suggestion + byType.question) / typeTotal) * 100) : 0;
  const needsAttention = typeTotal > 0 ? 100 - positive - neutral : 0;

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

  const contributors = new Set(notDismissed.map((f) => f.userName)).size;

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
      emoji: quickActionLabels[id]?.emoji ?? "?",
      label: quickActionLabels[id]?.label ?? id,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const reactionTotal = reactionTotals.reduce((s, r) => s + r.count, 0);
  const reactionTotalsWithPct = reactionTotals.map((r) => ({
    ...r,
    pct: reactionTotal > 0 ? Math.round((r.count / reactionTotal) * 100) : 0,
  }));

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

  const feedbackByType = [
    { name: "Praise", value: byType.praise, pct: typeTotal > 0 ? Math.round((byType.praise / typeTotal) * 100) : 0, color: "#22c55e" },
    { name: "Suggestion", value: byType.suggestion, pct: typeTotal > 0 ? Math.round((byType.suggestion / typeTotal) * 100) : 0, color: "#3b82f6" },
    { name: "Issue", value: byType.issue, pct: typeTotal > 0 ? Math.round((byType.issue / typeTotal) * 100) : 0, color: "#ef4444" },
    { name: "Question", value: byType.question, pct: typeTotal > 0 ? Math.round((byType.question / typeTotal) * 100) : 0, color: "#C4B5FD" },
  ];

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

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const weeklyVolume = notDismissed.filter((f) => new Date(f.createdAt) >= weekAgo).length;
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

export async function GET() {
  try {
    if (hasPostgres()) {
      await pgSeedIfEmpty(seed());
      const all = await pgGetAllFeedback();
      return NextResponse.json(computeStats(all));
    }

    const stats = getStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("GET /api/stats error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

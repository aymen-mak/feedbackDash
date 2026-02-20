import { NextResponse } from "next/server";
import { getStats } from "@/lib/store";
import { hasPostgres, pgGetAllFeedback, pgSeedIfEmpty } from "@/lib/db";
import { seed, QUICK_ACTION_LABELS, type StoredFeedback, type CategoryId, type DailyMetric } from "@/lib/store";

/** Compute stats from a list of feedback items (shared logic for both backends) */
function computeStats(all: StoredFeedback[]) {
  const total = all.length;
  const notDismissed = all.filter((f) => !f.dismissed);

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

  const categories: CategoryId[] = ["Product", "UX", "Support"];
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

  const contributors = new Set(notDismissed.map((f) => f.userName)).size;

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
    { name: "Issue", value: byType.issue, pct: typeTotal > 0 ? Math.round((byType.issue / typeTotal) * 100) : 0, color: "#ef4444" },
    { name: "Suggestion", value: byType.suggestion, pct: typeTotal > 0 ? Math.round((byType.suggestion / typeTotal) * 100) : 0, color: "#3b82f6" },
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
    const dayRated = dayItems.filter((f) => f.rating !== null && f.rating !== undefined);
    const dayAvg = dayRated.length > 0 ? dayRated.reduce((s, f) => s + (f.rating ?? 0), 0) / dayRated.length : 3;
    const dayIssues = dayItems.filter((f) => f.type === "issue").length;
    const dayResolved = dayItems.filter((f) => f.status === "addressed").length;

    const month = dayStart.toLocaleString("en-US", { month: "short" });
    const day = dayStart.getDate();

    dailyMetrics.push({
      date: `${month} ${day}`,
      submissions: dayTotal,
      satisfaction: Math.round((dayAvg / 5) * 100),
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

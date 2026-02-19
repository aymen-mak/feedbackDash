"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import PasswordGate from "@/components/PasswordGate";
import Tooltip from "@/components/Tooltip";
import { type FeedbackItemData } from "@/components/FeedbackCard";
import {
  Layers,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ThumbsUp,
  Hash,
  Flame,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Box,
  Paintbrush,
  Headphones,
} from "lucide-react";

type CategoryId = "Product" | "UX" | "Support";

const QUICK_ACTION_LABELS: Record<string, { emoji: string; label: string }> = {
  "love-it": { emoji: "🎉", label: "Love it!" },
  "easy-to-use": { emoji: "✨", label: "Easy to use" },
  "feature-request": { emoji: "💡", label: "Feature request" },
  "bug-report": { emoji: "🐛", label: "Bug report" },
  "great-support": { emoji: "👏", label: "Great support" },
  "confusing": { emoji: "😕", label: "Confusing" },
  "too-slow": { emoji: "🐌", label: "Too slow" },
  "needs-improvement": { emoji: "🔧", label: "Needs improvement" },
};

interface Theme {
  id: string;
  title: string;
  description: string;
  category: CategoryId;
  sentiment: string;
  itemCount: number;
  topVotes: number;
  actionable: boolean;
  items: FeedbackItemData[];
}

const sentimentColors: Record<string, string> = {
  praise: "text-makina-green bg-makina-green/10",
  issue: "text-makina-red bg-red-500/10",
  suggestion: "text-makina-blue bg-blue-500/10",
  question: "text-makina-accent bg-makina-accent-dim",
};

const categoryIcons: Record<CategoryId, React.ComponentType<{ size?: number; className?: string }>> = {
  Product: Box,
  UX: Paintbrush,
  Support: Headphones,
};

function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Group escalated items into themes by category and common keywords
function buildThemes(items: FeedbackItemData[]): Theme[] {
  const byCategory: Record<CategoryId, FeedbackItemData[]> = { Product: [], UX: [], Support: [] };
  for (const item of items) {
    if (byCategory[item.category as CategoryId]) {
      byCategory[item.category as CategoryId].push(item);
    }
  }

  const themes: Theme[] = [];
  const categoryDescriptions: Record<CategoryId, { title: string; description: string }[]> = {
    Product: [
      { title: "Product Experience", description: "Feedback about core product features and capabilities" },
    ],
    UX: [
      { title: "Interface & Usability", description: "User experience issues, suggestions, and praise" },
    ],
    Support: [
      { title: "Support Quality", description: "Support interaction feedback and improvement requests" },
    ],
  };

  for (const cat of ["Product", "UX", "Support"] as CategoryId[]) {
    const catItems = byCategory[cat];
    if (catItems.length === 0) continue;

    const desc = categoryDescriptions[cat][0];
    const topVotes = Math.max(...catItems.map((i) => i.upvotes), 0);
    const hasIssues = catItems.some((i) => i.type === "issue");

    themes.push({
      id: `theme-${cat}`,
      title: desc.title,
      description: desc.description,
      category: cat,
      sentiment: hasIssues ? "issue" : catItems[0]?.type || "suggestion",
      itemCount: catItems.length,
      topVotes,
      actionable: hasIssues || catItems.some((i) => i.type === "suggestion"),
      items: catItems.slice(0, 5),
    });
  }

  return themes.sort((a, b) => b.itemCount - a.itemCount);
}

interface Stats {
  total: number;
  positive: number;
  neutral: number;
  needsAttention: number;
  weeklyVolume: number;
  categoryStats: { id: string; submissions: number; openIssues: number; satisfaction: number }[];
}

export default function TeamPage() {
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | "all">("all");
  const [feedback, setFeedback] = useState<FeedbackItemData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/feedback").then((r) => r.ok ? r.json() : []),
      fetch("/api/stats").then((r) => r.ok ? r.json() : null),
    ]).then(([fb, st]) => {
      const allFb = Array.isArray(fb) ? fb as FeedbackItemData[] : [];
      // Only show escalated items (or high-value: issues/suggestions with upvotes > 10)
      const escalated = allFb.filter(
        (f: FeedbackItemData & { escalated?: boolean; dismissed?: boolean }) =>
          f.escalated || ((f.type === "issue" || f.type === "suggestion") && f.upvotes > 10)
      ).filter((f: FeedbackItemData & { dismissed?: boolean }) => !f.dismissed);
      setFeedback(escalated);
      if (st && typeof st.total === "number") setStats(st);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const themes = buildThemes(feedback);
  const actionableCount = themes.filter((t) => t.actionable).length;
  const topCategory = stats?.categoryStats.reduce((a, b) => (a.openIssues > b.openIssues ? a : b), stats.categoryStats[0]);

  const filteredThemes =
    categoryFilter === "all"
      ? themes
      : themes.filter((t) => t.category === categoryFilter);

  const quickWins = feedback
    .filter((i) => i.upvotes >= 10)
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 3);

  if (loading) {
    return (
      <PasswordGate>
        <div className="min-h-screen">
          <Navbar />
          <main className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-center h-[80vh]">
            <div className="text-sm text-makina-muted animate-pulse">Loading team insights...</div>
          </main>
        </div>
      </PasswordGate>
    );
  }

  return (
    <PasswordGate>
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap animate-fade-in-up">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-makina-muted font-medium uppercase tracking-wider">Layer 2</p>
                <h1 className="text-xl font-bold">Team Insights</h1>
              </div>
              <div className="hidden md:flex items-center gap-4 pl-6 border-l border-makina-border">
                <Tooltip content="Feedback items escalated from review">
                  <div className="flex items-center gap-2 cursor-default">
                    <Layers size={13} className="text-makina-muted" />
                    <span className="text-sm font-semibold">{feedback.length}</span>
                    <span className="text-xs text-makina-muted">escalated</span>
                  </div>
                </Tooltip>
                <Tooltip content="Grouped themes ready for action">
                  <div className="flex items-center gap-2 cursor-default">
                    <Hash size={13} className="text-makina-muted" />
                    <span className="text-sm font-semibold">{themes.length}</span>
                    <span className="text-xs text-makina-muted">themes</span>
                  </div>
                </Tooltip>
                <Tooltip content="Themes marked as directly actionable">
                  <div className="flex items-center gap-2 cursor-default">
                    <CheckCircle2 size={13} className="text-makina-green" />
                    <span className="text-sm font-semibold">{actionableCount}</span>
                    <span className="text-xs text-makina-green">actionable</span>
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: "50ms" }}>
            <div className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" />
                <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">Top pain point</span>
              </div>
              <p className="text-sm font-semibold">{topCategory?.id ?? "N/A"}</p>
              <p className="text-xs text-makina-muted">
                {topCategory?.openIssues ?? 0} open issues &middot; {topCategory ? Math.round(topCategory.satisfaction * 100) : 0}% satisfaction
              </p>
            </div>

            <div className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-makina-blue" />
                <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">This week&apos;s sentiment</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex h-2 rounded-full overflow-hidden">
                    <div className="bg-makina-green" style={{ width: `${stats?.positive ?? 0}%` }} />
                    <div className="bg-makina-blue" style={{ width: `${stats?.neutral ?? 0}%` }} />
                    <div className="bg-amber-500" style={{ width: `${stats?.needsAttention ?? 0}%` }} />
                  </div>
                </div>
                <span className="text-sm font-semibold text-makina-green">{stats?.positive ?? 0}%</span>
              </div>
              <p className="text-xs text-makina-muted">Positive sentiment from feedback</p>
            </div>

            <div className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-makina-accent" />
                <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">Feedback volume</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{stats?.weeklyVolume ?? 0}</span>
              </div>
              <p className="text-xs text-makina-muted">submissions this week across all categories</p>
            </div>
          </div>

          {/* Quick wins */}
          {quickWins.length > 0 && (
            <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center gap-2">
                <Lightbulb size={16} className="text-amber-400" />
                <h2 className="text-sm font-semibold">Quick Wins</h2>
                <span className="text-xs text-makina-muted">High-impact, most upvoted feedback</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {quickWins.map((item) => {
                  const CatIcon = categoryIcons[item.category as CategoryId];
                  const quickAction = item.quickAction ? QUICK_ACTION_LABELS[item.quickAction] : null;
                  return (
                    <div key={item.id} className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-3 hover-lift">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 rounded-full bg-makina-surface px-2 py-0.5 text-[10px] font-medium text-makina-muted">
                            <CatIcon size={9} />
                            {item.category}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sentimentColors[item.type] || ""}`}>
                            {item.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-semibold text-makina-accent">
                          <ThumbsUp size={11} />
                          {item.upvotes}
                        </div>
                      </div>
                      {quickAction && (
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-makina-surface px-2.5 py-1 text-xs">
                          <span>{quickAction.emoji}</span>
                          <span className="font-medium">{quickAction.label}</span>
                        </div>
                      )}
                      {item.message && (
                        <p className="text-xs text-makina-text/85 leading-relaxed line-clamp-2">{item.message}</p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-makina-muted">
                        <span>{item.userName}</span>
                        <span>&middot;</span>
                        <Clock size={10} />
                        <span>{timeAgo(item.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Themed groups */}
          <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-makina-accent" />
                <h2 className="text-sm font-semibold">Feedback Themes</h2>
                <span className="text-xs text-makina-muted">Auto-grouped by topic</span>
              </div>
              <div className="flex gap-1">
                {(["all", "Product", "UX", "Support"] as (CategoryId | "all")[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      categoryFilter === cat
                        ? "bg-makina-accent text-makina-bg"
                        : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"
                    }`}
                  >
                    {cat === "all" ? "All" : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredThemes.map((theme) => {
                const CatIcon = categoryIcons[theme.category];
                const isExpanded = expandedTheme === theme.id;
                return (
                  <div key={theme.id} className="rounded-lg bg-makina-card border border-makina-border overflow-hidden">
                    <button
                      onClick={() => setExpandedTheme(isExpanded ? null : theme.id)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-makina-card-hover transition-colors"
                    >
                      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-makina-surface shrink-0">
                        <CatIcon size={18} className="text-makina-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">{theme.title}</h3>
                          {theme.actionable && (
                            <span className="text-[10px] font-medium text-makina-green bg-makina-green/10 rounded-full px-2 py-0.5">Actionable</span>
                          )}
                        </div>
                        <p className="text-xs text-makina-muted mt-0.5">{theme.description}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-4 shrink-0">
                        <div className="text-center">
                          <p className="text-sm font-semibold">{theme.itemCount}</p>
                          <p className="text-[10px] text-makina-muted">items</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-makina-accent">{theme.topVotes}</p>
                          <p className="text-[10px] text-makina-muted">top votes</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className={`text-makina-subtle transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
                    </button>

                    {isExpanded && (
                      <div className="border-t border-makina-border/50 bg-makina-surface/50 p-4 space-y-3 animate-fade-in-up">
                        <p className="text-xs text-makina-muted font-medium uppercase tracking-wider">
                          Feedback in this theme
                        </p>
                        {theme.items.map((item) => {
                          const quickAction = item.quickAction ? QUICK_ACTION_LABELS[item.quickAction] : null;
                          return (
                            <div key={item.id} className="rounded-md bg-makina-card border border-makina-border p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-makina-surface text-[10px] font-bold text-makina-accent border border-makina-border">
                                  {item.userAvatar}
                                </div>
                                <span className="text-xs font-medium">{item.userName}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sentimentColors[item.type] || ""}`}>
                                  {item.type}
                                </span>
                                <span className="text-[10px] text-makina-subtle ml-auto">{timeAgo(item.createdAt)}</span>
                              </div>
                              {quickAction && (
                                <div className="inline-flex items-center gap-1 rounded-md bg-makina-surface px-2 py-1 text-xs">
                                  <span>{quickAction.emoji}</span>
                                  <span className="font-medium">{quickAction.label}</span>
                                </div>
                              )}
                              {item.message && (
                                <p className="text-xs text-makina-text/80 leading-relaxed">{item.message}</p>
                              )}
                              <div className="flex items-center gap-1 text-[10px] text-makina-muted">
                                <ThumbsUp size={10} />
                                {item.upvotes} upvotes
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {filteredThemes.length === 0 && (
            <div className="text-center py-16 space-y-3 animate-fade-in-up">
              <Layers size={32} className="text-makina-subtle mx-auto" />
              <p className="text-sm text-makina-muted">
                {feedback.length === 0
                  ? "No feedback has been escalated yet. Use the Review page to escalate items."
                  : "No themes match this category filter"}
              </p>
            </div>
          )}
        </main>
      </div>
    </PasswordGate>
  );
}

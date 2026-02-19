"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import PasswordGate from "@/components/PasswordGate";
import Tooltip from "@/components/Tooltip";
import {
  MOCK_FEEDBACK,
  CATEGORY_STATS,
  FEEDBACK_BY_TYPE,
  type FeedbackItem,
  type CategoryId,
  QUICK_ACTIONS,
} from "@/lib/mock-data";
import {
  Layers,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ThumbsUp,
  ArrowRight,
  Hash,
  Flame,
  BarChart3,
  Users,
  CheckCircle2,
  MessageSquare,
  ChevronRight,
  Clock,
  Box,
  Paintbrush,
  Headphones,
} from "lucide-react";

// Simulate escalated/curated items — in production these come from the review layer
const ESCALATED_ITEMS = MOCK_FEEDBACK.filter(
  (f) => f.type === "issue" || f.type === "suggestion" || f.upvotes > 15
);

// Auto-grouped themes extracted from escalated feedback
const THEMES = [
  {
    id: "theme-1",
    title: "Dark Mode & Theming",
    description: "Users want better theme control and dark mode in bright environments",
    category: "UX" as CategoryId,
    sentiment: "suggestion",
    itemCount: 4,
    topVotes: 18,
    actionable: true,
    items: ESCALATED_ITEMS.filter((f) => f.category === "UX").slice(0, 2),
  },
  {
    id: "theme-2",
    title: "Export & Data Portability",
    description: "Requests for exporting feedback history and data downloads",
    category: "Product" as CategoryId,
    sentiment: "question",
    itemCount: 3,
    topVotes: 15,
    actionable: true,
    items: ESCALATED_ITEMS.filter((f) => f.category === "Product").slice(0, 2),
  },
  {
    id: "theme-3",
    title: "Navigation & Discoverability",
    description: "Users struggling to find notification preferences and settings",
    category: "Support" as CategoryId,
    sentiment: "issue",
    itemCount: 2,
    topVotes: 7,
    actionable: true,
    items: ESCALATED_ITEMS.filter((f) => f.category === "Support").slice(0, 2),
  },
  {
    id: "theme-4",
    title: "Mobile Experience",
    description: "Strong demand for responsive design or dedicated mobile app",
    category: "UX" as CategoryId,
    sentiment: "suggestion",
    itemCount: 5,
    topVotes: 20,
    actionable: false,
    items: ESCALATED_ITEMS.filter((f) => f.type === "suggestion").slice(0, 2),
  },
];

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

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function TeamPage() {
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | "all">("all");

  const totalEscalated = ESCALATED_ITEMS.length;
  const actionableCount = THEMES.filter((t) => t.actionable).length;
  const topCategory = CATEGORY_STATS.reduce((a, b) => (a.openIssues > b.openIssues ? a : b));

  const filteredThemes =
    categoryFilter === "all"
      ? THEMES
      : THEMES.filter((t) => t.category === categoryFilter);

  // Quick wins — high-upvote, actionable items
  const quickWins = ESCALATED_ITEMS.filter((i) => i.upvotes >= 15)
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 3);

  return (
    <PasswordGate>
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap animate-fade-in-up">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-makina-muted font-medium uppercase tracking-wider">
                  Layer 2
                </p>
                <h1 className="text-xl font-bold">Team Insights</h1>
              </div>
              <div className="hidden md:flex items-center gap-4 pl-6 border-l border-makina-border">
                <Tooltip content="Feedback items escalated from review">
                  <div className="flex items-center gap-2 cursor-default">
                    <Layers size={13} className="text-makina-muted" />
                    <span className="text-sm font-semibold">{totalEscalated}</span>
                    <span className="text-xs text-makina-muted">escalated</span>
                  </div>
                </Tooltip>
                <Tooltip content="Grouped themes ready for action">
                  <div className="flex items-center gap-2 cursor-default">
                    <Hash size={13} className="text-makina-muted" />
                    <span className="text-sm font-semibold">{THEMES.length}</span>
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

          {/* Summary cards row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: "50ms" }}>
            {/* Top issues card */}
            <div className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" />
                <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">
                  Top pain point
                </span>
              </div>
              <p className="text-sm font-semibold">{topCategory.id}</p>
              <p className="text-xs text-makina-muted">
                {topCategory.openIssues} open issues &middot; {Math.round(topCategory.satisfaction * 100)}% satisfaction
              </p>
            </div>

            {/* Sentiment snapshot */}
            <div className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-makina-blue" />
                <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">
                  This week&apos;s sentiment
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex h-2 rounded-full overflow-hidden">
                    <div className="bg-makina-green" style={{ width: "62%" }} />
                    <div className="bg-makina-blue" style={{ width: "24%" }} />
                    <div className="bg-amber-500" style={{ width: "14%" }} />
                  </div>
                </div>
                <span className="text-sm font-semibold text-makina-green">62%</span>
              </div>
              <p className="text-xs text-makina-muted">Positive trending up +5% from last week</p>
            </div>

            {/* Volume */}
            <div className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-makina-accent" />
                <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">
                  Feedback volume
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">148</span>
                <span className="text-xs text-makina-green font-medium">+12%</span>
              </div>
              <p className="text-xs text-makina-muted">submissions this week across all categories</p>
            </div>
          </div>

          {/* Quick wins */}
          <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold">Quick Wins</h2>
              <span className="text-xs text-makina-muted">High-impact, most upvoted feedback</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {quickWins.map((item) => {
                const CatIcon = categoryIcons[item.category];
                const quickAction = item.quickAction
                  ? QUICK_ACTIONS.find((a) => a.id === item.quickAction)
                  : null;
                return (
                  <div
                    key={item.id}
                    className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-3 hover-lift"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 rounded-full bg-makina-surface px-2 py-0.5 text-[10px] font-medium text-makina-muted">
                          <CatIcon size={9} />
                          {item.category}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sentimentColors[item.type]}`}>
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
                      <p className="text-xs text-makina-text/85 leading-relaxed line-clamp-2">
                        {item.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-makina-muted">
                      <span>{item.user.displayName}</span>
                      <span>&middot;</span>
                      <Clock size={10} />
                      <span>{timeAgo(item.timestamp)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
                            <span className="text-[10px] font-medium text-makina-green bg-makina-green/10 rounded-full px-2 py-0.5">
                              Actionable
                            </span>
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
                      <ChevronRight
                        size={16}
                        className={`text-makina-subtle transition-transform shrink-0 ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="border-t border-makina-border/50 bg-makina-surface/50 p-4 space-y-3 animate-fade-in-up">
                        <p className="text-xs text-makina-muted font-medium uppercase tracking-wider">
                          Sample feedback in this theme
                        </p>
                        {theme.items.map((item) => {
                          const quickAction = item.quickAction
                            ? QUICK_ACTIONS.find((a) => a.id === item.quickAction)
                            : null;
                          return (
                            <div
                              key={item.id}
                              className="rounded-md bg-makina-card border border-makina-border p-3 space-y-2"
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-makina-surface text-[10px] font-bold text-makina-accent border border-makina-border">
                                  {item.user.avatar}
                                </div>
                                <span className="text-xs font-medium">{item.user.displayName}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sentimentColors[item.type]}`}>
                                  {item.type}
                                </span>
                                <span className="text-[10px] text-makina-subtle ml-auto">
                                  {timeAgo(item.timestamp)}
                                </span>
                              </div>
                              {quickAction && (
                                <div className="inline-flex items-center gap-1 rounded-md bg-makina-surface px-2 py-1 text-xs">
                                  <span>{quickAction.emoji}</span>
                                  <span className="font-medium">{quickAction.label}</span>
                                </div>
                              )}
                              {item.message && (
                                <p className="text-xs text-makina-text/80 leading-relaxed">
                                  {item.message}
                                </p>
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
              <p className="text-sm text-makina-muted">No themes match this category filter</p>
            </div>
          )}
        </main>
      </div>
    </PasswordGate>
  );
}

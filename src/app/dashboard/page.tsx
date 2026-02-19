"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import LiveFeed from "@/components/LiveFeed";
import { AnalyticsChart } from "@/components/Charts";
import Tooltip from "@/components/Tooltip";
import { type FeedbackItemData } from "@/components/FeedbackCard";
import { Filter, Download, Search, TrendingUp, Users, MessageSquare, Star } from "lucide-react";

type FilterType = "all" | "issue" | "suggestion" | "question";
type CategoryFilter = "all" | "Product" | "UX" | "Support";

interface Stats {
  total: number;
  contributors: number;
  avgRating: number;
  satisfiedPct: number;
  resolutionRate: number;
  feedbackByType: { name: string; value: number; pct: number; color: string }[];
  dailyMetrics: { date: string; submissions: number; satisfaction: number; issues: number; resolved: number }[];
  categoryStats: { id: string; submissions: number; openIssues: number; satisfaction: number }[];
}

export default function DashboardPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<FeedbackItemData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    Promise.all([
      fetch("/api/feedback").then((r) => r.ok ? r.json() : []),
      fetch("/api/stats").then((r) => r.ok ? r.json() : null),
    ]).then(([fb, st]) => {
      if (Array.isArray(fb)) setFeedback(fb);
      if (st && typeof st.total === "number") setStats(st);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleItemUpdate = (updated: FeedbackItemData) => {
    setFeedback((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  };

  const filtered = feedback.filter((f) => {
    if (selectedCategory !== "all" && f.category !== selectedCategory) return false;
    if (filterType !== "all" && f.type !== filterType) return false;
    if (search && !f.message.toLowerCase().includes(search.toLowerCase()) && !f.userName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-center h-[80vh]">
          <div className="text-sm text-makina-muted animate-pulse">Loading dashboard...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4 flex-wrap animate-fade-in-up">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-makina-muted font-medium uppercase tracking-wider">Overview</p>
              <h1 className="text-xl font-bold">Dashboard</h1>
            </div>
            <div className="hidden md:flex items-center gap-4 pl-6 border-l border-makina-border">
              <Tooltip content="Total feedback submissions this period">
                <div className="flex items-center gap-2 cursor-default">
                  <MessageSquare size={13} className="text-makina-muted" />
                  <span className="text-sm font-semibold">{stats?.total ?? 0}</span>
                </div>
              </Tooltip>
              <Tooltip content="Unique contributors who submitted feedback">
                <div className="flex items-center gap-2 cursor-default">
                  <Users size={13} className="text-makina-muted" />
                  <span className="text-sm font-semibold">{stats?.contributors ?? 0}</span>
                </div>
              </Tooltip>
              <Tooltip content="Average rating across all feedback">
                <div className="flex items-center gap-2 cursor-default">
                  <Star size={13} className="text-makina-muted" />
                  <span className="text-sm font-semibold">{stats?.avgRating?.toFixed(1) ?? "0.0"}/5</span>
                </div>
              </Tooltip>
              <Tooltip content="Resolution rate — feedback addressed vs total">
                <div className="flex items-center gap-2 cursor-default">
                  <TrendingUp size={13} className="text-makina-muted" />
                  <span className="text-sm font-semibold">{stats?.resolutionRate ?? 0}%</span>
                </div>
              </Tooltip>
            </div>
          </div>
          <button className="flex items-center gap-2 rounded-md bg-makina-surface border border-makina-border px-3 py-1.5 text-xs text-makina-muted hover:text-makina-text hover:border-makina-subtle transition-colors">
            <Download size={13} />
            Export
          </button>
        </div>

        {/* Analytics chart */}
        <AnalyticsChart data={stats?.dailyMetrics} />

        {/* Type breakdown */}
        {stats && (
          <div className="flex items-center gap-3 rounded-lg bg-makina-card border border-makina-border p-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            {stats.feedbackByType.map((type) => (
              <div key={type.name} className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-makina-text">
                    <span className="h-3 w-3 rounded-full ring-2 ring-makina-card" style={{ backgroundColor: type.color }} />
                    {type.name}
                  </span>
                  <span className="text-xs font-bold" style={{ color: type.color }}>{type.value}</span>
                </div>
                <div className="h-2 rounded-full bg-makina-surface overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${type.pct}%`, backgroundColor: type.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feedback browsing section */}
        <div className="space-y-4">
          {/* Category selector */}
          <div className="flex gap-2 flex-wrap">
            {(["all", "Product", "UX", "Support"] as CategoryFilter[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  selectedCategory === cat
                    ? "bg-makina-accent text-makina-bg"
                    : "bg-makina-card text-makina-muted border border-makina-border hover:border-makina-subtle hover:text-makina-text"
                }`}
              >
                {cat === "all" ? "All" : cat}
                {cat !== "all" && stats && (
                  <span className={`ml-2 text-xs ${selectedCategory === cat ? "text-makina-bg/70" : "text-makina-subtle"}`}>
                    {stats.categoryStats.find((c) => c.id === cat)?.submissions ?? 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Filters row — type only, no status */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-makina-muted">
              <Filter size={14} />
              <span>Type:</span>
            </div>
            <div className="flex gap-1">
              {(["all", "issue", "suggestion", "question"] as FilterType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filterType === type
                      ? "bg-makina-accent text-makina-bg"
                      : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"
                  }`}
                >
                  {type === "all" ? "All types" : type}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-makina-subtle" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search feedback..."
                className="rounded-md bg-makina-card border border-makina-border pl-9 pr-4 py-1.5 text-xs text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50 w-48"
              />
            </div>
          </div>

          <p className="text-xs text-makina-muted">
            Showing {filtered.length} of {feedback.length} feedback items
          </p>

          <LiveFeed
            feedback={filtered}
            category="all"
            onItemUpdate={handleItemUpdate}
          />
        </div>
      </main>
    </div>
  );
}

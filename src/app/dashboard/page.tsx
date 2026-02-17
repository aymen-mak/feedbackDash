"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import CategorySelector from "@/components/VaultSelector";
import LiveFeed from "@/components/LiveFeed";
import { AnalyticsChart } from "@/components/Charts";
import { MOCK_FEEDBACK, FEEDBACK_BY_TYPE, type CategoryId, type FeedbackItem } from "@/lib/mock-data";
import { Filter, Download, Search, TrendingUp, Users, MessageSquare, ThumbsUp } from "lucide-react";

type FilterType = "all" | FeedbackItem["type"];
type FilterStatus = "all" | FeedbackItem["status"];

export default function DashboardPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | "all">("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState(MOCK_FEEDBACK);

  const handleStatusChange = (id: string, status: FeedbackItem["status"]) => {
    setFeedback((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f))
    );
  };

  const filtered = feedback.filter((f) => {
    if (selectedCategory !== "all" && f.category !== selectedCategory) return false;
    if (filterType !== "all" && f.type !== filterType) return false;
    if (filterStatus !== "all" && f.status !== filterStatus) return false;
    if (search && !f.message.toLowerCase().includes(search.toLowerCase()) && !f.user.displayName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header row — compact, integrated */}
        <div className="flex items-center justify-between gap-4 flex-wrap animate-fade-in-up">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-makina-muted font-medium uppercase tracking-wider">Overview</p>
              <h1 className="text-xl font-bold">Dashboard</h1>
            </div>
            {/* Inline compact stats */}
            <div className="hidden md:flex items-center gap-4 pl-6 border-l border-makina-border">
              <div className="flex items-center gap-2">
                <MessageSquare size={13} className="text-makina-muted" />
                <span className="text-sm font-semibold">771</span>
                <span className="text-xs text-makina-green font-medium">+12%</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={13} className="text-makina-muted" />
                <span className="text-sm font-semibold">284</span>
                <span className="text-xs text-makina-green font-medium">+8%</span>
              </div>
              <div className="flex items-center gap-2">
                <ThumbsUp size={13} className="text-makina-muted" />
                <span className="text-sm font-semibold">74%</span>
                <span className="text-xs text-makina-green font-medium">+5</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp size={13} className="text-makina-muted" />
                <span className="text-sm font-semibold">89%</span>
                <span className="text-xs text-makina-red font-medium">-2%</span>
              </div>
            </div>
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-makina-surface border border-makina-border px-3 py-1.5 text-xs text-makina-muted hover:text-makina-text hover:border-makina-subtle transition-colors">
            <Download size={13} />
            Export
          </button>
        </div>

        {/* Main analytics chart */}
        <AnalyticsChart />

        {/* Type breakdown — compact horizontal bar */}
        <div className="flex items-center gap-3 rounded-2xl bg-makina-card border border-makina-border p-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          {FEEDBACK_BY_TYPE.map((type) => (
            <div key={type.name} className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-xs text-makina-muted">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: type.color }} />
                  {type.name}
                </span>
                <span className="text-xs font-semibold">{type.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-makina-surface overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${type.pct}%`, backgroundColor: type.color }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Feedback management section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <CategorySelector selected={selectedCategory} onSelect={setSelectedCategory} />
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-makina-muted">
              <Filter size={14} />
              <span>Filters:</span>
            </div>

            <div className="flex gap-1">
              {(["all", "praise", "issue", "suggestion", "question"] as FilterType[]).map((type) => (
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

            <div className="flex gap-1">
              {(["all", "new", "reviewed", "addressed", "dismissed"] as FilterStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filterStatus === status
                      ? "bg-makina-blue text-white"
                      : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"
                  }`}
                >
                  {status === "all" ? "All statuses" : status}
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
                className="rounded-full bg-makina-card border border-makina-border pl-9 pr-4 py-1.5 text-xs text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50 w-48"
              />
            </div>
          </div>

          <p className="text-xs text-makina-muted">
            Showing {filtered.length} of {feedback.length} feedback items
          </p>

          <LiveFeed
            feedback={filtered}
            category="all"
            showStatus
            onStatusChange={handleStatusChange}
            onReply={(id, msg) => console.log("Reply to", id, ":", msg)}
          />
        </div>
      </main>
    </div>
  );
}

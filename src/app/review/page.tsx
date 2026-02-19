"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import PasswordGate from "@/components/PasswordGate";
import FeedbackCard from "@/components/FeedbackCard";
import Tooltip from "@/components/Tooltip";
import {
  MOCK_FEEDBACK,
  type FeedbackItem,
  type CategoryId,
  type FeedbackType,
  type FeedbackStatus,
} from "@/lib/mock-data";
import {
  Filter,
  Search,
  Inbox,
  Star,
  AlertTriangle,
  Archive,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ArrowUpRight,
  Trash2,
  Tag,
  MessageSquare,
  Users,
  TrendingUp,
} from "lucide-react";

type Priority = "none" | "low" | "medium" | "high";

interface ReviewItem extends FeedbackItem {
  priority: Priority;
  starred: boolean;
  tags: string[];
  escalated: boolean;
  dismissed: boolean;
}

const priorityColors: Record<Priority, string> = {
  none: "text-makina-subtle",
  low: "text-makina-blue",
  medium: "text-amber-400",
  high: "text-makina-red",
};

const priorityLabels: Record<Priority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
};

const PRESET_TAGS = ["actionable", "recurring", "quick-win", "needs-context", "team-blocker"];

// Extend mock data with review-specific fields
const initialReviewItems: ReviewItem[] = MOCK_FEEDBACK.map((item) => ({
  ...item,
  priority: "none" as Priority,
  starred: false,
  tags: [],
  escalated: false,
  dismissed: false,
}));

type ViewFilter = "inbox" | "starred" | "escalated" | "dismissed";

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>(initialReviewItems);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("inbox");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [tagDropdownId, setTagDropdownId] = useState<string | null>(null);

  const updateItem = (id: string, updates: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  };

  const toggleStar = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, starred: !i.starred } : i)));
  };

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedItems.size === filtered.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filtered.map((i) => i.id)));
    }
  };

  const bulkAction = (action: "escalate" | "dismiss" | "priority", value?: Priority) => {
    setItems((prev) =>
      prev.map((i) => {
        if (!selectedItems.has(i.id)) return i;
        if (action === "escalate") return { ...i, escalated: true };
        if (action === "dismiss") return { ...i, dismissed: true };
        if (action === "priority" && value) return { ...i, priority: value };
        return i;
      })
    );
    setSelectedItems(new Set());
  };

  const addTag = (id: string, tag: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id && !i.tags.includes(tag) ? { ...i, tags: [...i.tags, tag] } : i
      )
    );
    setTagDropdownId(null);
  };

  const removeTag = (id: string, tag: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, tags: i.tags.filter((t) => t !== tag) } : i))
    );
  };

  // Apply view filter
  const viewFiltered = items.filter((i) => {
    if (viewFilter === "inbox") return !i.dismissed;
    if (viewFilter === "starred") return i.starred && !i.dismissed;
    if (viewFilter === "escalated") return i.escalated && !i.dismissed;
    if (viewFilter === "dismissed") return i.dismissed;
    return true;
  });

  // Apply type/category/search filters
  const filtered = viewFiltered.filter((i) => {
    if (typeFilter !== "all" && i.type !== typeFilter) return false;
    if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
    if (
      search &&
      !i.message.toLowerCase().includes(search.toLowerCase()) &&
      !i.user.displayName.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  // Stats
  const totalInbox = items.filter((i) => !i.dismissed).length;
  const totalStarred = items.filter((i) => i.starred && !i.dismissed).length;
  const totalEscalated = items.filter((i) => i.escalated && !i.dismissed).length;
  const totalNew = items.filter((i) => i.status === "new" && !i.dismissed).length;

  const viewTabs: { key: ViewFilter; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "inbox", label: "Inbox", count: totalInbox, icon: <Inbox size={14} /> },
    { key: "starred", label: "Starred", count: totalStarred, icon: <Star size={14} /> },
    { key: "escalated", label: "Escalated", count: totalEscalated, icon: <ArrowUpRight size={14} /> },
    { key: "dismissed", label: "Dismissed", count: items.filter((i) => i.dismissed).length, icon: <Archive size={14} /> },
  ];

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
                  Layer 1
                </p>
                <h1 className="text-xl font-bold">Review & Triage</h1>
              </div>
              <div className="hidden md:flex items-center gap-4 pl-6 border-l border-makina-border">
                <Tooltip content="Unread feedback waiting for review">
                  <div className="flex items-center gap-2 cursor-default">
                    <Inbox size={13} className="text-makina-muted" />
                    <span className="text-sm font-semibold">{totalNew}</span>
                    <span className="text-xs text-makina-muted">new</span>
                  </div>
                </Tooltip>
                <Tooltip content="Items flagged for the team">
                  <div className="flex items-center gap-2 cursor-default">
                    <ArrowUpRight size={13} className="text-makina-muted" />
                    <span className="text-sm font-semibold">{totalEscalated}</span>
                    <span className="text-xs text-makina-muted">escalated</span>
                  </div>
                </Tooltip>
                <Tooltip content="Items you starred for follow-up">
                  <div className="flex items-center gap-2 cursor-default">
                    <Star size={13} className="text-makina-muted" />
                    <span className="text-sm font-semibold">{totalStarred}</span>
                    <span className="text-xs text-makina-muted">starred</span>
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* View tabs */}
          <div className="flex items-center gap-1 border-b border-makina-border animate-fade-in-up" style={{ animationDelay: "50ms" }}>
            {viewTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setViewFilter(tab.key); setSelectedItems(new Set()); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  viewFilter === tab.key
                    ? "border-makina-accent text-makina-accent"
                    : "border-transparent text-makina-muted hover:text-makina-text"
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                  viewFilter === tab.key ? "bg-makina-accent-dim text-makina-accent" : "bg-makina-card text-makina-subtle"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center gap-1.5 text-sm text-makina-muted">
              <Filter size={14} />
            </div>

            <div className="flex gap-1">
              {(["all", "praise", "issue", "suggestion", "question"] as (FeedbackType | "all")[]).map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      typeFilter === type
                        ? "bg-makina-accent text-makina-bg"
                        : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"
                    }`}
                  >
                    {type === "all" ? "All types" : type}
                  </button>
                )
              )}
            </div>

            <div className="flex gap-1">
              {(["all", "Product", "UX", "Support"] as (CategoryId | "all")[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    categoryFilter === cat
                      ? "bg-makina-blue text-white"
                      : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"
                  }`}
                >
                  {cat === "all" ? "All categories" : cat}
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

          {/* Bulk actions bar */}
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-makina-accent-dim border border-makina-accent/20 px-4 py-2.5 animate-fade-in-up">
              <span className="text-xs font-semibold text-makina-accent">
                {selectedItems.size} selected
              </span>
              <div className="h-4 w-px bg-makina-accent/20" />
              <button
                onClick={() => bulkAction("escalate")}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-text bg-makina-card border border-makina-border hover:border-makina-accent/40 transition-colors"
              >
                <ArrowUpRight size={12} />
                Escalate to team
              </button>
              <button
                onClick={() => bulkAction("priority", "high")}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-text bg-makina-card border border-makina-border hover:border-amber-400/40 transition-colors"
              >
                <AlertTriangle size={12} />
                Mark high priority
              </button>
              <button
                onClick={() => bulkAction("dismiss")}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-muted bg-makina-card border border-makina-border hover:border-makina-red/40 transition-colors"
              >
                <XCircle size={12} />
                Dismiss
              </button>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="ml-auto text-xs text-makina-muted hover:text-makina-text transition-colors"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Results count + select all */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-makina-muted">
              Showing {filtered.length} items
            </p>
            <button
              onClick={selectAll}
              className="text-xs text-makina-muted hover:text-makina-accent transition-colors"
            >
              {selectedItems.size === filtered.length && filtered.length > 0
                ? "Deselect all"
                : "Select all"}
            </button>
          </div>

          {/* Feedback list */}
          <div className="space-y-2">
            {filtered.map((item, index) => (
              <div
                key={item.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div
                  className={`rounded-lg border transition-colors ${
                    selectedItems.has(item.id)
                      ? "border-makina-accent/40 bg-makina-accent-dim/30"
                      : "border-makina-border bg-makina-card"
                  }`}
                >
                  {/* Review controls bar */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-makina-border/50">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded border-makina-border accent-makina-accent cursor-pointer"
                    />
                    <button
                      onClick={() => toggleStar(item.id)}
                      className={`p-1 rounded transition-colors ${
                        item.starred
                          ? "text-amber-400"
                          : "text-makina-subtle hover:text-amber-400"
                      }`}
                    >
                      <Star size={14} fill={item.starred ? "currentColor" : "none"} />
                    </button>

                    {/* Priority selector */}
                    <select
                      value={item.priority}
                      onChange={(e) => updateItem(item.id, { priority: e.target.value as Priority })}
                      className={`rounded-md bg-transparent border-none text-xs font-medium cursor-pointer focus:outline-none ${priorityColors[item.priority]}`}
                    >
                      {(Object.entries(priorityLabels) as [Priority, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>

                    {/* Tags */}
                    <div className="flex items-center gap-1 ml-2">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full bg-makina-surface px-2 py-0.5 text-[10px] font-medium text-makina-muted"
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(item.id, tag)}
                            className="hover:text-makina-red transition-colors"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <div className="relative">
                        <button
                          onClick={() => setTagDropdownId(tagDropdownId === item.id ? null : item.id)}
                          className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] text-makina-subtle hover:text-makina-muted transition-colors"
                        >
                          <Tag size={10} />
                          <ChevronDown size={8} />
                        </button>
                        {tagDropdownId === item.id && (
                          <div className="absolute top-full left-0 mt-1 rounded-md bg-makina-card border border-makina-border shadow-lg z-20 py-1 min-w-[140px]">
                            {PRESET_TAGS.filter((t) => !item.tags.includes(t)).map((tag) => (
                              <button
                                key={tag}
                                onClick={() => addTag(item.id, tag)}
                                className="block w-full text-left px-3 py-1.5 text-xs text-makina-muted hover:text-makina-text hover:bg-makina-surface transition-colors"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side actions */}
                    <div className="ml-auto flex items-center gap-1">
                      {item.escalated && (
                        <span className="text-[10px] font-medium text-makina-green bg-makina-green/10 rounded-full px-2 py-0.5">
                          Escalated
                        </span>
                      )}
                      <button
                        onClick={() => updateItem(item.id, { escalated: !item.escalated })}
                        className={`p-1.5 rounded-md text-xs transition-colors ${
                          item.escalated
                            ? "text-makina-green hover:text-makina-muted"
                            : "text-makina-subtle hover:text-makina-green"
                        }`}
                        title={item.escalated ? "Remove from team view" : "Escalate to team"}
                      >
                        <ArrowUpRight size={13} />
                      </button>
                      <button
                        onClick={() => updateItem(item.id, { dismissed: true })}
                        className="p-1.5 rounded-md text-makina-subtle hover:text-makina-red transition-colors"
                        title="Dismiss"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* The feedback card itself */}
                  <div className="px-4 py-3">
                    <FeedbackCard
                      item={item}
                      showStatus
                      onStatusChange={(id, status) => updateItem(id, { status })}
                      onReply={(id, msg) => console.log("Reply to", id, ":", msg)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 space-y-3 animate-fade-in-up">
              <Inbox size={32} className="text-makina-subtle mx-auto" />
              <p className="text-sm text-makina-muted">No feedback items match your filters</p>
            </div>
          )}
        </main>
      </div>
    </PasswordGate>
  );
}

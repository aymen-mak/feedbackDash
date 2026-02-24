"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import PasswordGate from "@/components/PasswordGate";
import Tooltip from "@/components/Tooltip";
import { type FeedbackItemData } from "@/components/FeedbackCard";
import {
  AlertTriangle,
  Lightbulb,
  Hash,
  BarChart3,
  ChevronRight,
  Clock,
  Box,
  Paintbrush,
  Archive,
  Trash2,
  RotateCcw,
  ArrowUpRight,
  Star as StarIcon,
  Image as ImageIcon,
  Search,
  Calendar,
  XCircle,
  CheckSquare,
  XSquare,
} from "lucide-react";

type CategoryId = "Product" | "UX";
type DateFilter = "all" | "7d" | "30d" | "oldest";
type Priority = "none" | "low" | "medium" | "high";
type FeedbackStatus = "new" | "reviewed" | "addressed" | "dismissed";

interface TeamItem extends FeedbackItemData {
  priority: Priority;
  escalated: boolean;
  archived: boolean;
  deletedAt: string | null;
  screenshotUrl: string | null;
  rating: number | null;
  acknowledged: boolean;
}

const QUICK_ACTION_LABELS: Record<string, { emoji: string; label: string }> = {
  "love-it": { emoji: "🎉", label: "Love it!" },
  "easy-to-use": { emoji: "✨", label: "Easy to use" },
  "great-support": { emoji: "👏", label: "Great support" },
  "impressive": { emoji: "🤩", label: "Impressive" },
  "helpful": { emoji: "🙌", label: "Helpful" },
  "confusing": { emoji: "😕", label: "Confusing" },
};

const sentimentColors: Record<string, string> = {
  issue: "text-makina-red bg-red-500/10",
  suggestion: "text-makina-blue bg-blue-500/10",
  question: "text-makina-accent bg-makina-accent-dim",
};

const priorityColors: Record<string, string> = {
  high: "bg-red-500/15 text-red-400",
  medium: "bg-amber-400/15 text-amber-400",
  low: "bg-blue-400/15 text-blue-400",
  none: "",
};

const statusColors: Record<FeedbackStatus, string> = {
  new: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  reviewed: "bg-amber-400/15 text-amber-400 border-amber-400/20",
  addressed: "bg-green-500/15 text-green-400 border-green-500/20",
  dismissed: "bg-makina-surface text-makina-muted border-makina-border",
};

const categoryIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Product: Box,
  UX: Paintbrush,
};

const categoryColorClasses: Record<string, string> = {
  Product: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  UX: "bg-violet-500/15 text-violet-400 border border-violet-500/20",
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

interface Stats {
  total: number;
  avgRating: number;
  satisfiedPct: number;
  neutralPct: number;
  unsatisfiedPct: number;
  weeklyVolume: number;
  categoryStats: { id: string; submissions: number; openIssues: number; satisfaction: number }[];
}

type ViewFilter = "active" | "addressed" | "archived" | "deleted";

export default function TeamPage() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | "all">("all");
  const [feedback, setFeedback] = useState<TeamItem[]>([]);
  const [addressedItems, setAddressedItems] = useState<TeamItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<TeamItem[]>([]);
  const [deletedItems, setDeletedItems] = useState<TeamItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const enrichItems = (data: TeamItem[]): TeamItem[] =>
    data.map((item) => ({
      ...item,
      priority: item.priority || ("none" as Priority),
      escalated: item.escalated ?? false,
      archived: item.archived ?? false,
      deletedAt: item.deletedAt ?? null,
      screenshotUrl: item.screenshotUrl ?? null,
      rating: item.rating ?? null,
      acknowledged: item.acknowledged ?? false,
    }));

  useEffect(() => {
    Promise.all([
      fetch("/api/feedback").then((r) => r.ok ? r.json() : []),
      fetch("/api/feedback?view=archived").then((r) => r.ok ? r.json() : []),
      fetch("/api/feedback?view=trash").then((r) => r.ok ? r.json() : []),
      fetch("/api/stats").then((r) => r.ok ? r.json() : null),
    ]).then(([fb, archived, trash, st]) => {
      const allFb = Array.isArray(fb) ? enrichItems(fb as TeamItem[]) : [];
      // Only show escalated items or high-priority issues/suggestions
      const escalated = allFb.filter(
        (f) => f.escalated || ((f.type === "issue" || f.type === "suggestion") && f.upvotes > 10)
      );
      // Split: addressed → addressed tab, dismissed → archived tab, rest → active
      const active = escalated.filter((f) => f.status !== "addressed" && f.status !== "dismissed");
      const addressed = escalated.filter((f) => f.status === "addressed");
      const dismissed = escalated.filter((f) => f.status === "dismissed");
      setFeedback(active);
      setAddressedItems(addressed);

      const archivedEscalated = enrichItems(archived as TeamItem[]).filter((f) => f.escalated);
      setArchivedItems([...dismissed, ...archivedEscalated]);

      const deletedEscalated = enrichItems(trash as TeamItem[]).filter((f) => f.escalated);
      setDeletedItems(deletedEscalated);

      if (st && typeof st.total === "number") setStats(st);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const findItem = (id: string): TeamItem | undefined =>
    feedback.find((i) => i.id === id) ||
    addressedItems.find((i) => i.id === id) ||
    archivedItems.find((i) => i.id === id) ||
    deletedItems.find((i) => i.id === id);

  const removeFromAll = (id: string) => {
    setFeedback((prev) => prev.filter((i) => i.id !== id));
    setAddressedItems((prev) => prev.filter((i) => i.id !== id));
    setArchivedItems((prev) => prev.filter((i) => i.id !== id));
    setDeletedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const patchItem = async (id: string, updates: Partial<TeamItem>) => {
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        // Acknowledged toggle — update in-place across all lists
        if ("acknowledged" in updates && updates.archived === undefined && !updates.deletedAt && !("status" in updates)) {
          const updateList = (prev: TeamItem[]) =>
            prev.map((i) => (i.id === id ? { ...i, ...updates } : i));
          setFeedback(updateList);
          setAddressedItems(updateList);
          setArchivedItems(updateList);
          setDeletedItems(updateList);
          return;
        }

        const item = findItem(id);
        if (!item) return;
        const merged = { ...item, ...updates };

        // Deletion takes priority
        if (updates.deletedAt) {
          removeFromAll(id);
          setDeletedItems((prev) => [merged, ...prev]);
          return;
        }
        // Restore from trash
        if (updates.deletedAt === null) {
          removeFromAll(id);
          setFeedback((prev) => [{ ...merged, deletedAt: null }, ...prev]);
          return;
        }
        // Archive (or dismiss → archive)
        if (updates.archived === true || (updates as { status?: string }).status === "dismissed") {
          removeFromAll(id);
          setArchivedItems((prev) => [merged, ...prev]);
          return;
        }
        // Restore from archive
        if (updates.archived === false) {
          removeFromAll(id);
          setFeedback((prev) => [{ ...merged, archived: false }, ...prev]);
          return;
        }
        // Status change to addressed → move to addressed tab
        if ((updates as { status?: string }).status === "addressed") {
          removeFromAll(id);
          setAddressedItems((prev) => [merged, ...prev]);
          return;
        }
        // Any other status change (e.g. back to "new"/"reviewed") → move to active
        if ("status" in updates) {
          removeFromAll(id);
          setFeedback((prev) => [merged, ...prev]);
          return;
        }
        // Default: update in-place
        const updateList = (prev: TeamItem[]) =>
          prev.map((i) => (i.id === id ? merged : i));
        setFeedback(updateList);
        setAddressedItems(updateList);
        setArchivedItems(updateList);
        setDeletedItems(updateList);
      }
    } catch { /* ignore */ }
  };

  const permanentlyDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeletedItems((prev) => prev.filter((i) => i.id !== id));
      }
    } catch { /* ignore */ }
  };

  // Sort: high priority first, then issues first, then by upvotes
  const sortItems = (list: TeamItem[]) =>
    [...list].sort((a, b) => {
      const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
      const pa = pOrder[a.priority] ?? 3;
      const pb = pOrder[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      const typeOrder: Record<string, number> = { issue: 0, suggestion: 1, question: 2 };
      const ta = typeOrder[a.type] ?? 3;
      const tb = typeOrder[b.type] ?? 3;
      if (ta !== tb) return ta - tb;
      return b.upvotes - a.upvotes;
    });

  const getCurrentList = (): TeamItem[] => {
    if (viewFilter === "addressed") return addressedItems;
    if (viewFilter === "archived") return archivedItems;
    if (viewFilter === "deleted") return deletedItems;
    return feedback;
  };

  const currentList = getCurrentList();
  const filteredItems = currentList.filter((i) => {
    if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
    if (search && !i.message.toLowerCase().includes(search.toLowerCase()) && !i.userName.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFilter === "7d" && Date.now() - new Date(i.createdAt).getTime() > 7 * 86400000) return false;
    if (dateFilter === "30d" && Date.now() - new Date(i.createdAt).getTime() > 30 * 86400000) return false;
    return true;
  });
  const sortedItems = dateFilter === "oldest"
    ? [...filteredItems].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : sortItems(filteredItems);

  const urgentCount = feedback.filter((f) => f.priority === "high" || f.type === "issue").length;
  const actionableCount = feedback.filter((f) => f.type === "issue" || f.type === "suggestion").length;
  const topCategory = stats?.categoryStats.reduce((a, b) => (a.openIssues > b.openIssues ? a : b), stats.categoryStats[0]);

  if (loading) {
    return (
      <PasswordGate>
        <div className="min-h-screen">
          <Navbar />
          <main className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-center h-[80vh]">
            <div className="text-sm text-makina-muted animate-pulse">Loading team board...</div>
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
                <p className="text-xs text-makina-muted font-medium uppercase tracking-wider">Action Required</p>
                <h1 className="text-xl font-bold">Team Board</h1>
              </div>
              <div className="hidden md:flex items-center gap-4 pl-6 border-l border-makina-border">
                <Tooltip content="Feedback items escalated from review">
                  <div className="flex items-center gap-2 cursor-default">
                    <ArrowUpRight size={13} className="text-makina-muted" />
                    <span className="text-sm font-semibold">{feedback.length}</span>
                    <span className="text-xs text-makina-muted">escalated</span>
                  </div>
                </Tooltip>
                <Tooltip content="Urgent items needing immediate attention">
                  <div className="flex items-center gap-2 cursor-default">
                    <AlertTriangle size={13} className="text-makina-red" />
                    <span className="text-sm font-semibold text-makina-red">{urgentCount}</span>
                    <span className="text-xs text-makina-red">urgent</span>
                  </div>
                </Tooltip>
                <Tooltip content="Items that can be acted on">
                  <div className="flex items-center gap-2 cursor-default">
                    <CheckSquare size={13} className="text-makina-green" />
                    <span className="text-sm font-semibold">{actionableCount}</span>
                    <span className="text-xs text-makina-green">actionable</span>
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Urgent banner -- only if there are high priority items */}
          {feedback.some((f) => f.priority === "high") && viewFilter === "active" && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 flex items-center gap-3 animate-fade-in-up">
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-400">
                  {feedback.filter((f) => f.priority === "high").length} high-priority item(s) need attention
                </p>
                <p className="text-xs text-makina-muted mt-0.5">These have been flagged as urgent during review triage</p>
              </div>
            </div>
          )}

          {/* View tabs + category filter */}
          <div className="flex items-center justify-between gap-4 flex-wrap animate-fade-in-up" style={{ animationDelay: "50ms" }}>
            <div className="flex items-center gap-1 border-b border-makina-border">
              {([
                { key: "active" as ViewFilter, label: "Active", count: feedback.length },
                { key: "addressed" as ViewFilter, label: "Addressed", count: addressedItems.length },
                { key: "archived" as ViewFilter, label: "Archived", count: archivedItems.length },
                { key: "deleted" as ViewFilter, label: "Deleted", count: deletedItems.length },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setViewFilter(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    viewFilter === tab.key
                      ? "border-makina-accent text-makina-accent"
                      : "border-transparent text-makina-muted hover:text-makina-text"
                  }`}
                >
                  {tab.key === "addressed" && <CheckSquare size={14} />}
                  {tab.key === "archived" && <Archive size={14} />}
                  {tab.key === "deleted" && <Trash2 size={14} />}
                  {tab.label}
                  <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                    viewFilter === tab.key ? "bg-makina-accent-dim text-makina-accent" : "bg-makina-card text-makina-subtle"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1">
                {(["all", "Product", "UX"] as (CategoryId | "all")[]).map((cat) => (
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
              <div className="flex items-center gap-1.5 text-sm text-makina-muted">
                <Calendar size={14} />
              </div>
              <div className="flex gap-1">
                {([["all", "All time"], ["7d", "7 days"], ["30d", "30 days"], ["oldest", "Oldest"]] as [DateFilter, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setDateFilter(val)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      dateFilter === val
                        ? "bg-makina-accent text-makina-bg"
                        : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
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
          </div>

          {/* Deleted notice */}
          {viewFilter === "deleted" && deletedItems.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-400">
              Items in Deleted are automatically removed after 30 days.
            </div>
          )}

          {/* Feedback items -- flat list, sorted by urgency */}
          <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            {sortedItems.map((item) => {
              const CatIcon = categoryIcons[item.category] || Box;
              const quickAction = item.quickAction ? QUICK_ACTION_LABELS[item.quickAction] : null;
              const isExpanded = expandedId === item.id;
              const isUrgent = item.priority === "high" || item.type === "issue";

              return (
                <div
                  key={item.id}
                  className={`rounded-lg border overflow-hidden transition-colors ${
                    item.priority === "high"
                      ? "border-red-500/30 bg-makina-card"
                      : item.type === "issue"
                      ? "border-amber-500/20 bg-makina-card"
                      : "border-makina-border bg-makina-card"
                  }`}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-makina-card-hover transition-colors"
                  >
                    {/* Priority indicator */}
                    <div className={`w-1 self-stretch rounded-full shrink-0 ${
                      item.priority === "high" ? "bg-red-500" :
                      item.priority === "medium" ? "bg-amber-400" :
                      item.priority === "low" ? "bg-blue-400" :
                      item.type === "issue" ? "bg-amber-500/50" :
                      "bg-makina-border"
                    }`} />

                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-makina-surface text-xs font-bold text-makina-accent border border-makina-border shrink-0">
                      {item.userAvatar}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{item.userName}</span>
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${categoryColorClasses[item.category] || "bg-makina-surface text-makina-muted border border-makina-border"}`}>
                          <CatIcon size={9} />
                          {item.category}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sentimentColors[item.type] || ""}`}>
                          {item.type}
                        </span>
                        {item.priority !== "none" && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityColors[item.priority]}`}>
                            {item.priority}
                          </span>
                        )}
                        {isUrgent && item.priority !== "high" && (
                          <AlertTriangle size={12} className="text-amber-400" />
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize border ${statusColors[item.status] || ""}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-makina-text/80 mt-1 truncate">
                        {quickAction ? `${quickAction.emoji} ${quickAction.label}` : ""}
                        {quickAction && item.message ? " — " : ""}
                        {item.message}
                      </p>
                    </div>

                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-makina-muted">
                        <Clock size={10} className="inline mr-1" />
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>

                    <ChevronRight size={16} className={`text-makina-subtle transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-makina-border/50 bg-makina-surface/50 p-4 space-y-3 animate-fade-in-up">
                      {quickAction && (
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-makina-surface px-3 py-1.5 text-sm">
                          <span>{quickAction.emoji}</span>
                          <span className="font-medium">{quickAction.label}</span>
                        </div>
                      )}
                      {item.message && (
                        <p className="text-sm text-makina-text/85 leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>{item.message}</p>
                      )}

                      {/* Rating as stars */}
                      {item.rating != null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-makina-muted mr-1">Rating</span>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <StarIcon
                              key={star}
                              size={14}
                              className={star <= item.rating! ? "text-amber-400 fill-amber-400" : "text-makina-subtle"}
                            />
                          ))}
                        </div>
                      )}

                      {/* Screenshot thumbnail */}
                      {item.screenshotUrl && (
                        <div className="pt-1">
                          <div className="flex items-center gap-1.5 text-xs text-makina-muted mb-1.5">
                            <ImageIcon size={12} />
                            Screenshot
                          </div>
                          <a href={item.screenshotUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={item.screenshotUrl}
                              alt="Screenshot"
                              className="rounded-md border border-makina-border max-w-xs max-h-40 object-cover hover:opacity-80 transition-opacity"
                            />
                          </a>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 flex-wrap">
                        <span className="text-xs text-makina-muted">{item.userName} &middot; {timeAgo(item.createdAt)}</span>

                        {/* Status indicator */}
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize border ${statusColors[item.status] || ""}`}>
                          {item.status}
                        </span>

                        <div className="ml-auto flex items-center gap-1.5">
                          {(viewFilter === "active" || viewFilter === "addressed") && (
                            <>
                              {/* Status action buttons */}
                              {viewFilter === "active" && (
                                <Tooltip content="Mark as addressed">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); patchItem(item.id, { status: "addressed" as FeedbackStatus }); }}
                                    className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors text-makina-muted bg-makina-surface border-makina-border hover:text-green-400 hover:bg-green-500/10 hover:border-green-500/20"
                                  >
                                    <CheckSquare size={14} />
                                    Addressed
                                  </button>
                                </Tooltip>
                              )}
                              <Tooltip content="Dismiss feedback">
                                <button
                                  onClick={(e) => { e.stopPropagation(); patchItem(item.id, { status: "dismissed" as FeedbackStatus }); }}
                                  className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors text-makina-muted bg-makina-surface border-makina-border hover:text-makina-muted hover:bg-makina-surface/80"
                                >
                                  <XSquare size={14} />
                                  Dismiss
                                </button>
                              </Tooltip>

                              <span className="w-px h-5 bg-makina-border mx-0.5" />

                              <Tooltip content="Archive">
                                <button
                                  onClick={(e) => { e.stopPropagation(); patchItem(item.id, { archived: true }); }}
                                  className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-makina-muted bg-blue-500/10 border border-blue-500/20 hover:text-makina-blue hover:bg-blue-500/20"
                                >
                                  <Archive size={14} />
                                  Archive
                                </button>
                              </Tooltip>
                              <Tooltip content="Move to deleted">
                                <button
                                  onClick={(e) => { e.stopPropagation(); patchItem(item.id, { deletedAt: new Date().toISOString() }); }}
                                  className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-makina-muted bg-red-500/10 border border-red-500/20 hover:text-makina-red hover:bg-red-500/20"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </Tooltip>
                            </>
                          )}
                          {(viewFilter === "archived" || viewFilter === "deleted") && (
                            <>
                              <Tooltip content="Restore">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (viewFilter === "archived") patchItem(item.id, { archived: false });
                                    else patchItem(item.id, { deletedAt: null });
                                  }}
                                  className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-makina-muted bg-green-500/10 border border-green-500/20 hover:text-makina-green hover:bg-green-500/20"
                                >
                                  <RotateCcw size={14} />
                                  Restore
                                </button>
                              </Tooltip>
                              {viewFilter === "deleted" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); permanentlyDelete(item.id); }}
                                  className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-500"
                                >
                                  <XCircle size={14} />
                                  Delete forever
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sortedItems.length === 0 && (
            <div className="text-center py-16 space-y-3 animate-fade-in-up">
              {viewFilter === "deleted" ? (
                <>
                  <Trash2 size={32} className="text-makina-subtle mx-auto" />
                  <p className="text-sm text-makina-muted">Deleted is empty</p>
                </>
              ) : viewFilter === "archived" ? (
                <>
                  <Archive size={32} className="text-makina-subtle mx-auto" />
                  <p className="text-sm text-makina-muted">No archived items</p>
                </>
              ) : viewFilter === "addressed" ? (
                <>
                  <CheckSquare size={32} className="text-makina-subtle mx-auto" />
                  <p className="text-sm text-makina-muted">No addressed items yet</p>
                </>
              ) : (
                <>
                  <Hash size={32} className="text-makina-subtle mx-auto" />
                  <p className="text-sm text-makina-muted">
                    {feedback.length === 0
                      ? "No feedback has been escalated yet. Use the Review page to escalate items."
                      : "No items match this category filter"}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Stats section -- pushed to bottom */}
          {stats && viewFilter === "active" && (
            <div className="space-y-3 pt-4 border-t border-makina-border animate-fade-in-up" style={{ animationDelay: "150ms" }}>
              <h2 className="text-xs font-medium text-makina-muted uppercase tracking-wider">Context</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">Satisfaction</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex h-2 rounded-full overflow-hidden">
                        <div className="bg-makina-green" style={{ width: `${stats.satisfiedPct}%` }} />
                        <div className="bg-makina-blue" style={{ width: `${stats.neutralPct}%` }} />
                        <div className="bg-amber-500" style={{ width: `${stats.unsatisfiedPct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <StarIcon size={12} className="text-amber-400 fill-amber-400" />
                      <span className="text-sm font-semibold">{stats.avgRating?.toFixed(1) ?? "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb size={14} className="text-makina-accent" />
                    <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">This week</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{stats.weeklyVolume}</span>
                  </div>
                  <p className="text-xs text-makina-muted">total submissions</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </PasswordGate>
  );
}

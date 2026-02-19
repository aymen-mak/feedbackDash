"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import PasswordGate from "@/components/PasswordGate";
import FeedbackCard, { type FeedbackItemData } from "@/components/FeedbackCard";
import Tooltip from "@/components/Tooltip";
import {
  Filter,
  Search,
  Inbox,
  Star,
  AlertTriangle,
  Archive,
  Trash2,
  Tag,
  ChevronDown,
  ArrowUpRight,
  RotateCcw,
  CheckCircle2,
  Image as ImageIcon,
} from "lucide-react";

type Priority = "none" | "low" | "medium" | "high";
type FeedbackType = "issue" | "suggestion" | "question";
type CategoryId = "Product" | "UX" | "Support";

interface ReviewItem extends FeedbackItemData {
  priority: Priority;
  starred: boolean;
  tags: string[];
  escalated: boolean;
  dismissed: boolean;
  archived: boolean;
  deletedAt: string | null;
  screenshotUrl: string | null;
  rating: number | null;
  acknowledged: boolean;
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

type ViewFilter = "inbox" | "starred" | "escalated" | "archived" | "trash";

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={11}
          className={s <= rating ? "text-amber-400" : "text-makina-subtle/40"}
          fill={s <= rating ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<ReviewItem[]>([]);
  const [trashItems, setTrashItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("inbox");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [tagDropdownId, setTagDropdownId] = useState<string | null>(null);
  const [deleteActiveId, setDeleteActiveId] = useState<string | null>(null);

  const enrichItems = (data: ReviewItem[]): ReviewItem[] =>
    data.map((item) => ({
      ...item,
      priority: item.priority || ("none" as Priority),
      starred: item.starred ?? false,
      tags: item.tags || [],
      escalated: item.escalated ?? false,
      dismissed: item.dismissed ?? false,
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
    ]).then(([active, archived, trash]) => {
      setItems(enrichItems(active));
      setArchivedItems(enrichItems(archived));
      setTrashItems(enrichItems(trash));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const patchItem = async (id: string, updates: Partial<ReviewItem>) => {
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        // If archiving, move from active to archived
        if (updates.archived === true) {
          setItems((prev) => prev.filter((i) => i.id !== id));
          setArchivedItems((prev) => [{ ...updated, ...updates }, ...prev]);
        }
        // If deleting (soft), move to trash
        else if (updates.deletedAt) {
          setItems((prev) => prev.filter((i) => i.id !== id));
          setArchivedItems((prev) => prev.filter((i) => i.id !== id));
          setTrashItems((prev) => [{ ...updated, ...updates }, ...prev]);
        }
        // If restoring from archive
        else if (updates.archived === false) {
          setArchivedItems((prev) => prev.filter((i) => i.id !== id));
          setItems((prev) => [{ ...updated, ...updates }, ...prev]);
        }
        // If restoring from trash
        else if (updates.deletedAt === null && !updates.archived) {
          setTrashItems((prev) => prev.filter((i) => i.id !== id));
          setItems((prev) => [{ ...updated, deletedAt: null }, ...prev]);
        }
        // Normal update
        else {
          setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
        }
      }
    } catch { /* ignore */ }
  };

  const toggleStar = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item) patchItem(id, { starred: !item.starred });
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
    if (selectedItems.size === currentList.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(currentList.map((i) => i.id)));
    }
  };

  const bulkAction = async (action: "escalate" | "dismiss" | "priority" | "archive" | "delete", value?: Priority) => {
    const ids = [...selectedItems];
    let updates: Partial<ReviewItem> = {};
    if (action === "escalate") updates = { escalated: true };
    else if (action === "dismiss") updates = { dismissed: true };
    else if (action === "priority" && value) updates = { priority: value };
    else if (action === "archive") updates = { archived: true };
    else if (action === "delete") updates = { deletedAt: new Date().toISOString() };

    await Promise.all(ids.map((id) => patchItem(id, updates)));
    setSelectedItems(new Set());
  };

  const addTag = (id: string, tag: string) => {
    const item = items.find((i) => i.id === id);
    if (item && !item.tags.includes(tag)) {
      patchItem(id, { tags: [...item.tags, tag] });
    }
    setTagDropdownId(null);
  };

  const removeTag = (id: string, tag: string) => {
    const item = items.find((i) => i.id === id);
    if (item) {
      patchItem(id, { tags: item.tags.filter((t) => t !== tag) });
    }
  };

  // Get the list for the current view
  const getViewList = (): ReviewItem[] => {
    if (viewFilter === "archived") return archivedItems;
    if (viewFilter === "trash") return trashItems;
    if (viewFilter === "starred") return items.filter((i) => i.starred && !i.dismissed);
    if (viewFilter === "escalated") return items.filter((i) => i.escalated && !i.dismissed);
    // inbox: not dismissed
    return items.filter((i) => !i.dismissed);
  };

  const viewList = getViewList();

  // Apply type/category/search filters
  const currentList = viewList.filter((i) => {
    if (typeFilter !== "all" && i.type !== typeFilter) return false;
    if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
    if (
      search &&
      !i.message.toLowerCase().includes(search.toLowerCase()) &&
      !i.userName.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  // Sort: high priority first, then by date
  const sorted = [...currentList].sort((a, b) => {
    const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
    const pa = pOrder[a.priority] ?? 3;
    const pb = pOrder[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Group items for inbox view: "New feedback", "High priority", then the rest
  const newItems = viewFilter === "inbox" ? sorted.filter((i) => i.status === "new" && i.priority !== "high") : [];
  const highPriorityItems = viewFilter === "inbox" ? sorted.filter((i) => i.priority === "high" && i.status !== "new") : [];
  const remainingItems = viewFilter === "inbox"
    ? sorted.filter((i) => !(i.status === "new" && i.priority !== "high") && !(i.priority === "high" && i.status !== "new"))
    : sorted;
  // Items that are both new AND high priority go into high priority section
  const newAndHighItems = viewFilter === "inbox" ? sorted.filter((i) => i.status === "new" && i.priority === "high") : [];
  const highPriorityCombined = [...newAndHighItems, ...highPriorityItems];

  const totalInbox = items.filter((i) => !i.dismissed).length;
  const totalStarred = items.filter((i) => i.starred && !i.dismissed).length;
  const totalEscalated = items.filter((i) => i.escalated && !i.dismissed).length;
  const totalNew = items.filter((i) => i.status === "new" && !i.dismissed).length;

  const viewTabs: { key: ViewFilter; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "inbox", label: "Inbox", count: totalInbox, icon: <Inbox size={14} /> },
    { key: "starred", label: "Starred", count: totalStarred, icon: <Star size={14} /> },
    { key: "escalated", label: "Escalated", count: totalEscalated, icon: <ArrowUpRight size={14} /> },
    { key: "archived", label: "Archived", count: archivedItems.length, icon: <Archive size={14} /> },
    { key: "trash", label: "Deleted", count: trashItems.length, icon: <Trash2 size={14} /> },
  ];

  const allSelected = selectedItems.size === sorted.length && sorted.length > 0;

  const handleDeleteClick = (itemId: string) => {
    setDeleteActiveId(itemId);
    patchItem(itemId, { deletedAt: new Date().toISOString() });
    setTimeout(() => setDeleteActiveId(null), 300);
  };

  const renderFeedbackItem = (item: ReviewItem, index: number) => (
    <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 40}ms` }}>
      <div className={`rounded-lg border transition-colors ${
        selectedItems.has(item.id)
          ? "border-makina-accent/40 bg-makina-accent-dim/30"
          : item.priority === "high"
          ? "border-red-500/30 bg-makina-card"
          : "border-makina-border bg-makina-card"
      }`}>
        {/* Review controls bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-makina-border/50">
          <input
            type="checkbox"
            checked={selectedItems.has(item.id)}
            onChange={() => toggleSelect(item.id)}
            className="rounded border-makina-border accent-makina-accent cursor-pointer"
          />

          {viewFilter !== "trash" && viewFilter !== "archived" && (
            <>
              <button
                onClick={() => toggleStar(item.id)}
                className={`p-1.5 rounded-md transition-colors ${item.starred ? "text-amber-400 bg-amber-400/10" : "text-makina-subtle hover:text-amber-400 hover:bg-amber-400/10"}`}
                title={item.starred ? "Unstar" : "Star for follow-up"}
              >
                <Star size={14} fill={item.starred ? "currentColor" : "none"} />
              </button>
              <select
                value={item.priority}
                onChange={(e) => patchItem(item.id, { priority: e.target.value as Priority })}
                className={`rounded-md bg-transparent border-none text-xs font-medium cursor-pointer focus:outline-none ${priorityColors[item.priority]}`}
              >
                {(Object.entries(priorityLabels) as [Priority, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <div className="flex items-center gap-1 ml-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-makina-surface px-2 py-0.5 text-[10px] font-medium text-makina-muted">
                    {tag}
                    <button onClick={() => removeTag(item.id, tag)} className="hover:text-makina-red transition-colors">x</button>
                  </span>
                ))}
                <div className="relative">
                  <button
                    onClick={() => setTagDropdownId(tagDropdownId === item.id ? null : item.id)}
                    className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] text-makina-subtle hover:text-makina-muted hover:bg-makina-surface transition-colors"
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
            </>
          )}

          {/* Action buttons -- right side */}
          <div className="ml-auto flex items-center gap-1.5">
            {item.acknowledged && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-makina-blue bg-makina-blue/10 rounded-full px-2 py-0.5">
                <CheckCircle2 size={10} />
                Acknowledged
              </span>
            )}

            {item.escalated && viewFilter !== "trash" && viewFilter !== "archived" && (
              <span className="text-[10px] font-medium text-makina-green bg-makina-green/10 rounded-full px-2 py-0.5">Escalated</span>
            )}

            {viewFilter !== "trash" && viewFilter !== "archived" && (
              <>
                <Tooltip content={item.escalated ? "Remove from team" : "Escalate to team"}>
                  <button
                    onClick={() => patchItem(item.id, { escalated: !item.escalated })}
                    className={`p-2 rounded-md text-xs transition-colors ${item.escalated ? "text-makina-green bg-makina-green/10 hover:bg-makina-green/20" : "text-makina-subtle bg-makina-surface hover:text-makina-green hover:bg-makina-green/10"}`}
                  >
                    <ArrowUpRight size={15} />
                  </button>
                </Tooltip>
                <Tooltip content="Archive">
                  <button
                    onClick={() => patchItem(item.id, { archived: true })}
                    className="p-2 rounded-md text-makina-subtle bg-makina-surface hover:text-makina-blue hover:bg-blue-500/10 transition-colors"
                  >
                    <Archive size={15} />
                  </button>
                </Tooltip>
                <Tooltip content="Move to deleted">
                  <button
                    onClick={() => handleDeleteClick(item.id)}
                    className={`p-2 rounded-md transition-all ${
                      deleteActiveId === item.id
                        ? "text-white bg-makina-red scale-95"
                        : "text-makina-subtle bg-makina-surface hover:text-makina-red hover:bg-red-500/10"
                    }`}
                  >
                    <Trash2 size={15} />
                  </button>
                </Tooltip>
              </>
            )}

            {/* Restore buttons for archived/deleted views */}
            {(viewFilter === "archived" || viewFilter === "trash") && (
              <button
                onClick={() => {
                  if (viewFilter === "archived") patchItem(item.id, { archived: false });
                  else patchItem(item.id, { deletedAt: null });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
              >
                <RotateCcw size={13} />
                Restore
              </button>
            )}
          </div>
        </div>

        {/* Card body */}
        <div className="px-4 py-3">
          {/* Type/category badges on separate line */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              item.type === "issue" ? "bg-red-500/15 text-red-400" :
              item.type === "suggestion" ? "bg-blue-500/15 text-blue-400" :
              item.type === "question" ? "bg-makina-accent-dim text-makina-accent" :
              "bg-makina-surface text-makina-muted"
            }`}>
              {item.type}
            </span>
            <span className="rounded-full bg-makina-surface px-2 py-0.5 text-[10px] font-medium text-makina-muted">
              {item.category}
            </span>
            {item.rating !== null && item.rating !== undefined && (
              <RatingStars rating={item.rating} />
            )}
          </div>

          {/* Screenshot thumbnail */}
          {item.screenshotUrl && (
            <div className="mb-2">
              <a href={item.screenshotUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 group/img">
                <div className="relative w-16 h-16 rounded-md overflow-hidden border border-makina-border hover:border-makina-accent/50 transition-colors">
                  <img
                    src={item.screenshotUrl}
                    alt="Screenshot"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                    <ImageIcon size={14} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                  </div>
                </div>
              </a>
            </div>
          )}

          <FeedbackCard
            item={item}
            showStatus
            onStatusChange={(id, status) => patchItem(id, { status })}
            onItemUpdate={(updated) => setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } as ReviewItem : i)))}
          />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <PasswordGate>
        <div className="min-h-screen">
          <Navbar />
          <main className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-center h-[80vh]">
            <div className="text-sm text-makina-muted animate-pulse">Loading review inbox...</div>
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
                <p className="text-xs text-makina-muted font-medium uppercase tracking-wider">Triage</p>
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

          {/* Deleted notice */}
          {viewFilter === "trash" && trashItems.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-400">
              Items in Deleted are automatically removed after 30 days.
            </div>
          )}

          {/* Filters row -- shown for all views */}
          <div className="flex flex-wrap items-center gap-2 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            {viewFilter !== "trash" && viewFilter !== "archived" && (
              <>
                <div className="flex items-center gap-1.5 text-sm text-makina-muted">
                  <Filter size={14} />
                </div>
                <div className="flex gap-1">
                  {(["all", "issue", "suggestion", "question"] as (FeedbackType | "all")[]).map((type) => (
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
                  ))}
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
              </>
            )}
            <div className={`relative ${viewFilter === "trash" || viewFilter === "archived" ? "" : "ml-auto"}`}>
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
              <span className="text-xs font-semibold text-makina-accent">{selectedItems.size} selected</span>
              <div className="h-4 w-px bg-makina-accent/20" />
              {viewFilter !== "trash" && viewFilter !== "archived" && (
                <>
                  <button onClick={() => bulkAction("escalate")} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-text bg-makina-card border border-makina-border hover:border-makina-accent/40 transition-colors">
                    <ArrowUpRight size={12} />
                    Escalate
                  </button>
                  <button onClick={() => bulkAction("priority", "high")} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-text bg-makina-card border border-makina-border hover:border-amber-400/40 transition-colors">
                    <AlertTriangle size={12} />
                    High priority
                  </button>
                  <button onClick={() => bulkAction("archive")} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-text bg-makina-card border border-makina-border hover:border-makina-blue/40 transition-colors">
                    <Archive size={12} />
                    Archive
                  </button>
                </>
              )}
              <button onClick={() => bulkAction("delete")} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-muted bg-makina-card border border-makina-border hover:border-makina-red/40 transition-colors">
                <Trash2 size={12} />
                Delete
              </button>
              <button onClick={() => setSelectedItems(new Set())} className="ml-auto text-xs text-makina-muted hover:text-makina-text transition-colors">
                Clear
              </button>
            </div>
          )}

          {/* Results count + select all */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-makina-muted">Showing {sorted.length} items</p>
            <button
              onClick={selectAll}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors border ${
                allSelected
                  ? "bg-makina-accent text-makina-bg border-makina-accent"
                  : "bg-makina-card text-makina-muted border-makina-border hover:border-makina-accent/40 hover:text-makina-text"
              }`}
            >
              <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border text-[9px] font-bold leading-none ${
                allSelected
                  ? "bg-white text-makina-accent border-white"
                  : "border-makina-subtle"
              }`}>
                {allSelected ? "\u2713" : ""}
              </span>
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          {/* Feedback list */}
          <div className="space-y-2">
            {viewFilter === "inbox" ? (
              <>
                {/* New feedback section */}
                {newItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pt-2 pb-1">
                      <Inbox size={13} className="text-makina-accent" />
                      <h3 className="text-xs font-semibold text-makina-accent uppercase tracking-wider">New feedback</h3>
                      <span className="text-[10px] text-makina-muted bg-makina-accent-dim rounded-full px-1.5 py-0.5">{newItems.length}</span>
                      <div className="flex-1 h-px bg-makina-border ml-2" />
                    </div>
                    {newItems.map((item, index) => renderFeedbackItem(item, index))}
                  </div>
                )}

                {/* High priority section */}
                {highPriorityCombined.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pt-4 pb-1">
                      <AlertTriangle size={13} className="text-makina-red" />
                      <h3 className="text-xs font-semibold text-makina-red uppercase tracking-wider">High priority</h3>
                      <span className="text-[10px] text-makina-muted bg-red-500/10 rounded-full px-1.5 py-0.5">{highPriorityCombined.length}</span>
                      <div className="flex-1 h-px bg-makina-border ml-2" />
                    </div>
                    {highPriorityCombined.map((item, index) => renderFeedbackItem(item, newItems.length + index))}
                  </div>
                )}

                {/* Remaining items */}
                {remainingItems.length > 0 && (
                  <div className="space-y-2">
                    {(newItems.length > 0 || highPriorityCombined.length > 0) && (
                      <div className="flex items-center gap-2 pt-4 pb-1">
                        <h3 className="text-xs font-semibold text-makina-muted uppercase tracking-wider">All other</h3>
                        <span className="text-[10px] text-makina-muted bg-makina-surface rounded-full px-1.5 py-0.5">{remainingItems.length}</span>
                        <div className="flex-1 h-px bg-makina-border ml-2" />
                      </div>
                    )}
                    {remainingItems.map((item, index) => renderFeedbackItem(item, newItems.length + highPriorityCombined.length + index))}
                  </div>
                )}
              </>
            ) : (
              sorted.map((item, index) => renderFeedbackItem(item, index))
            )}
          </div>

          {sorted.length === 0 && (
            <div className="text-center py-16 space-y-3 animate-fade-in-up">
              {viewFilter === "trash" ? (
                <>
                  <Trash2 size={32} className="text-makina-subtle mx-auto" />
                  <p className="text-sm text-makina-muted">Deleted is empty</p>
                </>
              ) : viewFilter === "archived" ? (
                <>
                  <Archive size={32} className="text-makina-subtle mx-auto" />
                  <p className="text-sm text-makina-muted">No archived items</p>
                </>
              ) : (
                <>
                  <Inbox size={32} className="text-makina-subtle mx-auto" />
                  <p className="text-sm text-makina-muted">No feedback items match your filters</p>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </PasswordGate>
  );
}

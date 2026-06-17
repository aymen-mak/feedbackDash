"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "@/components/Navbar";
import ReviewerNamePrompt from "@/components/ReviewerNamePrompt";
import FeedbackCard, { type FeedbackItemData } from "@/components/FeedbackCard";
import { AnalyticsChart } from "@/components/Charts";
import Tooltip from "@/components/Tooltip";
import { useLoadingBar } from "@/components/LoadingBar";
import { useNotifications } from "@/components/Notifications";
import { useReviewer } from "@/lib/reviewer";
import {
  Filter,
  Search,
  Inbox,
  Pin,
  AlertTriangle,
  Archive,
  Trash2,
  Tag,
  ChevronDown,
  ArrowUpRight,
  RotateCcw,
  Calendar,
  XCircle,
  RefreshCw,
} from "lucide-react";

type Priority = "none" | "low" | "medium" | "high";
type CategoryId = "Core" | "UI/UX" | "App" | "Operator CLI";
type DateFilter = "newest" | "oldest";
type ArchiveSubFilter = "all" | "dismissed" | "addressed";

interface ReviewItem extends FeedbackItemData {
  priority: Priority;
  starred: boolean;
  tags: string[];
  escalated: boolean;
  dismissed: boolean;
  archived: boolean;
  archivedBy?: string;
  deletedAt: string | null;
  screenshotUrl: string | null;
  rating: number | null;
  acknowledged: boolean;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
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

type ViewFilter = "inbox" | "pinned" | "escalated" | "archived" | "trash";

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<ReviewItem[]>([]);
  const [trashItems, setTrashItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("inbox");
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [tagDropdownId, setTagDropdownId] = useState<string | null>(null);
  const [deleteActiveId, setDeleteActiveId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("newest");
  const [archiveSubFilter, setArchiveSubFilter] = useState<ArchiveSubFilter>("all");
  const [dailyMetrics, setDailyMetrics] = useState<{ date: string; submissions: number; core: number; uiux: number; app: number; operatorCli: number; issues: number; resolved: number }[]>([]);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const { start: lbStart, done: lbDone } = useLoadingBar();
  const { notify } = useNotifications();
  const { name: reviewerName } = useReviewer();

  const TWELVE_HOURS = 12 * 60 * 60 * 1000;

  const enrichItems = (data: ReviewItem[]): ReviewItem[] =>
    data.map((item) => {
      const isExpiredNew = item.status === "new" && (Date.now() - new Date(item.createdAt).getTime()) > TWELVE_HOURS;
      return {
        ...item,
        status: isExpiredNew ? "reviewed" as const : item.status,
        priority: item.priority || ("none" as Priority),
        starred: item.starred ?? false,
        tags: item.tags || [],
        escalated: item.escalated ?? false,
        dismissed: item.dismissed ?? false,
        archived: item.archived ?? false,
        archivedBy: item.archivedBy ?? undefined,
        deletedAt: item.deletedAt ?? null,
        screenshotUrl: item.screenshotUrl ?? null,
        rating: item.rating ?? null,
        acknowledged: item.acknowledged ?? false,
      };
    });

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) lbStart();
    try {
      const [active, archived, trash, st] = await Promise.all([
        fetch("/api/feedback").then((r) => r.ok ? r.json() : []),
        fetch("/api/feedback?view=archived").then((r) => r.ok ? r.json() : []),
        fetch("/api/feedback?view=trash").then((r) => r.ok ? r.json() : []),
        fetch("/api/stats").then((r) => r.ok ? r.json() : null),
      ]);
      const newActive = enrichItems(active);
      // Check for new items since last fetch
      if (!silent && items.length > 0) {
        const newCount = newActive.filter((n: ReviewItem) => !items.find((o) => o.id === n.id)).length;
        if (newCount > 0) notify("info", `${newCount} new feedback item(s)`);
      }
      setItems(newActive);
      setArchivedItems(enrichItems(archived));
      setTrashItems(enrichItems(trash));
      if (st?.dailyMetrics) setDailyMetrics(st.dailyMetrics);
      setLoading(false);
    } catch { setLoading(false); }
    if (!silent) lbDone();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  useEffect(() => {
    fetchAll(true);
    // Auto-refresh every 30s
    refreshInterval.current = setInterval(() => fetchAll(true), 30000);
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchItem = async (id: string, updates: Partial<ReviewItem>) => {
    // Auto-attach reviewer attribution
    if (reviewerName.trim()) {
      (updates as Record<string, unknown>).reviewedBy = reviewerName.trim();
      (updates as Record<string, unknown>).reviewedAt = new Date().toISOString();
    }
    lbStart();
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        if (updates.archived === true) {
          setItems((prev) => prev.filter((i) => i.id !== id));
          setArchivedItems((prev) => [{ ...updated, ...updates }, ...prev]);
          notify("success", "Archived");
        } else if (updates.deletedAt && updates.deletedAt !== null) {
          setItems((prev) => prev.filter((i) => i.id !== id));
          setArchivedItems((prev) => prev.filter((i) => i.id !== id));
          setTrashItems((prev) => [{ ...updated, ...updates }, ...prev]);
          notify("warning", "Moved to deleted");
        } else if (updates.archived === false) {
          setArchivedItems((prev) => prev.filter((i) => i.id !== id));
          setItems((prev) => [{ ...updated, ...updates }, ...prev]);
          notify("success", "Restored from archive");
        } else if (updates.deletedAt === null && !updates.archived) {
          setTrashItems((prev) => prev.filter((i) => i.id !== id));
          setItems((prev) => [{ ...updated, deletedAt: null }, ...prev]);
          notify("success", "Restored from deleted");
        } else {
          setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
          if (updates.status) notify("info", `Status: ${updates.status}`);
          else if (updates.escalated === true) notify("success", "Escalated to team");
          else if (updates.escalated === false) notify("info", "Removed from team");
          else if (updates.dismissed === true) notify("info", "Dismissed");
          else if (updates.dismissed === false) notify("success", "Un-dismissed");
        }
      }
    } catch { /* ignore */ }
    lbDone();
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

  const bulkAction = async (action: "escalate" | "dismiss" | "archive" | "delete" | "restore" | "restore-trash") => {
    const ids = [...selectedItems];
    let updates: Partial<ReviewItem> = {};
    if (action === "escalate") updates = { escalated: true };
    else if (action === "dismiss") updates = { dismissed: true };
    else if (action === "archive") updates = { archived: true, archivedBy: "review" };
    else if (action === "delete") updates = { deletedAt: new Date().toISOString() };
    else if (action === "restore") updates = { archived: false };
    else if (action === "restore-trash") updates = { deletedAt: null };

    await Promise.all(ids.map((id) => patchItem(id, updates)));
    setSelectedItems(new Set());
  };

  const bulkPermanentlyDelete = async () => {
    const ids = [...selectedItems];
    await Promise.all(ids.map((id) => permanentlyDelete(id)));
    setSelectedItems(new Set());
  };

  const permanentlyDelete = async (id: string) => {
    lbStart();
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTrashItems((prev) => prev.filter((i) => i.id !== id));
        notify("warning", "Permanently deleted");
      }
    } catch { /* ignore */ }
    lbDone();
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

  const getViewList = (): ReviewItem[] => {
    if (viewFilter === "archived") return archivedItems;
    if (viewFilter === "trash") return trashItems;
    if (viewFilter === "pinned") return items.filter((i) => i.starred && !i.dismissed);
    if (viewFilter === "escalated") return items.filter((i) => i.escalated && !i.dismissed);
    return items.filter((i) => !i.dismissed);
  };

  const viewList = getViewList();

  const currentList = viewList.filter((i) => {
    if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
    if (search && !i.message.toLowerCase().includes(search.toLowerCase()) && !i.userName.toLowerCase().includes(search.toLowerCase())) return false;
    if (viewFilter === "archived" && archiveSubFilter !== "all") {
      if (archiveSubFilter === "dismissed" && i.status !== "dismissed") return false;
      if (archiveSubFilter === "addressed" && i.status !== "addressed") return false;
    }
    return true;
  });

  const sorted = [...currentList].sort((a, b) => {
    if (dateFilter === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
    const pa = pOrder[a.priority] ?? 3;
    const pb = pOrder[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Inbox grouping: new + high priority at top, pinned below, rest at bottom
  const newItems = viewFilter === "inbox" ? sorted.filter((i) => i.status === "new" && i.priority !== "high") : [];
  const highPriorityItems = viewFilter === "inbox" ? sorted.filter((i) => i.priority === "high" && i.status !== "new") : [];
  const newAndHighItems = viewFilter === "inbox" ? sorted.filter((i) => i.status === "new" && i.priority === "high") : [];
  const highPriorityCombined = [...newAndHighItems, ...highPriorityItems];
  const newAndHighIds = new Set([...newItems, ...highPriorityCombined].map((i) => i.id));
  const pinnedItems = viewFilter === "inbox" ? sorted.filter((i) => i.starred && !newAndHighIds.has(i.id)) : [];
  const pinnedIds = new Set(pinnedItems.map((i) => i.id));
  const remainingItems = viewFilter === "inbox"
    ? sorted.filter((i) => !newAndHighIds.has(i.id) && !pinnedIds.has(i.id))
    : sorted;

  const totalInbox = items.filter((i) => !i.dismissed).length;
  const totalPinned = items.filter((i) => i.starred && !i.dismissed).length;
  const totalEscalated = items.filter((i) => i.escalated && !i.dismissed).length;
  const totalNew = items.filter((i) => i.status === "new" && !i.dismissed).length;

  const viewTabs: { key: ViewFilter; label: string; count: number; icon: React.ReactNode; separated?: boolean }[] = [
    { key: "inbox", label: "Inbox", count: totalInbox, icon: <Inbox size={14} /> },
    { key: "escalated", label: "Escalated", count: totalEscalated, icon: <ArrowUpRight size={14} /> },
    { key: "archived", label: "Archived", count: archivedItems.length, icon: <Archive size={14} /> },
    { key: "trash", label: "Deleted", count: trashItems.length, icon: <Trash2 size={14} /> },
    { key: "pinned", label: "Pinned", count: totalPinned, icon: <Pin size={14} />, separated: true },
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
          <button
            onClick={() => toggleSelect(item.id)}
            className={`flex items-center justify-center w-4 h-4 rounded border transition-colors cursor-pointer shrink-0 ${
              selectedItems.has(item.id)
                ? "bg-makina-accent border-makina-accent text-makina-bg"
                : "bg-makina-surface border-makina-border hover:border-makina-subtle"
            }`}
          >
            {selectedItems.has(item.id) && <span className="text-[10px] font-bold leading-none">{"\u2713"}</span>}
          </button>

          {viewFilter !== "trash" && viewFilter !== "archived" && (
            <>
              <Tooltip content={item.starred ? "Unpin" : "Pin for follow-up"}>
                <button
                  onClick={() => toggleStar(item.id)}
                  className={`btn-tactile p-1.5 rounded-md transition-colors ${item.starred ? "text-amber-400 bg-amber-400/10" : "text-makina-subtle hover:text-amber-400 hover:bg-amber-400/10"}`}
                >
                  <Pin size={14} fill={item.starred ? "currentColor" : "none"} />
                </button>
              </Tooltip>
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
            {item.escalated && viewFilter !== "trash" && viewFilter !== "archived" && (
              <span className="text-[10px] font-medium text-makina-green bg-makina-green/10 rounded-full px-2 py-0.5">Escalated</span>
            )}

            {viewFilter !== "trash" && viewFilter !== "archived" && (
              <>
                {/* Un-dismiss for dismissed items in inbox */}
                {item.dismissed && (
                  <Tooltip content="Un-dismiss">
                    <button
                      onClick={() => patchItem(item.id, { dismissed: false })}
                      className="btn-tactile p-2 rounded-md text-xs text-makina-subtle bg-makina-surface hover:text-makina-green hover:bg-green-500/10"
                    >
                      <RotateCcw size={15} />
                    </button>
                  </Tooltip>
                )}
                <Tooltip content={item.escalated ? "Remove from team" : "Escalate to team"}>
                  <button
                    onClick={() => patchItem(item.id, { escalated: !item.escalated })}
                    className={`btn-tactile p-2 rounded-md text-xs ${item.escalated ? "text-makina-green bg-makina-green/10 hover:bg-makina-green/20" : "text-makina-subtle bg-makina-surface hover:text-makina-green hover:bg-makina-green/10"}`}
                  >
                    <ArrowUpRight size={15} />
                  </button>
                </Tooltip>
                <Tooltip content="Archive">
                  <button
                    onClick={() => patchItem(item.id, { archived: true, archivedBy: "review" })}
                    className="btn-tactile p-2 rounded-md text-makina-subtle bg-makina-surface hover:text-makina-blue hover:bg-blue-500/10"
                  >
                    <Archive size={15} />
                  </button>
                </Tooltip>
                <Tooltip content="Move to deleted">
                  <button
                    onClick={() => handleDeleteClick(item.id)}
                    className={`btn-tactile p-2 rounded-md ring-1 ring-red-500/20 ${
                      deleteActiveId === item.id
                        ? "text-white bg-makina-red scale-95"
                        : "text-makina-subtle bg-red-500/5 hover:text-makina-red hover:bg-red-500/10"
                    }`}
                  >
                    <Trash2 size={15} />
                  </button>
                </Tooltip>
              </>
            )}

            {/* Restore + archive/permanent delete for archived/deleted views */}
            {(viewFilter === "archived" || viewFilter === "trash") && (
              <>
                <button
                  onClick={() => {
                    if (viewFilter === "archived") patchItem(item.id, { archived: false });
                    else patchItem(item.id, { deletedAt: null });
                  }}
                  className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500"
                >
                  <RotateCcw size={13} />
                  Restore
                </button>
                {viewFilter === "archived" && (
                  <button
                    onClick={() => patchItem(item.id, { deletedAt: new Date().toISOString() })}
                    className="btn-tactile inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-makina-muted bg-red-500/5 ring-1 ring-red-500/20 hover:text-makina-red hover:bg-red-500/10"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                )}
                {viewFilter === "trash" && (
                  <>
                    <button
                      onClick={() => patchItem(item.id, { archived: true, archivedBy: "review" })}
                      className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-makina-muted bg-blue-500/10 border border-blue-500/20 hover:text-makina-blue hover:bg-blue-500/20"
                    >
                      <Archive size={13} />
                      Archive
                    </button>
                    <button
                      onClick={() => permanentlyDelete(item.id)}
                      className="btn-tactile inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-500 ring-1 ring-red-500/30"
                    >
                      <XCircle size={13} />
                      Delete permanently
                    </button>
                  </>
                )}
              </>
            )}

            {/* Archived by tag */}
            {viewFilter === "archived" && item.archivedBy && (
              <span className="text-[10px] font-medium text-makina-muted bg-makina-surface rounded-full px-2 py-0.5">
                by {item.archivedBy}
              </span>
            )}

            {/* Reviewer attribution, far right, visually separated */}
            {item.reviewedBy && (
              <>
                <span className="w-px h-4 bg-makina-border/60 mx-1 shrink-0" />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-makina-accent-dim/40 border border-makina-accent/15 px-2.5 py-0.5 text-[10px] font-medium text-makina-accent shrink-0 whitespace-nowrap">
                  <span className="w-1 h-1 rounded-full bg-makina-accent/60" />
                  {item.status === "addressed" ? "Addressed" : item.status === "dismissed" ? "Dismissed" : item.archived ? "Archived" : item.escalated ? "Escalated" : "Reviewed"} by {item.reviewedBy}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Card body */}
        <div className="px-4 py-3">
          <FeedbackCard
            item={item}
            showInternalStatus
            onStatusChange={(id, status) => patchItem(id, { status })}
            onItemUpdate={(updated) => setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } as ReviewItem : i)))}
          />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-6 flex items-center justify-center h-[80vh]">
          <div className="text-sm text-makina-muted animate-pulse">Loading review inbox...</div>
        </main>
      </div>
    );
  }

  return (
    <>
      <ReviewerNamePrompt />
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">
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
                <Tooltip content="Items you pinned for follow-up">
                  <div className="flex items-center gap-2 cursor-default">
                    <Pin size={13} className="text-makina-muted" />
                    <span className="text-sm font-semibold">{totalPinned}</span>
                    <span className="text-xs text-makina-muted">pinned</span>
                  </div>
                </Tooltip>
              </div>
            </div>
            <button
              onClick={() => fetchAll()}
              className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-muted bg-makina-surface border border-makina-border hover:text-makina-text hover:border-makina-accent/40 transition-colors"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>

          {/* Analytics overview */}
          <AnalyticsChart data={dailyMetrics} />

          {/* View tabs */}
          <div className="flex items-center gap-1 border-b border-makina-border animate-fade-in-up" style={{ animationDelay: "50ms" }}>
            {viewTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setViewFilter(tab.key); setSelectedItems(new Set()); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab.separated ? "ml-auto" : ""
                } ${
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

          {/* Filters -- single row */}
          <div className="flex items-center gap-2 flex-wrap animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <Filter size={14} className="text-makina-muted shrink-0" />
            <div className="flex gap-1">
              {(["all", "Core", "UI/UX", "App", "Operator CLI"] as (CategoryId | "all")[]).map((cat) => {
                const activeColor: Record<string, string> = {
                  all: "bg-makina-accent text-makina-bg",
                  Core: "bg-blue-500 text-white",
                  "UI/UX": "bg-violet-500 text-white",
                  App: "bg-emerald-500 text-white",
                  "Operator CLI": "bg-orange-500 text-white",
                };
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`btn-tactile btn-ripple rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      categoryFilter === cat
                        ? activeColor[cat]
                        : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"
                    }`}
                  >
                    {cat === "all" ? "All categories" : cat}
                  </button>
                );
              })}
            </div>
            <div className="h-6 w-[2px] bg-makina-subtle/50 rounded-full shrink-0 mx-1" />
            <Calendar size={14} className="text-makina-muted shrink-0" />
            <div className="flex gap-1">
              {([["newest", "Latest"], ["oldest", "Earliest"]] as [DateFilter, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setDateFilter(val)}
                  className={`btn-tactile rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    dateFilter === val
                      ? "bg-makina-accent text-makina-bg"
                      : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {viewFilter === "archived" && (
              <>
                <div className="h-6 w-[2px] bg-makina-subtle/50 rounded-full shrink-0 mx-1" />
                <div className="flex gap-1">
                  {([["all", "All"], ["dismissed", "Dismissed"], ["addressed", "Addressed"]] as [ArchiveSubFilter, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setArchiveSubFilter(val)}
                      className={`btn-tactile rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        archiveSubFilter === val
                          ? "bg-makina-accent text-makina-bg"
                          : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
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
              <span className="text-xs font-semibold text-makina-accent">{selectedItems.size} selected</span>
              <button onClick={selectAll} className="btn-tactile rounded-md px-2.5 py-1 text-[11px] font-medium text-makina-accent hover:bg-makina-accent/10 transition-colors">
                {allSelected ? "Deselect All" : "Select All"}
              </button>
              <div className="h-4 w-px bg-makina-accent/20" />
              {viewFilter !== "trash" && viewFilter !== "archived" && (
                <>
                  <button onClick={() => bulkAction("escalate")} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-text bg-makina-card border border-makina-border hover:border-makina-accent/40 transition-colors">
                    <ArrowUpRight size={12} />
                    Escalate
                  </button>
                  <button onClick={() => bulkAction("archive")} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-text bg-makina-card border border-makina-border hover:border-makina-blue/40 transition-colors">
                    <Archive size={12} />
                    Archive
                  </button>
                  <button onClick={() => bulkAction("delete")} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-muted bg-red-500/5 ring-1 ring-red-500/20 hover:ring-red-500/40 hover:text-makina-red transition-colors">
                    <Trash2 size={12} />
                    Delete
                  </button>
                </>
              )}
              {viewFilter === "archived" && (
                <>
                  <button onClick={() => bulkAction("restore")} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors">
                    <RotateCcw size={12} />
                    Restore
                  </button>
                  <button onClick={() => bulkAction("delete")} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-muted bg-red-500/5 ring-1 ring-red-500/20 hover:ring-red-500/40 hover:text-makina-red transition-colors">
                    <Trash2 size={12} />
                    Delete
                  </button>
                </>
              )}
              {viewFilter === "trash" && (
                <>
                  <button onClick={() => bulkAction("restore-trash")} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors">
                    <RotateCcw size={12} />
                    Restore
                  </button>
                  <button onClick={() => bulkPermanentlyDelete()} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-500 ring-1 ring-red-500/30 transition-colors">
                    <XCircle size={12} />
                    Delete permanently
                  </button>
                </>
              )}
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
              className={`btn-tactile inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors border ${
                allSelected
                  ? "bg-makina-accent text-makina-bg border-makina-accent"
                  : "bg-makina-surface text-makina-muted border-makina-border hover:border-makina-accent/40 hover:text-makina-text"
              }`}
            >
              <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border text-[9px] font-bold leading-none ${
                allSelected
                  ? "bg-makina-bg text-makina-accent border-makina-bg"
                  : "bg-makina-surface border-makina-subtle"
              }`}>
                {allSelected ? "\u2713" : ""}
              </span>
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          {/* Feedback list, compact layout */}
          <div className="space-y-2">
            {viewFilter === "inbox" ? (
              <>
                {/* At-a-glance: New + High priority in side-by-side columns */}
                {(newItems.length > 0 || highPriorityCombined.length > 0) && (
                  <div className={`grid grid-cols-1 ${newItems.length > 0 && highPriorityCombined.length > 0 ? "lg:grid-cols-2" : ""} gap-4`}>
                    {newItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 pb-1">
                          <Inbox size={13} className="text-makina-accent" />
                          <h3 className="text-xs font-semibold text-makina-accent uppercase tracking-wider">New</h3>
                          <span className="text-[10px] text-makina-muted bg-makina-accent-dim rounded-full px-1.5 py-0.5">{newItems.length}</span>
                        </div>
                        {newItems.map((item, index) => renderFeedbackItem(item, index))}
                      </div>
                    )}
                    {highPriorityCombined.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 pb-1">
                          <AlertTriangle size={13} className="text-makina-red" />
                          <h3 className="text-xs font-semibold text-makina-red uppercase tracking-wider">Urgent</h3>
                          <span className="text-[10px] text-makina-muted bg-red-500/10 rounded-full px-1.5 py-0.5">{highPriorityCombined.length}</span>
                        </div>
                        {highPriorityCombined.map((item, index) => renderFeedbackItem(item, newItems.length + index))}
                      </div>
                    )}
                  </div>
                )}

                {/* Pinned items */}
                {pinnedItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pt-2 pb-1">
                      <div className="flex-1 h-px bg-makina-border" />
                      <Pin size={11} className="text-amber-400" />
                      <span className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Pinned</span>
                      <span className="text-[10px] text-makina-muted bg-amber-500/10 rounded-full px-1.5 py-0.5">{pinnedItems.length}</span>
                      <div className="flex-1 h-px bg-makina-border" />
                    </div>
                    {pinnedItems.map((item, index) => renderFeedbackItem(item, newItems.length + highPriorityCombined.length + index))}
                  </div>
                )}

                {/* Remaining items */}
                {remainingItems.length > 0 && (
                  <div className="space-y-2">
                    {(newItems.length > 0 || highPriorityCombined.length > 0 || pinnedItems.length > 0) && (
                      <div className="flex items-center gap-2 pt-2 pb-1">
                        <div className="flex-1 h-px bg-makina-border" />
                        <span className="text-[10px] text-makina-muted uppercase tracking-wider">All other</span>
                        <div className="flex-1 h-px bg-makina-border" />
                      </div>
                    )}
                    {remainingItems.map((item, index) => renderFeedbackItem(item, newItems.length + highPriorityCombined.length + pinnedItems.length + index))}
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
    </>
  );
}

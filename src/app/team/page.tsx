"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "@/components/Navbar";
import ReviewerNamePrompt from "@/components/ReviewerNamePrompt";
import Tooltip from "@/components/Tooltip";
import { type FeedbackItemData } from "@/components/FeedbackCard";
import { useLoadingBar } from "@/components/LoadingBar";
import { useNotifications } from "@/components/Notifications";
import { useReviewer } from "@/lib/reviewer";
import {
  AlertTriangle, Hash, ChevronRight, Clock, Box, Paintbrush, Archive, Trash2,
  RotateCcw, ArrowUpRight, Star as StarIcon, Image as ImageIcon, Search,
  Calendar, XCircle, CheckSquare, XSquare, RefreshCw, Send, X, Smartphone,
  Terminal, MessageSquare, Filter, Inbox,
} from "lucide-react";

type CategoryId = "Core" | "UI/UX" | "App" | "Operator CLI";
type DateFilter = "newest" | "oldest";
type ArchiveSubFilter = "all" | "dismissed" | "addressed";
type Priority = "none" | "low" | "medium" | "high";
type FeedbackStatus = "new" | "reviewed" | "addressed" | "dismissed";
type ViewFilter = "active" | "addressed" | "archived" | "deleted";

interface TeamItem extends FeedbackItemData {
  priority: Priority;
  escalated: boolean;
  archived: boolean;
  archivedBy?: string;
  deletedAt: string | null;
  screenshotUrl: string | null;
  rating: number | null;
  acknowledged: boolean;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

const QUICK_ACTION_LABELS: Record<string, { label: string }> = {
  "works-well": { label: "Works well" }, "needs-improvement": { label: "Needs improvement" },
  "missing-feature": { label: "Missing feature" }, "performance-issue": { label: "Performance issue" },
  "hard-to-use": { label: "Hard to use" }, "good-docs": { label: "Good documentation" },
  "love-it": { label: "Love it!" }, "easy-to-use": { label: "Easy to use" },
  "great-support": { label: "Great support" }, "impressive": { label: "Impressive" },
  "helpful": { label: "Helpful" }, "confusing": { label: "Confusing" },
};

const sentimentColors: Record<string, string> = {
  issue: "text-makina-red bg-red-500/10", suggestion: "text-makina-blue bg-blue-500/10",
  question: "text-makina-accent bg-makina-accent-dim",
};
const priorityColors: Record<string, string> = {
  high: "bg-red-500/15 text-red-400", medium: "bg-amber-400/15 text-amber-400",
  low: "bg-blue-400/15 text-blue-400", none: "",
};
const statusColors: Record<FeedbackStatus, string> = {
  new: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  reviewed: "bg-amber-400/15 text-amber-400 border-amber-400/20",
  addressed: "bg-green-500/15 text-green-400 border-green-500/20",
  dismissed: "bg-makina-surface text-makina-muted border-makina-border",
};
const categoryIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Core: Box, "UI/UX": Paintbrush, UX: Paintbrush, App: Smartphone, "Operator CLI": Terminal,
};
const categoryColorClasses: Record<string, string> = {
  Core: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  "UI/UX": "bg-violet-500/15 text-violet-400 border border-violet-500/20",
  UX: "bg-violet-500/15 text-violet-400 border border-violet-500/20",
  App: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
  "Operator CLI": "bg-orange-500/15 text-orange-400 border border-orange-500/20",
};

function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function TeamPage() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | "all">("all");
  const [feedback, setFeedback] = useState<TeamItem[]>([]);
  const [addressedItems, setAddressedItems] = useState<TeamItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<TeamItem[]>([]);
  const [deletedItems, setDeletedItems] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("newest");
  const [archiveSubFilter, setArchiveSubFilter] = useState<ArchiveSubFilter>("all");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { start: lbStart, done: lbDone } = useLoadingBar();
  const { notify } = useNotifications();
  const { name: reviewerName } = useReviewer();
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;

  const enrichItems = (data: TeamItem[]): TeamItem[] =>
    data.map((item) => ({
      ...item,
      status: (item.status === "new" && (Date.now() - new Date(item.createdAt).getTime()) > TWELVE_HOURS) ? "reviewed" as FeedbackStatus : item.status,
      priority: item.priority || ("none" as Priority),
      escalated: item.escalated ?? false, archived: item.archived ?? false,
      archivedBy: item.archivedBy ?? undefined, deletedAt: item.deletedAt ?? null,
      screenshotUrl: item.screenshotUrl ?? null, rating: item.rating ?? null,
      acknowledged: item.acknowledged ?? false,
    }));

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) lbStart();
    try {
      const [fb, archived, trash] = await Promise.all([
        fetch("/api/feedback").then((r) => r.ok ? r.json() : []),
        fetch("/api/feedback?view=archived").then((r) => r.ok ? r.json() : []),
        fetch("/api/feedback?view=trash").then((r) => r.ok ? r.json() : []),
      ]);
      const allFb = Array.isArray(fb) ? enrichItems(fb as TeamItem[]) : [];
      const escalated = allFb.filter((f) => f.escalated || ((f.type === "issue" || f.type === "suggestion") && f.upvotes > 10));
      setFeedback(escalated.filter((f) => f.status !== "addressed" && f.status !== "dismissed"));
      setAddressedItems(escalated.filter((f) => f.status === "addressed"));
      const archivedEsc = enrichItems(archived as TeamItem[]).filter((f) => f.escalated);
      setArchivedItems([...escalated.filter((f) => f.status === "dismissed"), ...archivedEsc]);
      setDeletedItems(enrichItems(trash as TeamItem[]).filter((f) => f.escalated));
      setLoading(false);
    } catch { setLoading(false); }
    if (!silent) lbDone();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll(true);
    refreshRef.current = setInterval(() => fetchAll(true), 30000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findItem = (id: string): TeamItem | undefined =>
    feedback.find((i) => i.id === id) || addressedItems.find((i) => i.id === id) ||
    archivedItems.find((i) => i.id === id) || deletedItems.find((i) => i.id === id);

  const removeFromAll = (id: string) => {
    setFeedback((p) => p.filter((i) => i.id !== id)); setAddressedItems((p) => p.filter((i) => i.id !== id));
    setArchivedItems((p) => p.filter((i) => i.id !== id)); setDeletedItems((p) => p.filter((i) => i.id !== id));
  };

  const patchItem = async (id: string, updates: Partial<TeamItem>) => {
    // Auto-attach reviewer attribution
    if (reviewerName.trim()) {
      (updates as Record<string, unknown>).reviewedBy = reviewerName.trim();
      (updates as Record<string, unknown>).reviewedAt = new Date().toISOString();
    }
    lbStart();
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
      if (res.ok) {
        if ("acknowledged" in updates && updates.archived === undefined && !updates.deletedAt && !("status" in updates)) {
          const up = (p: TeamItem[]) => p.map((i) => (i.id === id ? { ...i, ...updates } : i));
          setFeedback(up); setAddressedItems(up); setArchivedItems(up); setDeletedItems(up);
          lbDone(); return;
        }
        const item = findItem(id); if (!item) { lbDone(); return; }
        const merged = { ...item, ...updates };
        if (updates.deletedAt && updates.deletedAt !== null) { removeFromAll(id); setDeletedItems((p) => [merged, ...p]); notify("warning", "Moved to deleted"); }
        else if (updates.deletedAt === null) { removeFromAll(id); setFeedback((p) => [{ ...merged, deletedAt: null }, ...p]); notify("success", "Restored"); }
        else if (updates.archived === true || (updates as { status?: string }).status === "dismissed") { removeFromAll(id); setArchivedItems((p) => [merged, ...p]); notify("success", updates.archived ? "Archived" : "Dismissed"); }
        else if (updates.archived === false) { removeFromAll(id); setFeedback((p) => [{ ...merged, archived: false }, ...p]); notify("success", "Restored from archive"); }
        else if ((updates as { status?: string }).status === "addressed") { removeFromAll(id); setAddressedItems((p) => [merged, ...p]); notify("success", "Marked as addressed"); }
        else if ("status" in updates) { removeFromAll(id); setFeedback((p) => [merged, ...p]); notify("info", `Status: ${updates.status}`); }
        else { const up = (p: TeamItem[]) => p.map((i) => (i.id === id ? merged : i)); setFeedback(up); setAddressedItems(up); setArchivedItems(up); setDeletedItems(up); }
      }
    } catch { /* ignore */ }
    lbDone();
  };

  const permanentlyDelete = async (id: string) => {
    lbStart();
    try { const res = await fetch(`/api/feedback/${id}`, { method: "DELETE" }); if (res.ok) { setDeletedItems((p) => p.filter((i) => i.id !== id)); notify("warning", "Permanently deleted"); } } catch { /* */ }
    lbDone();
  };

  const handleReply = async (itemId: string) => {
    if (!replyText.trim()) return;
    lbStart();
    try {
      const res = await fetch(`/api/feedback/${itemId}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: replyText.trim() }) });
      if (res.ok) { const updated = await res.json(); const up = (p: TeamItem[]) => p.map((i) => (i.id === itemId ? { ...i, ...updated } : i)); setFeedback(up); setAddressedItems(up); setReplyText(""); setReplyOpenId(null); notify("success", "Reply sent"); }
    } catch { /* */ }
    lbDone();
  };

  const toggleSelect = (id: string) => { setSelectedItems((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const selectAll = () => { if (selectedItems.size === sorted.length) setSelectedItems(new Set()); else setSelectedItems(new Set(sorted.map((i) => i.id))); };
  const bulkAction = async (action: "escalate" | "archive" | "delete" | "restore" | "restore-trash") => {
    const ids = [...selectedItems];
    const updates: Partial<TeamItem> = action === "escalate" ? { escalated: true } : action === "archive" ? { archived: true, archivedBy: "team" } : action === "delete" ? { deletedAt: new Date().toISOString() } : action === "restore" ? { archived: false } : { deletedAt: null };
    await Promise.all(ids.map((id) => patchItem(id, updates))); setSelectedItems(new Set());
  };
  const bulkPermanentlyDelete = async () => {
    const ids = [...selectedItems];
    await Promise.all(ids.map((id) => permanentlyDelete(id))); setSelectedItems(new Set());
  };

  const currentList = (viewFilter === "addressed" ? addressedItems : viewFilter === "archived" ? archivedItems : viewFilter === "deleted" ? deletedItems : feedback)
    .filter((i) => {
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

  // Inbox grouping: new + high priority at top, rest below — matching review page
  const newItems = viewFilter === "active" ? sorted.filter((i) => i.status === "new" && i.priority !== "high") : [];
  const highPriorityItems = viewFilter === "active" ? sorted.filter((i) => i.priority === "high" && i.status !== "new") : [];
  const newAndHighItems = viewFilter === "active" ? sorted.filter((i) => i.status === "new" && i.priority === "high") : [];
  const highPriorityCombined = [...newAndHighItems, ...highPriorityItems];
  const remainingItems = viewFilter === "active"
    ? sorted.filter((i) => !(i.status === "new" && i.priority !== "high") && !(i.priority === "high" && i.status !== "new") && !(i.status === "new" && i.priority === "high"))
    : sorted;

  const urgentCount = feedback.filter((f) => f.priority === "high" || f.type === "issue").length;
  const actionableCount = feedback.filter((f) => f.type === "issue" || f.type === "suggestion").length;

  if (loading) return (<div className="min-h-screen"><Navbar /><main className="mx-auto max-w-7xl px-4 py-6 flex items-center justify-center h-[80vh]"><div className="text-sm text-makina-muted animate-pulse">Loading team board...</div></main></div>);

  const renderItem = (item: TeamItem) => {
    const CatIcon = categoryIcons[item.category] || Box;
    const qa = item.quickAction ? QUICK_ACTION_LABELS[item.quickAction] : null;
    const isExp = expandedId === item.id;
    const isUrg = item.priority === "high" || item.type === "issue";
    const isSel = selectedItems.has(item.id);
    return (
      <div key={item.id} className={`rounded-lg border overflow-hidden transition-colors ${isSel ? "border-makina-accent/40 bg-makina-accent-dim/30" : item.priority === "high" ? "border-red-500/30 bg-makina-card" : item.type === "issue" ? "border-amber-500/20 bg-makina-card" : "border-makina-border bg-makina-card"}`}>
        <div className="flex items-center gap-3 p-4">
          <button onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }} className={`flex items-center justify-center w-4 h-4 rounded border transition-colors cursor-pointer shrink-0 ${isSel ? "bg-makina-accent border-makina-accent text-makina-bg" : "bg-makina-surface border-makina-border hover:border-makina-subtle"}`}>
            {isSel && <span className="text-[10px] font-bold leading-none">{"\u2713"}</span>}
          </button>
          <button onClick={() => setExpandedId(isExp ? null : item.id)} className="flex-1 flex items-center gap-3 text-left hover:opacity-90 transition-opacity min-w-0">
            <div className={`w-1 self-stretch rounded-full shrink-0 ${item.priority === "high" ? "bg-red-500" : item.priority === "medium" ? "bg-amber-400" : item.priority === "low" ? "bg-blue-400" : item.type === "issue" ? "bg-amber-500/50" : "bg-makina-border"}`} />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-makina-surface text-xs font-bold text-makina-accent border border-makina-border shrink-0">{item.userAvatar}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{item.userName}</span>
                {item.escalated ? (<>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${categoryColorClasses[item.category] || "bg-makina-surface text-makina-muted border border-makina-border"}`}><CatIcon size={9} />{item.category}</span>
                  {item.priority !== "none" && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityColors[item.priority]}`}>{item.priority}</span>}
                </>) : (<>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${categoryColorClasses[item.category] || "bg-makina-surface text-makina-muted border border-makina-border"}`}><CatIcon size={9} />{item.category}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sentimentColors[item.type] || ""}`}>{item.type}</span>
                  {item.priority !== "none" && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityColors[item.priority]}`}>{item.priority}</span>}
                  {isUrg && item.priority !== "high" && <AlertTriangle size={12} className="text-amber-400" />}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize border ${statusColors[item.status] || ""}`}>{item.status}</span>
                </>)}
              </div>
              <p className="text-xs text-makina-text/80 mt-1 truncate">{qa ? qa.label : ""}{qa && item.message ? " — " : ""}{item.message}</p>
            </div>
            <div className="hidden sm:flex items-center gap-3 shrink-0">
              <span className="text-[11px] text-makina-muted"><Clock size={10} className="inline mr-1" />{timeAgo(item.createdAt)}</span>
              {item.reviewedBy && (
                <>
                  <span className="w-px h-4 bg-makina-border/60 shrink-0" />
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-makina-accent-dim/40 border border-makina-accent/15 px-2.5 py-0.5 text-[10px] font-medium text-makina-accent whitespace-nowrap">
                    <span className="w-1 h-1 rounded-full bg-makina-accent/60" />
                    {item.status === "addressed" ? "Addressed" : item.status === "dismissed" ? "Dismissed" : item.archived ? "Archived" : item.escalated ? "Escalated" : "Reviewed"} by {item.reviewedBy}
                  </span>
                </>
              )}
            </div>
            <ChevronRight size={16} className={`text-makina-subtle transition-transform shrink-0 ${isExp ? "rotate-90" : ""}`} />
          </button>
        </div>
        {isExp && (
          <div className="border-t border-makina-border/50 bg-makina-surface/50 p-4 space-y-3 animate-fade-in-up">
            {qa && <div className="inline-flex items-center rounded-md bg-makina-surface px-3 py-1.5 text-sm"><span className="font-medium">{qa.label}</span></div>}
            {item.message && <p className="text-sm text-makina-text/85 leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>{item.message}</p>}
            {item.rating != null && (<div className="flex items-center gap-1.5"><span className="text-xs text-makina-muted mr-1">Rating</span>{[1,2,3,4,5].map((s) => <StarIcon key={s} size={14} className={s <= item.rating! ? "text-amber-400 fill-amber-400" : "text-makina-subtle"} />)}</div>)}
            {item.screenshotUrl && (<div className="pt-1"><div className="flex items-center gap-1.5 text-xs text-makina-muted mb-1.5"><ImageIcon size={12} />Screenshot</div><a href={item.screenshotUrl} target="_blank" rel="noopener noreferrer"><img src={item.screenshotUrl} alt="Screenshot" className="rounded-md border border-makina-border max-w-xs max-h-40 object-cover hover:opacity-80 transition-opacity" /></a></div>)}
            {item.replies && item.replies.length > 0 && (<div className="space-y-2 pl-3 border-l-2 border-makina-border">{item.replies.map((r) => (<div key={r.id} className="text-xs text-makina-muted"><div className="flex items-center gap-1"><span className="text-makina-accent font-medium">Team reply</span><span className="mx-0.5">&middot;</span><span>{timeAgo(r.createdAt)}</span></div><p className="mt-0.5 text-makina-text/80">{r.message}</p></div>))}</div>)}
            <div className="flex items-center gap-2 pt-2 flex-wrap">
              <span className="text-xs text-makina-muted">{item.userName} &middot; {timeAgo(item.createdAt)}</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize border ${statusColors[item.status] || ""}`}>{item.status}</span>
              {(viewFilter === "active" || viewFilter === "addressed") && (
                <select value={item.priority} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); patchItem(item.id, { priority: e.target.value as Priority }); }} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold cursor-pointer border focus:outline-none transition-colors ${item.priority === "high" ? "bg-red-500/15 text-red-400 border-red-500/20" : item.priority === "medium" ? "bg-amber-400/15 text-amber-400 border-amber-400/20" : item.priority === "low" ? "bg-blue-400/15 text-blue-400 border-blue-400/20" : "bg-makina-surface text-makina-muted border-makina-border"}`}>
                  <option value="none">No priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                {(viewFilter === "active" || viewFilter === "addressed") && (<>
                  <Tooltip content="Reply"><button onClick={(e) => { e.stopPropagation(); setReplyOpenId(replyOpenId === item.id ? null : item.id); }} className={`btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${replyOpenId === item.id ? "text-makina-accent bg-makina-accent-dim border-makina-accent/20" : "text-makina-muted bg-makina-surface border-makina-border hover:text-makina-text hover:border-makina-subtle"}`}><MessageSquare size={14} />Reply{item.replies && item.replies.length > 0 ? ` (${item.replies.length})` : ""}</button></Tooltip>
                  {viewFilter === "active" && <Tooltip content="Mark as addressed"><button onClick={(e) => { e.stopPropagation(); patchItem(item.id, { status: "addressed" as FeedbackStatus }); }} className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors text-makina-muted bg-makina-surface border-makina-border hover:text-green-400 hover:bg-green-500/10 hover:border-green-500/20"><CheckSquare size={14} />Addressed</button></Tooltip>}
                  {viewFilter === "addressed" && <Tooltip content="Move back to active"><button onClick={(e) => { e.stopPropagation(); patchItem(item.id, { status: "reviewed" as FeedbackStatus }); }} className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors text-makina-muted bg-amber-500/10 border-amber-500/20 hover:text-amber-400 hover:bg-amber-500/20"><RotateCcw size={14} />Reopen</button></Tooltip>}
                  <Tooltip content="Dismiss"><button onClick={(e) => { e.stopPropagation(); patchItem(item.id, { status: "dismissed" as FeedbackStatus }); }} className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors text-makina-muted bg-makina-surface border-makina-border hover:text-makina-muted hover:bg-makina-surface/80"><XSquare size={14} />Dismiss</button></Tooltip>
                  <span className="w-px h-5 bg-makina-border mx-0.5" />
                  <Tooltip content="Archive"><button onClick={(e) => { e.stopPropagation(); patchItem(item.id, { archived: true, archivedBy: "team" }); }} className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-makina-muted bg-blue-500/10 border border-blue-500/20 hover:text-makina-blue hover:bg-blue-500/20"><Archive size={14} />Archive</button></Tooltip>
                  <Tooltip content="Move to deleted"><button onClick={(e) => { e.stopPropagation(); patchItem(item.id, { deletedAt: new Date().toISOString() }); }} className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-makina-muted bg-red-500/5 ring-1 ring-red-500/20 hover:text-makina-red hover:bg-red-500/10 hover:ring-red-500/30"><Trash2 size={14} />Delete</button></Tooltip>
                </>)}
                {(viewFilter === "archived" || viewFilter === "deleted") && (<>
                  <Tooltip content="Restore"><button onClick={(e) => { e.stopPropagation(); if (viewFilter === "archived") patchItem(item.id, { archived: false }); else patchItem(item.id, { deletedAt: null }); }} className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-makina-muted bg-green-500/10 border border-green-500/20 hover:text-makina-green hover:bg-green-500/20"><RotateCcw size={14} />Restore</button></Tooltip>
                  {viewFilter === "archived" && (
                    <button onClick={(e) => { e.stopPropagation(); patchItem(item.id, { deletedAt: new Date().toISOString() }); }} className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-makina-muted bg-red-500/5 ring-1 ring-red-500/20 hover:text-makina-red hover:bg-red-500/10"><Trash2 size={14} />Delete</button>
                  )}
                  {viewFilter === "deleted" && (<>
                    <button onClick={(e) => { e.stopPropagation(); patchItem(item.id, { archived: true, archivedBy: "team" }); }} className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-makina-muted bg-blue-500/10 border border-blue-500/20 hover:text-makina-blue hover:bg-blue-500/20"><Archive size={14} />Archive</button>
                    <button onClick={(e) => { e.stopPropagation(); permanentlyDelete(item.id); }} className="btn-tactile flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-500 ring-1 ring-red-500/30"><XCircle size={14} />Delete permanently</button>
                  </>)}
                </>)}
                {viewFilter === "archived" && item.archivedBy && <span className="text-[10px] font-medium text-makina-muted bg-makina-surface rounded-full px-2 py-0.5">by {item.archivedBy}</span>}
              </div>
            </div>
            {replyOpenId === item.id && (
              <div className="flex gap-2 pt-1 animate-fade-in-up">
                <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleReply(item.id)} placeholder="Write a team reply..." className="flex-1 rounded-md bg-makina-surface border border-makina-border px-3 py-2 text-xs text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50" autoFocus />
                <button onClick={() => handleReply(item.id)} disabled={!replyText.trim()} className="btn-tactile rounded-md gradient-accent p-2 text-makina-bg transition-all hover:brightness-110 disabled:opacity-40"><Send size={12} /></button>
                <button onClick={() => { setReplyOpenId(null); setReplyText(""); }} className="rounded-md bg-makina-surface border border-makina-border p-2 text-makina-muted hover:text-makina-text transition-colors"><X size={12} /></button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <ReviewerNamePrompt />
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap animate-fade-in-up">
            <div className="flex items-center gap-6">
              <div><p className="text-xs text-makina-muted font-medium uppercase tracking-wider">Action Required</p><h1 className="text-xl font-bold">Team Board</h1></div>
              <div className="hidden md:flex items-center gap-4 pl-6 border-l border-makina-border">
                <Tooltip content="Escalated from review"><div className="flex items-center gap-2 cursor-default"><ArrowUpRight size={13} className="text-makina-muted" /><span className="text-sm font-semibold">{feedback.length}</span><span className="text-xs text-makina-muted">escalated</span></div></Tooltip>
                <Tooltip content="Urgent items"><div className="flex items-center gap-2 cursor-default"><AlertTriangle size={13} className="text-makina-red" /><span className="text-sm font-semibold text-makina-red">{urgentCount}</span><span className="text-xs text-makina-red">urgent</span></div></Tooltip>
                <Tooltip content="Actionable items"><div className="flex items-center gap-2 cursor-default"><CheckSquare size={13} className="text-makina-green" /><span className="text-sm font-semibold">{actionableCount}</span><span className="text-xs text-makina-green">actionable</span></div></Tooltip>
              </div>
            </div>
            <button onClick={() => fetchAll()} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-muted bg-makina-surface border border-makina-border hover:text-makina-text hover:border-makina-accent/40 transition-colors"><RefreshCw size={12} />Refresh</button>
          </div>

          {feedback.some((f) => f.priority === "high") && viewFilter === "active" && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 flex items-center gap-3 animate-fade-in-up">
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <div><p className="text-sm font-semibold text-red-400">{feedback.filter((f) => f.priority === "high").length} high-priority item(s) need attention</p><p className="text-xs text-makina-muted mt-0.5">Flagged as urgent during review triage</p></div>
            </div>
          )}

          {/* View tabs */}
          <div className="flex items-center gap-1 border-b border-makina-border animate-fade-in-up" style={{ animationDelay: "50ms" }}>
            {([{ key: "active" as ViewFilter, label: "Active", count: feedback.length, icon: <Inbox size={14} /> }, { key: "addressed" as ViewFilter, label: "Addressed", count: addressedItems.length, icon: <CheckSquare size={14} /> }, { key: "archived" as ViewFilter, label: "Archived", count: archivedItems.length, icon: <Archive size={14} /> }, { key: "deleted" as ViewFilter, label: "Deleted", count: deletedItems.length, icon: <Trash2 size={14} /> }]).map((tab) => (
              <button key={tab.key} onClick={() => { setViewFilter(tab.key); setSelectedItems(new Set()); }} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${viewFilter === tab.key ? "border-makina-accent text-makina-accent" : "border-transparent text-makina-muted hover:text-makina-text"}`}>
                {tab.icon}
                {tab.label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${viewFilter === tab.key ? "bg-makina-accent-dim text-makina-accent" : "bg-makina-card text-makina-subtle"}`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Filters — single row */}
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
              {([["newest", "Latest"], ["oldest", "Earliest"]] as [DateFilter, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setDateFilter(v)} className={`btn-tactile rounded-full px-3 py-1 text-xs font-medium transition-colors ${dateFilter === v ? "bg-makina-accent text-makina-bg" : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"}`}>{l}</button>
              ))}
            </div>
            {viewFilter === "archived" && (
              <>
                <div className="h-6 w-[2px] bg-makina-subtle/50 rounded-full shrink-0 mx-1" />
                <div className="flex gap-1">
                  {([["all", "All"], ["dismissed", "Dismissed"], ["addressed", "Addressed"]] as [ArchiveSubFilter, string][]).map(([val, label]) => (
                    <button key={val} onClick={() => setArchiveSubFilter(val)} className={`btn-tactile rounded-full px-3 py-1 text-xs font-medium transition-colors ${archiveSubFilter === val ? "bg-makina-accent text-makina-bg" : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"}`}>{label}</button>
                  ))}
                </div>
              </>
            )}
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-makina-subtle" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search feedback..." className="rounded-md bg-makina-card border border-makina-border pl-9 pr-4 py-1.5 text-xs text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50 w-48" />
            </div>
          </div>

          {selectedItems.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg bg-makina-accent-dim border border-makina-accent/20 px-4 py-2.5 animate-fade-in-up">
              <span className="text-xs font-semibold text-makina-accent">{selectedItems.size} selected</span>
              <button onClick={selectAll} className="btn-tactile rounded-md px-2.5 py-1 text-[11px] font-medium text-makina-accent hover:bg-makina-accent/10 transition-colors">
                {selectedItems.size === sorted.length ? "Deselect All" : "Select All"}
              </button>
              <div className="h-4 w-px bg-makina-accent/20" />
              {(viewFilter === "active" || viewFilter === "addressed") && (<>
                <button onClick={() => bulkAction("escalate")} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-text bg-makina-card border border-makina-border hover:border-makina-accent/40 transition-colors"><ArrowUpRight size={12} />Escalate</button>
                <button onClick={() => bulkAction("archive")} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-text bg-makina-card border border-makina-border hover:border-makina-blue/40 transition-colors"><Archive size={12} />Archive</button>
                <button onClick={() => bulkAction("delete")} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-muted bg-red-500/5 ring-1 ring-red-500/20 hover:ring-red-500/40 hover:text-makina-red transition-colors"><Trash2 size={12} />Delete</button>
              </>)}
              {viewFilter === "archived" && (<>
                <button onClick={() => bulkAction("restore")} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"><RotateCcw size={12} />Restore</button>
                <button onClick={() => bulkAction("delete")} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-makina-muted bg-red-500/5 ring-1 ring-red-500/20 hover:ring-red-500/40 hover:text-makina-red transition-colors"><Trash2 size={12} />Delete</button>
              </>)}
              {viewFilter === "deleted" && (<>
                <button onClick={() => bulkAction("restore-trash")} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"><RotateCcw size={12} />Restore</button>
                <button onClick={() => bulkPermanentlyDelete()} className="btn-tactile flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-500 ring-1 ring-red-500/30 transition-colors"><XCircle size={12} />Delete permanently</button>
              </>)}
              <button onClick={() => setSelectedItems(new Set())} className="ml-auto text-xs text-makina-muted hover:text-makina-text transition-colors">Clear</button>
            </div>
          )}

          {viewFilter === "deleted" && deletedItems.length > 0 && <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-400">Items in Deleted are automatically removed after 30 days.</div>}

          <div className="space-y-2">
            {viewFilter === "active" ? (
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
                        {newItems.map(renderItem)}
                      </div>
                    )}
                    {highPriorityCombined.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 pb-1">
                          <AlertTriangle size={13} className="text-makina-red" />
                          <h3 className="text-xs font-semibold text-makina-red uppercase tracking-wider">Urgent</h3>
                          <span className="text-[10px] text-makina-muted bg-red-500/10 rounded-full px-1.5 py-0.5">{highPriorityCombined.length}</span>
                        </div>
                        {highPriorityCombined.map(renderItem)}
                      </div>
                    )}
                  </div>
                )}

                {/* Remaining items */}
                {remainingItems.length > 0 && (
                  <div className="space-y-2">
                    {(newItems.length > 0 || highPriorityCombined.length > 0) && (
                      <div className="flex items-center gap-2 pt-2 pb-1">
                        <div className="flex-1 h-px bg-makina-border" />
                        <span className="text-[10px] text-makina-muted uppercase tracking-wider">All other</span>
                        <div className="flex-1 h-px bg-makina-border" />
                      </div>
                    )}
                    {remainingItems.map(renderItem)}
                  </div>
                )}
              </>
            ) : (
              sorted.map(renderItem)
            )}
          </div>

          {sorted.length === 0 && (
            <div className="text-center py-16 space-y-3 animate-fade-in-up">
              {viewFilter === "deleted" ? (<><Trash2 size={32} className="text-makina-subtle mx-auto" /><p className="text-sm text-makina-muted">Deleted is empty</p></>) :
               viewFilter === "archived" ? (<><Archive size={32} className="text-makina-subtle mx-auto" /><p className="text-sm text-makina-muted">No archived items</p></>) :
               viewFilter === "addressed" ? (<><CheckSquare size={32} className="text-makina-subtle mx-auto" /><p className="text-sm text-makina-muted">No addressed items yet</p></>) :
               (<><Hash size={32} className="text-makina-subtle mx-auto" /><p className="text-sm text-makina-muted">{feedback.length === 0 ? "No feedback has been escalated yet. Use the Review page to escalate items." : "No items match this category filter"}</p></>)}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

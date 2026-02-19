"use client";

import { useState, useEffect } from "react";
import { Heart, Clock, MessageSquare, Send, X, Box, Paintbrush, Headphones } from "lucide-react";

type CategoryId = "Product" | "UX" | "Support";
type FeedbackStatus = "new" | "reviewed" | "addressed" | "dismissed";

interface Reply {
  id: string;
  message: string;
  createdAt: string;
}

export interface FeedbackItemData {
  id: string;
  userName: string;
  userAvatar: string;
  category: CategoryId;
  type: string;
  message: string;
  quickAction?: string | null;
  status: FeedbackStatus;
  priority?: string;
  upvotes: number;
  upvotedBy?: string[];
  replies?: Reply[];
  createdAt: string;
}

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

function formatTimestamp(date: string | Date): { relative: string; absolute: string } {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  let relative: string;
  if (seconds < 60) relative = "just now";
  else if (seconds < 3600) relative = `${Math.floor(seconds / 60)}m ago`;
  else if (seconds < 86400) relative = `${Math.floor(seconds / 3600)}h ago`;
  else if (seconds < 604800) relative = `${Math.floor(seconds / 86400)}d ago`;
  else relative = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const absolute = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return { relative, absolute };
}

const typeColors: Record<string, string> = {
  praise: "bg-makina-green/15 text-green-400",
  issue: "bg-red-500/15 text-red-400",
  suggestion: "bg-blue-500/15 text-blue-400",
  question: "bg-makina-accent-dim text-makina-accent",
};

const priorityBorder: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-400",
  low: "border-l-blue-400",
  none: "border-l-transparent",
};

const categoryIcons: Record<CategoryId, React.ComponentType<{ size?: number; className?: string }>> = {
  Product: Box,
  UX: Paintbrush,
  Support: Headphones,
};

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("makina-session-id");
  if (!id) {
    id = "sess-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem("makina-session-id", id);
  }
  return id;
}

interface FeedbackCardProps {
  item: FeedbackItemData;
  showStatus?: boolean;
  onStatusChange?: (id: string, status: FeedbackStatus) => void;
  onItemUpdate?: (item: FeedbackItemData) => void;
}

export default function FeedbackCard({ item, showStatus, onStatusChange, onItemUpdate }: FeedbackCardProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySent, setReplySent] = useState(false);
  const [localUpvotes, setLocalUpvotes] = useState(item.upvotes);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [upvoting, setUpvoting] = useState(false);

  useEffect(() => {
    setLocalUpvotes(item.upvotes);
    const sid = getSessionId();
    setHasUpvoted(item.upvotedBy?.includes(sid) ?? false);
  }, [item.upvotes, item.upvotedBy]);

  const quickAction = item.quickAction ? QUICK_ACTION_LABELS[item.quickAction] : null;
  const ts = formatTimestamp(item.createdAt);
  const priority = item.priority || "none";

  const handleUpvote = async () => {
    if (upvoting) return;
    setUpvoting(true);
    try {
      const res = await fetch(`/api/feedback/${item.id}/upvote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getSessionId() }),
      });
      if (res.ok) {
        const data = await res.json();
        setLocalUpvotes(data.upvotes);
        setHasUpvoted(data.upvotedBy.includes(getSessionId()));
      }
    } catch { /* ignore */ }
    setUpvoting(false);
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    try {
      const res = await fetch(`/api/feedback/${item.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        onItemUpdate?.(updated);
        setReplyText("");
        setReplySent(true);
        setReplyOpen(false);
        setTimeout(() => setReplySent(false), 2000);
      }
    } catch { /* ignore */ }
  };

  const handleStatusChange = async (newStatus: FeedbackStatus) => {
    try {
      const res = await fetch(`/api/feedback/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        onStatusChange?.(item.id, newStatus);
      }
    } catch { /* ignore */ }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, select, input, a, textarea")) return;
    setReplyOpen(!replyOpen);
  };

  const CategoryIcon = categoryIcons[item.category];

  return (
    <div
      onClick={handleCardClick}
      className={`group rounded-md bg-makina-card border border-makina-border border-l-[3px] ${priorityBorder[priority]} p-4 hover-lift hover:border-makina-subtle hover:bg-makina-card-hover cursor-pointer`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-makina-surface text-sm font-bold text-makina-accent border border-makina-border">
          {item.userAvatar}
        </div>

        <div className="min-w-0 flex-1">
          {/* Header: poster, category, type, timestamp */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{item.userName}</span>
            <span className="flex items-center gap-1 rounded-full bg-makina-surface px-2 py-0.5 text-[10px] font-medium text-makina-muted">
              <CategoryIcon size={9} />
              {item.category}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColors[item.type] || ""}`}>
              {item.type}
            </span>
            {priority !== "none" && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                priority === "high" ? "bg-red-500/15 text-red-400" :
                priority === "medium" ? "bg-amber-400/15 text-amber-400" :
                "bg-blue-400/15 text-blue-400"
              }`}>
                {priority}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-makina-muted ml-auto" title={ts.absolute}>
              <Clock size={10} />
              {ts.relative}
            </span>
          </div>

          {/* Content */}
          <div className="mt-2">
            {quickAction && (
              <div className="inline-flex items-center gap-1.5 rounded-md bg-makina-surface px-3 py-1.5 text-sm">
                <span>{quickAction.emoji}</span>
                <span className="font-medium">{quickAction.label}</span>
              </div>
            )}
            {item.message && (
              <p className="mt-1 text-sm text-makina-text/85 leading-relaxed">
                {item.message}
              </p>
            )}
          </div>

          {/* Replies */}
          {item.replies && item.replies.length > 0 && (
            <div className="mt-3 space-y-2 pl-3 border-l-2 border-makina-border">
              {item.replies.map((reply) => {
                const rts = formatTimestamp(reply.createdAt);
                return (
                  <div key={reply.id} className="text-xs text-makina-muted">
                    <span className="text-makina-accent font-medium">Team reply</span>
                    <span className="mx-1.5">&middot;</span>
                    <span title={rts.absolute}>{rts.relative}</span>
                    <p className="mt-0.5 text-makina-text/80">{reply.message}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions row */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleUpvote}
              disabled={upvoting}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                hasUpvoted
                  ? "text-pink-400 bg-pink-500/10 border border-pink-500/20"
                  : "text-makina-muted bg-makina-surface border border-makina-border hover:text-pink-400 hover:bg-pink-500/10 hover:border-pink-500/20"
              }`}
            >
              <Heart size={13} fill={hasUpvoted ? "currentColor" : "none"} />
              <span>{localUpvotes}</span>
            </button>
            <button
              onClick={() => setReplyOpen(!replyOpen)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                replyOpen
                  ? "text-makina-accent bg-makina-accent-dim border border-makina-accent/20"
                  : "text-makina-muted bg-makina-surface border border-makina-border hover:text-makina-text hover:border-makina-subtle"
              }`}
            >
              <MessageSquare size={12} />
              <span>Reply{item.replies && item.replies.length > 0 ? ` (${item.replies.length})` : ""}</span>
            </button>
            {replySent && (
              <span className="text-xs text-makina-green font-medium animate-success">Sent!</span>
            )}
            {showStatus && (
              <div className="ml-auto">
                <select
                  value={item.status}
                  onChange={(e) => handleStatusChange(e.target.value as FeedbackStatus)}
                  className="rounded-md bg-makina-surface border border-makina-border px-2 py-1 text-xs text-makina-muted focus:outline-none focus:border-makina-accent cursor-pointer"
                >
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="addressed">Addressed</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
            )}
          </div>

          {/* Reply input */}
          {replyOpen && (
            <div className="mt-3 flex gap-2 animate-fade-in-up">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReply()}
                placeholder="Write a quick reply..."
                className="flex-1 rounded-md bg-makina-surface border border-makina-border px-3 py-2 text-xs text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50"
                autoFocus
              />
              <button
                onClick={handleReply}
                disabled={!replyText.trim()}
                className="rounded-md gradient-accent p-2 text-makina-bg transition-all hover:brightness-110 disabled:opacity-40"
              >
                <Send size={12} />
              </button>
              <button
                onClick={() => { setReplyOpen(false); setReplyText(""); }}
                className="rounded-md bg-makina-surface border border-makina-border p-2 text-makina-muted hover:text-makina-text transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

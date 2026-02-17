"use client";

import { useState } from "react";
import { ChevronUp, Clock, MessageSquare, Send, X, Box, Paintbrush, Headphones } from "lucide-react";
import { type FeedbackItem, type CategoryId, QUICK_ACTIONS } from "@/lib/mock-data";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const typeColors: Record<string, string> = {
  praise: "bg-makina-green/15 text-green-400",
  issue: "bg-red-500/15 text-red-400",
  suggestion: "bg-blue-500/15 text-blue-400",
  question: "bg-makina-accent-dim text-makina-accent",
};

const categoryIcons: Record<CategoryId, React.ComponentType<{ size?: number; className?: string }>> = {
  Product: Box,
  UX: Paintbrush,
  Support: Headphones,
};

interface FeedbackCardProps {
  item: FeedbackItem;
  showStatus?: boolean;
  onStatusChange?: (id: string, status: FeedbackItem["status"]) => void;
  onReply?: (id: string, message: string) => void;
}

export default function FeedbackCard({ item, showStatus, onStatusChange, onReply }: FeedbackCardProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySent, setReplySent] = useState(false);

  const quickAction = item.quickAction
    ? QUICK_ACTIONS.find((a) => a.id === item.quickAction)
    : null;

  const handleReply = () => {
    if (!replyText.trim()) return;
    onReply?.(item.id, replyText);
    setReplyText("");
    setReplySent(true);
    setReplyOpen(false);
    setTimeout(() => setReplySent(false), 2000);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle reply if clicking an interactive element
    const target = e.target as HTMLElement;
    if (target.closest("button, select, input, a, textarea")) return;
    setReplyOpen(!replyOpen);
  };

  const CategoryIcon = categoryIcons[item.category];

  return (
    <div
      onClick={handleCardClick}
      className="group rounded-xl bg-makina-card border border-makina-border p-4 hover-lift hover:border-makina-subtle hover:bg-makina-card-hover cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-makina-surface text-sm font-bold text-makina-accent border border-makina-border">
          {item.user.avatar}
        </div>

        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{item.user.displayName}</span>
            <span className="flex items-center gap-1 rounded-full bg-makina-surface px-2 py-0.5 text-[10px] font-medium text-makina-muted">
              <CategoryIcon size={9} />
              {item.category}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColors[item.type]}`}>
              {item.type}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-makina-muted ml-auto">
              <Clock size={10} />
              {timeAgo(item.timestamp)}
            </span>
          </div>

          {/* Content */}
          <div className="mt-2">
            {quickAction && (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-makina-surface px-3 py-1.5 text-sm">
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

          {/* Footer */}
          <div className="mt-3 flex items-center gap-3">
            <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-makina-muted hover:text-makina-accent hover:bg-makina-accent-dim transition-colors">
              <ChevronUp size={14} />
              <span className="font-medium">{item.upvotes}</span>
            </button>
            <button
              onClick={() => setReplyOpen(!replyOpen)}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors ${
                replyOpen
                  ? "text-makina-accent bg-makina-accent-dim"
                  : "text-makina-muted hover:text-makina-text hover:bg-makina-surface"
              }`}
            >
              <MessageSquare size={12} />
              <span>Reply</span>
            </button>
            {replySent && (
              <span className="text-xs text-makina-green font-medium animate-success">Sent!</span>
            )}
            {showStatus && onStatusChange && (
              <div className="ml-auto">
                <select
                  value={item.status}
                  onChange={(e) => onStatusChange(item.id, e.target.value as FeedbackItem["status"])}
                  className="rounded-lg bg-makina-surface border border-makina-border px-2 py-1 text-xs text-makina-muted focus:outline-none focus:border-makina-accent cursor-pointer"
                >
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="addressed">Addressed</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
            )}
          </div>

          {/* Inline reply */}
          {replyOpen && (
            <div className="mt-3 flex gap-2 animate-fade-in-up">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReply()}
                placeholder="Write a quick reply..."
                className="flex-1 rounded-lg bg-makina-surface border border-makina-border px-3 py-2 text-xs text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50"
                autoFocus
              />
              <button
                onClick={handleReply}
                disabled={!replyText.trim()}
                className="rounded-lg gradient-accent p-2 text-makina-bg transition-all hover:brightness-110 disabled:opacity-40"
              >
                <Send size={12} />
              </button>
              <button
                onClick={() => { setReplyOpen(false); setReplyText(""); }}
                className="rounded-lg bg-makina-surface border border-makina-border p-2 text-makina-muted hover:text-makina-text transition-colors"
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

"use client";

import { useState } from "react";
import { Send, Check, EyeOff, MessageSquare, Zap, Clock, CheckCircle2, TrendingUp, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import LiveFeed from "@/components/LiveFeed";
import { MOCK_FEEDBACK, QUICK_ACTIONS, CATEGORY_STATS, type CategoryId } from "@/lib/mock-data";

const CATEGORIES: CategoryId[] = ["Product", "UX", "Support"];

const categoryPrompts: Record<CategoryId, string> = {
  Product: "What would you improve about the product?",
  UX: "What felt confusing or could work better?",
  Support: "How can we help you?",
};

const TRENDING_REACTIONS = [
  { emoji: "🎉", label: "Love it!", count: 127 },
  { emoji: "💡", label: "Feature request", count: 89 },
  { emoji: "✨", label: "Easy to use", count: 64 },
  { emoji: "🔧", label: "Needs improvement", count: 41 },
];

const RECENTLY_RESOLVED = [
  { title: "Notification preferences now easier to find", category: "Support" as CategoryId, timeAgo: "2h ago" },
  { title: "Dark mode contrast improved", category: "UX" as CategoryId, timeAgo: "5h ago" },
  { title: "Export history now available", category: "Product" as CategoryId, timeAgo: "1d ago" },
];

export default function FeedbackPage() {
  const [category, setCategory] = useState<CategoryId>("Product");
  const [quickAction, setQuickAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedbackFilter, setFeedbackFilter] = useState<CategoryId | "all">("all");

  const handleSubmit = () => {
    if (!message.trim() && !quickAction) return;
    console.log("Submit:", { category, quickAction, message, anonymous });
    setMessage("");
    setQuickAction(null);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
  };

  const canSubmit = message.trim() || quickAction;
  const totalSubmissions = CATEGORY_STATS.reduce((s, c) => s + c.submissions, 0);

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">

        {/* ── Zone 1: Hero + Metrics ── */}
        <div className="text-center space-y-4 animate-fade-in-up">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-makina-accent-dim px-4 py-1.5">
              <MessageSquare size={14} className="text-makina-accent" />
              <span className="text-xs font-medium text-makina-accent">We read every submission</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">makina <span className="gradient-text">pulse</span></h1>
            <p className="text-sm text-makina-subtle">Your feedback shapes what we build next</p>
          </div>

          {/* Inline metrics strip */}
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-2" title="Total submissions">
              <MessageSquare size={13} className="text-makina-muted" />
              <span className="text-sm font-semibold">{totalSubmissions}</span>
              <span className="text-xs text-makina-green font-medium">+12%</span>
            </div>
            <div className="h-4 w-px bg-makina-border hidden sm:block" />
            <div className="flex items-center gap-2" title="Avg. response time">
              <Clock size={13} className="text-makina-muted" />
              <span className="text-sm font-semibold">~4h</span>
              <span className="text-xs text-makina-muted">response</span>
            </div>
            <div className="h-4 w-px bg-makina-border hidden sm:block" />
            <div className="flex items-center gap-2" title="Resolution rate">
              <CheckCircle2 size={13} className="text-makina-muted" />
              <span className="text-sm font-semibold">89%</span>
              <span className="text-xs text-makina-muted">resolved</span>
            </div>
            <div className="h-4 w-px bg-makina-border hidden sm:block" />
            <div className="flex items-center gap-2" title="Contributors this month">
              <Users size={13} className="text-makina-muted" />
              <span className="text-sm font-semibold">284</span>
              <span className="text-xs text-makina-muted">contributors</span>
            </div>
          </div>
        </div>

        {/* ── Zone 2: Form + Context (2-column) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>

          {/* Form card */}
          <div className="rounded-2xl bg-makina-card border border-makina-border p-6 space-y-5 hover-lift">
            <div className="space-y-2">
              <label className="text-xs font-medium text-makina-muted uppercase tracking-wider">Category</label>
              <div className="flex gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      category === cat
                        ? "gradient-accent text-makina-bg"
                        : "bg-makina-surface text-makina-muted border border-makina-border hover:border-makina-subtle hover:text-makina-text"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-makina-muted uppercase tracking-wider">Quick reaction <span className="normal-case text-makina-subtle">(optional)</span></label>
              <div className="flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => setQuickAction(quickAction === action.id ? null : action.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      quickAction === action.id
                        ? "gradient-accent text-makina-bg"
                        : "bg-makina-surface text-makina-muted border border-makina-border hover:border-makina-accent/40 hover:text-makina-text"
                    }`}
                  >
                    <span>{action.emoji}</span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-makina-muted uppercase tracking-wider">Message <span className="normal-case text-makina-subtle">(optional if reaction selected)</span></label>
                <button
                  type="button"
                  onClick={() => setAnonymous(!anonymous)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    anonymous
                      ? "bg-makina-accent-dim text-makina-accent border border-makina-accent/30"
                      : "bg-makina-surface text-makina-subtle border border-makina-border hover:border-makina-subtle hover:text-makina-muted"
                  }`}
                >
                  <EyeOff size={10} />
                  Anonymous
                </button>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={categoryPrompts[category]}
                className="w-full resize-none rounded-xl bg-makina-surface border border-makina-border px-4 py-3 text-sm text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50 transition-colors"
                rows={3}
              />
            </div>

            {submitted ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-makina-green/10 py-3 animate-success">
                <Check size={16} className="text-makina-green" />
                <span className="text-sm font-medium text-makina-green">Feedback submitted! Thank you.</span>
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full flex items-center justify-center gap-2 rounded-xl gradient-accent py-3 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed glow-accent"
              >
                <Send size={14} />
                Submit Feedback
              </button>
            )}
          </div>

          {/* Context panel */}
          <div className="space-y-4">
            {/* Trending reactions */}
            <div className="rounded-2xl bg-makina-card border border-makina-border p-4 space-y-3">
              <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">Trending reactions</span>
              <div className="space-y-2">
                {TRENDING_REACTIONS.map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{r.emoji}</span>
                      <span className="text-xs text-makina-text">{r.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-makina-muted">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category breakdown */}
            <div className="rounded-2xl bg-makina-card border border-makina-border p-4 space-y-3">
              <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">By category</span>
              <div className="space-y-2.5">
                {CATEGORY_STATS.map((cat) => (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-makina-text">{cat.id}</span>
                      <span className="text-xs text-makina-muted">{cat.submissions}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-makina-surface overflow-hidden">
                      <div
                        className="h-full rounded-full gradient-accent transition-all"
                        style={{ width: `${(cat.submissions / totalSubmissions) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social proof */}
            <div className="rounded-2xl bg-makina-accent-dim border border-makina-accent/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-makina-accent" />
                <span className="text-xs font-semibold text-makina-accent">Your voice matters</span>
              </div>
              <p className="text-[11px] text-makina-muted leading-relaxed">
                74% of feature requests from last month have already been reviewed by the team.
              </p>
            </div>
          </div>
        </div>

        {/* ── Zone 3: Trust strip — recently resolved ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
          {RECENTLY_RESOLVED.map((item, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl bg-makina-card border border-makina-border p-4">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-makina-green/10 shrink-0">
                <CheckCircle2 size={13} className="text-makina-green" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-makina-text leading-snug">{item.title}</p>
                <p className="text-[11px] text-makina-subtle mt-1">{item.category} &middot; {item.timeAgo}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Zone 4: Community feed — full width, 2-column grid ── */}
        <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Feedback</h2>
            <div className="flex gap-1">
              {(["all", ...CATEGORIES] as (CategoryId | "all")[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFeedbackFilter(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    feedbackFilter === cat
                      ? "bg-makina-accent text-makina-bg"
                      : "text-makina-subtle hover:text-makina-muted"
                  }`}
                >
                  {cat === "all" ? "All" : cat}
                </button>
              ))}
            </div>
          </div>
          <LiveFeed feedback={MOCK_FEEDBACK} category={feedbackFilter} columns={2} />
        </div>
      </main>
    </div>
  );
}

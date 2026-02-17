"use client";

import { useState } from "react";
import { Send, Check, EyeOff, MessageSquare, Zap, Clock, CheckCircle2, TrendingUp, Users, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import LiveFeed from "@/components/LiveFeed";
import { MOCK_FEEDBACK, QUICK_ACTIONS, CATEGORY_STATS, type CategoryId } from "@/lib/mock-data";

const CATEGORIES: CategoryId[] = ["Product", "UX", "Support"];

const categoryPrompts: Record<CategoryId, string> = {
  Product: "What would you improve about the product?",
  UX: "What felt confusing or could work better?",
  Support: "How can we help you?",
};

// Trending reactions (mock data derived from quick actions)
const TRENDING_REACTIONS = [
  { emoji: "🎉", label: "Love it!", count: 127 },
  { emoji: "💡", label: "Feature request", count: 89 },
  { emoji: "✨", label: "Easy to use", count: 64 },
  { emoji: "🔧", label: "Needs improvement", count: 41 },
];

// Recently resolved items (mock)
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

      {/* Hero — full width */}
      <div className="text-center space-y-3 pt-10 pb-6 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 rounded-full bg-makina-accent-dim px-4 py-1.5">
          <MessageSquare size={14} className="text-makina-accent" />
          <span className="text-xs font-medium text-makina-accent">We read every submission</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">makina <span className="gradient-text">pulse</span></h1>
        <p className="text-sm text-makina-subtle">
          Your feedback shapes what we build next
        </p>
      </div>

      {/* 3-column layout */}
      <main className="mx-auto max-w-6xl px-4 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_240px] gap-6">

          {/* ── Left sidebar: Pulse Check ── */}
          <aside className="hidden lg:block space-y-4">
            {/* Live counter */}
            <div className="rounded-2xl bg-makina-card border border-makina-border p-4 space-y-3 animate-fade-in-up">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-makina-green animate-pulse-live" />
                <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">Live pulse</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{totalSubmissions}</span>
                <span className="text-xs text-makina-muted">submissions</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-makina-green font-medium">
                <TrendingUp size={12} />
                <span>+12% vs last week</span>
              </div>
            </div>

            {/* Trending reactions */}
            <div className="rounded-2xl bg-makina-card border border-makina-border p-4 space-y-3 animate-fade-in-up" style={{ animationDelay: "50ms" }}>
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
            <div className="rounded-2xl bg-makina-card border border-makina-border p-4 space-y-3 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
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
          </aside>

          {/* ── Center: Form + Feed ── */}
          <div className="space-y-8">
            {/* Unified feedback form */}
            <div
              className="rounded-2xl bg-makina-card border border-makina-border p-6 space-y-5 animate-fade-in-up hover-lift"
              style={{ animationDelay: "100ms" }}
            >
              {/* Category selector */}
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

              {/* Quick reactions */}
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

              {/* Message */}
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

              {/* Submit */}
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

            {/* Community feed */}
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
              <LiveFeed feedback={MOCK_FEEDBACK} category={feedbackFilter} />
            </div>
          </div>

          {/* ── Right sidebar: Team Activity ── */}
          <aside className="hidden lg:block space-y-4">
            {/* Response metrics */}
            <div className="rounded-2xl bg-makina-card border border-makina-border p-4 space-y-4 animate-fade-in-up">
              <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">Team responsiveness</span>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-makina-accent-dim">
                    <Clock size={14} className="text-makina-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">~4h</p>
                    <p className="text-[11px] text-makina-muted">Avg. response time</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-makina-green/10">
                    <CheckCircle2 size={14} className="text-makina-green" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">89%</p>
                    <p className="text-[11px] text-makina-muted">Resolution rate</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-makina-blue/10">
                    <Users size={14} className="text-makina-blue" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">284</p>
                    <p className="text-[11px] text-makina-muted">Contributors this month</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recently resolved */}
            <div className="rounded-2xl bg-makina-card border border-makina-border p-4 space-y-3 animate-fade-in-up" style={{ animationDelay: "50ms" }}>
              <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">Recently addressed</span>
              <div className="space-y-3">
                {RECENTLY_RESOLVED.map((item, i) => (
                  <div key={i} className="group flex items-start gap-2.5">
                    <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-makina-green shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-makina-text leading-snug">{item.title}</p>
                      <p className="text-[11px] text-makina-subtle mt-0.5">{item.category} &middot; {item.timeAgo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social proof nudge */}
            <div className="rounded-2xl bg-makina-accent-dim border border-makina-accent/20 p-4 space-y-2 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-makina-accent" />
                <span className="text-xs font-semibold text-makina-accent">Your voice matters</span>
              </div>
              <p className="text-[11px] text-makina-muted leading-relaxed">
                74% of feature requests from last month have already been reviewed by the team.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

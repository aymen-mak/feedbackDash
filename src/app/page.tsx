"use client";

import { useState } from "react";
import { Send, Check, EyeOff, MessageSquare, Zap, TrendingUp, Users, Hash, Flame, Sparkles, BarChart3 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Tooltip from "@/components/Tooltip";
import { QUICK_ACTIONS, CATEGORY_STATS, type CategoryId } from "@/lib/mock-data";

const CATEGORIES: CategoryId[] = ["Product", "UX", "Support"];

const categoryPrompts: Record<CategoryId, string> = {
  Product: "What would you improve about the product?",
  UX: "What felt confusing or could work better?",
  Support: "How can we help you?",
};

// Auto-tallied from quick reaction clicks — no team effort
const TRENDING_REACTIONS = [
  { emoji: "🎉", label: "Love it!", count: 127 },
  { emoji: "💡", label: "Feature request", count: 89 },
  { emoji: "✨", label: "Easy to use", count: 64 },
  { emoji: "🔧", label: "Needs improvement", count: 41 },
];

// Auto-detected from feedback text — keyword extraction, no curation
const TRENDING_TOPICS = [
  { topic: "Dark mode", mentions: 23, trend: "up" as const, category: "UX" as CategoryId },
  { topic: "Export features", mentions: 18, trend: "steady" as const, category: "Product" as CategoryId },
  { topic: "Onboarding flow", mentions: 12, trend: "new" as const, category: "UX" as CategoryId },
];

// Auto-calculated from feedback text sentiment — no manual tagging
const SENTIMENT = { positive: 62, neutral: 24, needsAttention: 14 };

// Aggregate reaction totals — auto-tallied
const REACTION_TOTALS = [
  { emoji: "🎉", label: "Love it!", count: 127, pct: 30 },
  { emoji: "✨", label: "Easy to use", count: 89, pct: 21 },
  { emoji: "💡", label: "Feature request", count: 72, pct: 17 },
  { emoji: "👏", label: "Great support", count: 58, pct: 14 },
  { emoji: "🔧", label: "Needs improvement", count: 41, pct: 10 },
  { emoji: "🐛", label: "Bug report", count: 22, pct: 5 },
  { emoji: "😕", label: "Confusing", count: 12, pct: 3 },
];

const trendIcon = {
  up: "↑",
  steady: "→",
  new: "★",
};

const trendColor = {
  up: "text-makina-green",
  steady: "text-makina-blue",
  new: "text-makina-accent",
};

export default function FeedbackPage() {
  const [category, setCategory] = useState<CategoryId>("Product");
  const [quickAction, setQuickAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
            <h1 className="text-3xl font-bold tracking-tight">Makina <span className="gradient-text">Pulse</span></h1>
            <p className="text-sm text-makina-subtle">Your feedback shapes what we build next</p>
          </div>

          {/* Inline metrics strip — all auto-calculated, no team effort */}
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <Tooltip content="Total feedback submissions across all categories">
              <div className="flex items-center gap-2 cursor-default">
                <MessageSquare size={13} className="text-makina-muted" />
                <span className="text-sm font-semibold">{totalSubmissions}</span>
                <span className="text-xs text-makina-green font-medium">+12%</span>
              </div>
            </Tooltip>
            <div className="h-4 w-px bg-makina-border hidden sm:block" />
            <Tooltip content="Positive sentiment auto-detected from feedback text">
              <div className="flex items-center gap-2 cursor-default">
                <TrendingUp size={13} className="text-makina-muted" />
                <span className="text-sm font-semibold">{SENTIMENT.positive}%</span>
                <span className="text-xs text-makina-muted">positive</span>
              </div>
            </Tooltip>
            <div className="h-4 w-px bg-makina-border hidden sm:block" />
            <Tooltip content="Submissions received in the last 7 days">
              <div className="flex items-center gap-2 cursor-default">
                <BarChart3 size={13} className="text-makina-muted" />
                <span className="text-sm font-semibold">148</span>
                <span className="text-xs text-makina-muted">this week</span>
              </div>
            </Tooltip>
            <div className="h-4 w-px bg-makina-border hidden sm:block" />
            <Tooltip content="Unique contributors who submitted feedback">
              <div className="flex items-center gap-2 cursor-default">
                <Users size={13} className="text-makina-muted" />
                <span className="text-sm font-semibold">284</span>
                <span className="text-xs text-makina-muted">contributors</span>
              </div>
            </Tooltip>
          </div>
        </div>

        {/* ── Zone 2: Form + Context (2-column) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>

          {/* Form card */}
          <div className="rounded-lg bg-makina-card border border-makina-border p-6 space-y-5 hover-lift">
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
                className="w-full resize-none rounded-md bg-makina-surface border border-makina-border px-4 py-3 text-sm text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50 transition-colors"
                rows={3}
              />
            </div>

            {submitted ? (
              <div className="flex items-center justify-center gap-2 rounded-md bg-makina-green/10 py-3 animate-success">
                <Check size={16} className="text-makina-green" />
                <span className="text-sm font-medium text-makina-green">Feedback submitted! Thank you.</span>
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full flex items-center justify-center gap-2 rounded-md gradient-accent py-3 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed glow-accent"
              >
                <Send size={14} />
                Submit Feedback
              </button>
            )}
          </div>

          {/* Context panel */}
          <div className="space-y-4">
            {/* Trending reactions — auto-tallied from clicks */}
            <div className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-3">
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

            {/* Category breakdown — auto-counted */}
            <div className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-3">
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

            {/* Social proof — no team work implied */}
            <div className="rounded-lg bg-makina-accent-dim border border-makina-accent/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-makina-accent" />
                <span className="text-xs font-semibold text-makina-accent">Your voice matters</span>
              </div>
              <p className="text-[11px] text-makina-muted leading-relaxed">
                Your feedback joins {totalSubmissions} submissions shaping our roadmap. Every voice counts.
              </p>
            </div>
          </div>
        </div>

        {/* ── Zone 3: Trending Topics — auto-extracted, no curation ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
          {TRENDING_TOPICS.map((item) => (
            <div key={item.topic} className="flex items-start gap-3 rounded-lg bg-makina-card border border-makina-border p-4 hover-lift">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-makina-surface shrink-0">
                {item.trend === "up" ? <Flame size={14} className="text-makina-green" /> :
                 item.trend === "new" ? <Sparkles size={14} className="text-makina-accent" /> :
                 <Hash size={14} className="text-makina-muted" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-makina-text">{item.topic}</p>
                  <span className={`text-[10px] font-medium ${trendColor[item.trend]}`}>
                    {trendIcon[item.trend]} {item.trend}
                  </span>
                </div>
                <p className="text-[11px] text-makina-muted mt-0.5">
                  {item.mentions} mentions &middot; {item.category}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Zone 4: Community Pulse — all aggregated, zero team effort ── */}
        <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <h2 className="text-lg font-semibold">Community Pulse</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sentiment breakdown — auto-calculated from text */}
            <div className="rounded-lg bg-makina-card border border-makina-border p-5 space-y-4">
              <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">Sentiment breakdown</span>
              <div className="space-y-3">
                <div className="flex h-3 rounded-full overflow-hidden">
                  <div className="bg-makina-green transition-all" style={{ width: `${SENTIMENT.positive}%` }} />
                  <div className="bg-makina-blue transition-all" style={{ width: `${SENTIMENT.neutral}%` }} />
                  <div className="bg-amber-500 transition-all" style={{ width: `${SENTIMENT.needsAttention}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-makina-green" />
                    <span className="text-makina-text">Positive</span>
                    <span className="text-makina-muted font-semibold">{SENTIMENT.positive}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-makina-blue" />
                    <span className="text-makina-text">Neutral</span>
                    <span className="text-makina-muted font-semibold">{SENTIMENT.neutral}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-makina-text">Needs attention</span>
                    <span className="text-makina-muted font-semibold">{SENTIMENT.needsAttention}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reaction totals — auto-tallied from clicks */}
            <div className="rounded-lg bg-makina-card border border-makina-border p-5 space-y-4">
              <span className="text-xs font-medium text-makina-muted uppercase tracking-wider">Top reactions this month</span>
              <div className="space-y-2">
                {REACTION_TOTALS.slice(0, 5).map((r) => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="text-sm w-5 text-center">{r.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-makina-text">{r.label}</span>
                        <span className="text-[11px] text-makina-muted font-medium">{r.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-makina-surface overflow-hidden">
                        <div
                          className="h-full rounded-full gradient-accent transition-all"
                          style={{ width: `${r.pct * 2}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

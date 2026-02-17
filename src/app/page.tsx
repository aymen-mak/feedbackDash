"use client";

import { useState } from "react";
import { Send, Check, EyeOff, MessageSquare } from "lucide-react";
import Navbar from "@/components/Navbar";
import LiveFeed from "@/components/LiveFeed";
import { MOCK_FEEDBACK, QUICK_ACTIONS, type CategoryId } from "@/lib/mock-data";

const CATEGORIES: CategoryId[] = ["Product", "UX", "Support"];

const categoryPrompts: Record<CategoryId, string> = {
  Product: "What would you improve about the product?",
  UX: "What felt confusing or could work better?",
  Support: "How can we help you?",
};

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

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-10 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full bg-makina-accent-dim px-4 py-1.5">
            <MessageSquare size={14} className="text-makina-accent" />
            <span className="text-xs font-medium text-makina-accent">We read every submission</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Feedback<span className="gradient-accent bg-clip-text text-transparent">Hub</span></h1>
          <p className="text-sm text-makina-subtle">
            powered by <span className="text-makina-muted font-medium">makina</span>
          </p>
        </div>

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
      </main>
    </div>
  );
}

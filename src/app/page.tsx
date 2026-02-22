"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Check, EyeOff, MessageSquare, Zap, Users, Hash, Flame, Sparkles, BarChart3, User, Image as ImageIcon, X, Upload } from "lucide-react";
import Navbar from "@/components/Navbar";
import Tooltip from "@/components/Tooltip";

type CategoryId = "Product" | "UX";
const CATEGORIES: CategoryId[] = ["Product", "UX"];

type FeedbackType = "suggestion" | "issue" | "question";

const SEVERITY_OPTIONS: { id: FeedbackType; label: string; description: string; color: string; selectedBg: string }[] = [
  { id: "suggestion", label: "Suggestion", description: "An idea or improvement", color: "text-blue-400 border-blue-500/20", selectedBg: "bg-blue-500 text-white border-blue-500" },
  { id: "issue", label: "Issue", description: "Something broken or wrong", color: "text-amber-400 border-amber-500/20", selectedBg: "bg-amber-500 text-white border-amber-500" },
  { id: "question", label: "Question", description: "Need help or clarification", color: "text-makina-accent border-makina-accent/20", selectedBg: "bg-makina-accent text-white border-makina-accent" },
];

const categoryPrompts: Record<CategoryId, string> = {
  Product: "What would you improve about the product?",
  UX: "What felt confusing or could work better?",
};

const QUICK_ACTIONS = [
  { id: "love-it", emoji: "\u{1F389}", label: "Love it!" },
  { id: "easy-to-use", emoji: "\u2728", label: "Easy to use" },
  { id: "great-support", emoji: "\u{1F44F}", label: "Great support" },
  { id: "impressive", emoji: "\u{1F929}", label: "Impressive" },
  { id: "helpful", emoji: "\u{1F64C}", label: "Helpful" },
  { id: "confusing", emoji: "\u{1F615}", label: "Confusing" },
];

interface Stats {
  total: number;
  contributors: number;
  weeklyVolume: number;
  categoryStats: { id: string; submissions: number; openIssues: number; satisfaction: number }[];
  reactionTotals: { id: string; emoji: string; label: string; count: number; pct: number }[];
  trendingTopics: { topic: string; mentions: number; trend: "up" | "steady" | "new"; category: string }[];
}

const trendIcon = { up: "\u2191", steady: "\u2192", new: "\u2605" };
const trendColor = { up: "text-makina-green", steady: "text-makina-blue", new: "text-makina-accent" };

export default function FeedbackPage() {
  const [category, setCategory] = useState<CategoryId>("Product");
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("suggestion");
  const [quickAction, setQuickAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`Stats API returned ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data && typeof data.total === "number") setStats(data);
      })
      .catch((err) => console.error("Failed to load stats:", err));
  }, []);

  const handleScreenshotUpload = async (file: File) => {
    if (!file.type.includes("jpeg") && !file.type.includes("jpg")) {
      setError("Only JPG images are accepted.");
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setError("Screenshot must be under 1.5MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setScreenshotUrl(data.url);
      } else {
        setError("Failed to upload screenshot.");
      }
    } catch {
      setError("Could not upload screenshot.");
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!message.trim() && !quickAction) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          type: feedbackType,
          message: message.trim(),
          quickAction,
          anonymous,
          userName: anonymous ? "Anonymous" : userName.trim() || "Anonymous",
          screenshotUrl: screenshotUrl || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json().catch(() => null);
        if (created?.id) {
          try {
            const stored = localStorage.getItem("makina-my-feedback-ids");
            const ids: string[] = stored ? JSON.parse(stored) : [];
            if (!ids.includes(created.id)) ids.push(created.id);
            localStorage.setItem("makina-my-feedback-ids", JSON.stringify(ids));
          } catch { /* ignore */ }
        }
        setMessage("");
        setQuickAction(null);
        setUserName("");
        setFeedbackType("suggestion");
        setScreenshotUrl("");
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 2500);
        fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Submission failed (${res.status}). Please try again.`);
      }
    } catch (err) {
      console.error("Submit error:", err);
      setError("Could not connect to the server. Make sure you're running 'npm run dev'.");
    }
    setSubmitting(false);
  };

  const canSubmit = (message.trim() || quickAction) && !submitting;
  const totalSubmissions = stats?.total ?? 0;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">

        {/* Zone 1: Hero + Metrics */}
        <div className="text-center space-y-4 animate-fade-in-up">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-makina-accent-dim px-4 py-1.5">
              <MessageSquare size={14} className="text-makina-accent" />
              <span className="text-xs font-medium text-makina-accent">Share your thoughts</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Makina <span className="gradient-text">Pulse</span></h1>
            <p className="text-sm text-makina-subtle">Your feedback shapes what we build next</p>
          </div>

          {/* Inline metrics strip */}
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <Tooltip content="Total feedback submissions across all categories">
              <div className="flex items-center gap-2 cursor-default">
                <MessageSquare size={13} className="text-makina-muted" />
                <span className="text-sm font-semibold">{totalSubmissions}</span>
                <span className="text-xs text-makina-green font-medium">+12%</span>
              </div>
            </Tooltip>
            <div className="h-4 w-px bg-makina-border hidden sm:block" />
            <Tooltip content="Submissions received in the last 7 days">
              <div className="flex items-center gap-2 cursor-default">
                <BarChart3 size={13} className="text-makina-muted" />
                <span className="text-sm font-semibold">{stats?.weeklyVolume ?? 0}</span>
                <span className="text-xs text-makina-muted">this week</span>
              </div>
            </Tooltip>
            <div className="h-4 w-px bg-makina-border hidden sm:block" />
            <Tooltip content="Unique contributors who submitted feedback">
              <div className="flex items-center gap-2 cursor-default">
                <Users size={13} className="text-makina-muted" />
                <span className="text-sm font-semibold">{stats?.contributors ?? 0}</span>
                <span className="text-xs text-makina-muted">contributors</span>
              </div>
            </Tooltip>
          </div>
        </div>

        {/* Zone 2: Form + Context */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>

          {/* Form card */}
          <div className="rounded-lg bg-makina-card border border-makina-border p-6 space-y-5 hover-lift">
            {/* Category */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-makina-text/70 uppercase tracking-wider mb-3 block">Category</label>
              <div className="flex gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      category === cat
                        ? "gradient-accent text-makina-bg"
                        : "bg-makina-card border border-makina-border text-makina-text/80 hover:border-makina-accent/30 hover:text-makina-text"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback type / severity */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-makina-text/70 uppercase tracking-wider">What kind of feedback?</label>
              <div className="grid grid-cols-3 gap-2">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFeedbackType(opt.id)}
                    className={`rounded-lg px-3 py-2.5 text-left transition-all border ${
                      feedbackType === opt.id
                        ? opt.selectedBg
                        : "bg-makina-card text-makina-text border-makina-border hover:border-makina-accent/30"
                    }`}
                  >
                    <span className="text-xs font-semibold block">{opt.label}</span>
                    <span className={`text-[10px] block mt-0.5 ${feedbackType === opt.id ? "text-white/70" : "text-makina-text/60"}`}>{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick reactions -- compact row */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-makina-text/60 uppercase tracking-wider">Quick reaction <span className="normal-case">(optional)</span></label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => setQuickAction(quickAction === action.id ? null : action.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-all ${
                      quickAction === action.id
                        ? "bg-makina-accent-dim text-makina-accent border border-makina-accent/30"
                        : "bg-makina-card text-makina-text/70 border border-makina-border hover:text-makina-text hover:border-makina-accent/30"
                    }`}
                  >
                    <span className="text-[11px]">{action.emoji}</span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-makina-text/70 uppercase tracking-wider">Message</label>
                <button
                  type="button"
                  onClick={() => setAnonymous(!anonymous)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    anonymous
                      ? "bg-makina-accent-dim text-makina-accent border border-makina-accent/30"
                      : "bg-makina-card text-makina-text/60 border border-makina-border hover:border-makina-accent/30 hover:text-makina-text/80"
                  }`}
                >
                  <EyeOff size={10} />
                  Anonymous
                </button>
              </div>

              {!anonymous && (
                <div className="flex items-center gap-2">
                  <User size={13} className="text-makina-text/50 shrink-0" />
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="w-full rounded-md bg-makina-card border border-makina-border px-3 py-2 text-sm text-makina-text placeholder:text-makina-text/40 focus:outline-none focus:border-makina-accent/50 transition-colors"
                  />
                </div>
              )}

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={categoryPrompts[category]}
                className="w-full resize-none rounded-md bg-makina-card border border-makina-border px-4 py-3 text-sm text-makina-text placeholder:text-makina-text/40 focus:outline-none focus:border-makina-accent/50 transition-colors"
                rows={3}
              />
            </div>

            {/* Screenshot upload */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-makina-text/70 uppercase tracking-wider">Screenshot <span className="normal-case text-makina-text/50">(optional, JPG only, max 1.5MB)</span></label>
              {screenshotUrl ? (
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-16 rounded-md overflow-hidden border border-makina-border">
                    <img src={screenshotUrl} alt="Screenshot preview" className="h-full w-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setScreenshotUrl(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="flex items-center gap-1 rounded-md bg-makina-card border border-makina-border px-2 py-1 text-xs text-makina-text/70 hover:text-red-400 hover:border-red-500/30 transition-colors"
                  >
                    <X size={12} />
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 rounded-md bg-makina-card border border-makina-border px-3 py-2 text-xs text-makina-text/70 hover:border-makina-accent/30 hover:text-makina-text transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Upload size={13} className="animate-pulse" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <ImageIcon size={13} />
                      Attach screenshot
                    </>
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleScreenshotUpload(file);
                }}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3">
                <span className="text-sm text-red-400">{error}</span>
              </div>
            )}

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
                {submitting ? "Submitting..." : "Submit Feedback"}
              </button>
            )}
          </div>

          {/* Context panel */}
          <div className="space-y-4 lg:self-center">
            {/* Category breakdown */}
            <div className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-3">
              <span className="text-xs font-medium text-makina-text/70 uppercase tracking-wider">Feedback Breakdown</span>
              <div className="space-y-2.5">
                {(stats?.categoryStats ?? []).map((cat) => (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-makina-text">{cat.id}</span>
                      <span className="text-xs text-makina-muted">{cat.submissions}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-makina-surface overflow-hidden">
                      <div
                        className="h-full rounded-full gradient-accent transition-all"
                        style={{ width: `${totalSubmissions > 0 ? (cat.submissions / totalSubmissions) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trending reactions -- compact */}
            <div className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-3">
              <span className="text-xs font-medium text-makina-text/70 uppercase tracking-wider">Common tags</span>
              <div className="flex flex-wrap gap-1.5">
                {(stats?.reactionTotals ?? []).slice(0, 6).map((r) => (
                  <span key={r.label} className="inline-flex items-center gap-1 rounded-md bg-makina-surface px-2 py-1 text-[11px] text-makina-muted">
                    <span>{r.emoji}</span>
                    <span>{r.label}</span>
                    <span className="text-makina-subtle font-medium">{r.count}</span>
                  </span>
                ))}
                {(!stats || stats.reactionTotals.length === 0) && (
                  <p className="text-xs text-makina-subtle">No tags yet</p>
                )}
              </div>
            </div>

            {/* Social proof */}
            <div className="rounded-lg bg-makina-accent-dim border border-makina-accent/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-makina-accent" />
                <span className="text-xs font-semibold text-makina-accent">Your voice matters</span>
              </div>
              <p className="text-[11px] text-makina-muted leading-relaxed">
                Help shape the future of Makina. Every submission is reviewed by our team.
              </p>
            </div>

            {/* How it works */}
            <div className="rounded-lg bg-makina-card border border-makina-border p-4 space-y-3">
              <span className="text-xs font-medium text-makina-text/70 uppercase tracking-wider mb-3 block">How it works</span>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-makina-accent/15 text-[10px] font-bold text-makina-accent">1</div>
                  <div>
                    <p className="text-xs font-medium text-makina-text">Submit feedback</p>
                    <p className="text-[10px] text-makina-muted mt-0.5">Pick a category, type, and share your thoughts.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-makina-accent/15 text-[10px] font-bold text-makina-accent">2</div>
                  <div>
                    <p className="text-xs font-medium text-makina-text">Team reviews</p>
                    <p className="text-[10px] text-makina-muted mt-0.5">Our team reads and triages every submission.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-makina-accent/15 text-[10px] font-bold text-makina-accent">3</div>
                  <div>
                    <p className="text-xs font-medium text-makina-text">Track progress</p>
                    <p className="text-[10px] text-makina-muted mt-0.5">Check the dashboard to see the status of your feedback.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Zone 3: Trending Topics */}
        {stats && stats.trendingTopics.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
            {stats.trendingTopics.slice(0, 3).map((item) => (
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
        )}

      </main>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Check, EyeOff, Zap, User, Image as ImageIcon, X, Upload, Inbox, ChevronUp, ChevronDown, Sun, Moon, Droplets, Link2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import LiveFeed from "@/components/LiveFeed";
import { type FeedbackItemData } from "@/components/FeedbackCard";
import { useLoadingBar } from "@/components/LoadingBar";
import { useTheme } from "@/lib/theme";

type CategoryId = "Core" | "UI/UX" | "App" | "Operator CLI";
const CATEGORIES: CategoryId[] = ["Core", "UI/UX", "App", "Operator CLI"];

type FeedbackType = "suggestion" | "issue" | "question";

const SEVERITY_OPTIONS: { id: FeedbackType; label: string; description: string; color: string; selectedBg: string }[] = [
  { id: "suggestion", label: "Suggestion", description: "An idea or improvement", color: "text-blue-400 border-blue-500/20", selectedBg: "bg-blue-500 text-white border-blue-500" },
  { id: "issue", label: "Issue", description: "Something broken or wrong", color: "text-amber-400 border-amber-500/20", selectedBg: "bg-amber-500 text-white border-amber-500" },
  { id: "question", label: "Question", description: "Need help or clarification", color: "text-makina-accent border-makina-accent/20", selectedBg: "bg-makina-accent text-white border-makina-accent" },
];

const categoryPrompts: Record<CategoryId, string> = {
  Core: "What would you improve about the core platform?",
  "UI/UX": "What felt confusing or could work better?",
  App: "How can we improve the app experience?",
  "Operator CLI": "What would make the CLI better?",
};

const QUICK_ACTIONS = [
  { id: "works-well", label: "Works well" },
  { id: "needs-improvement", label: "Needs improvement" },
  { id: "missing-feature", label: "Missing feature" },
  { id: "performance-issue", label: "Performance issue" },
  { id: "hard-to-use", label: "Hard to use" },
  { id: "good-docs", label: "Good documentation" },
];

interface Stats {
  total: number;
  categoryStats: { id: string; submissions: number; openIssues: number; satisfaction: number }[];
  reactionTotals: { id: string; emoji: string; label: string; count: number; pct: number }[];
}

export default function FeedbackPage() {
  const [category, setCategory] = useState<CategoryId>("Core");
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
  const [myFeedback, setMyFeedback] = useState<FeedbackItemData[]>([]);
  const [hideSubmissions, setHideSubmissions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { start: lbStart, done: lbDone } = useLoadingBar();

  useEffect(() => {
    let ids: string[] = [];
    try {
      const stored = localStorage.getItem("makina-my-feedback-ids");
      if (stored) ids = JSON.parse(stored);
    } catch { /* ignore */ }

    const feedbackUrl = ids.length > 0
      ? `/api/feedback?ids=${ids.join(",")}`
      : null;

    Promise.all([
      fetch("/api/stats").then((r) => r.ok ? r.json() : null),
      feedbackUrl ? fetch(feedbackUrl).then((r) => r.ok ? r.json() : []) : Promise.resolve([]),
    ]).then(([st, fb]) => {
      if (st && typeof st.total === "number") setStats(st);
      if (Array.isArray(fb)) setMyFeedback(fb);
    }).catch(() => {});
  }, []);

  const handleScreenshotUpload = async (file: File) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.some((t) => file.type.includes(t)) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setError("Only JPG, PNG, or WebP images are accepted.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Screenshot must be under 5MB.");
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
      const data = await res.json();
      if (res.ok && data.url) {
        setScreenshotUrl(data.url);
      } else {
        setError(data.error || "Failed to upload screenshot.");
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
    lbStart();
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
          if (created) setMyFeedback((prev) => [created, ...prev]);
        }
        setMessage("");
        setQuickAction(null);
        setUserName("");
        setFeedbackType("suggestion");
        setScreenshotUrl("");
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Submission failed (${res.status}). Please try again.`);
      }
    } catch (err) {
      console.error("Submit error:", err);
      setError("Could not connect to the server. Make sure you're running 'npm run dev'.");
    }
    setSubmitting(false);
    lbDone();
  };

  const canSubmit = (message.trim() || quickAction) && !submitting;
  const totalSubmissions = stats?.total ?? 0;

  const handleMyItemUpdate = (updated: FeedbackItemData) => {
    setMyFeedback((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  };

  const { theme, toggle, textSize, textSizeLabel, cycleTextSize } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.origin;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const themeIcon: Record<string, React.ReactNode> = {
    dark: <Sun size={15} />,
    light: <Droplets size={15} />,
    glass: <Moon size={15} />,
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pt-10 pb-8 space-y-6">

        {/* Centered logo + utility controls */}
        <div className="flex flex-col items-center gap-4 animate-fade-in-up">
          {/* Logo, use trimmed images with natural proportions */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={theme === "light" ? "/makina_pulse_logo_trimmed_dark.png" : "/makina_pulse_logo_trimmed.png"}
            alt="Makina Pulse"
            className="h-16 w-auto"
          />

          <p className="text-sm text-makina-muted">Your feedback shapes what we build next</p>

          {/* Compact utility controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={cycleTextSize}
              className={`rounded-lg px-2 py-1.5 text-xs font-bold transition-all flex items-center gap-1 ${
                textSize > 0
                  ? "text-makina-accent bg-makina-accent-dim"
                  : "text-makina-muted hover:text-makina-text hover:bg-makina-surface"
              }`}
              title={`Text size: ${textSizeLabel}`}
            >
              Aa
              <span className="flex items-center gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`inline-block w-1 h-1 rounded-full bg-current ${i <= textSize ? "opacity-100" : "opacity-25"}`} />
                ))}
              </span>
            </button>
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-makina-muted hover:text-makina-text hover:bg-makina-surface transition-all"
              title="Toggle theme"
            >
              {themeIcon[theme]}
            </button>
            <button
              onClick={handleShare}
              className="relative rounded-lg p-2 text-makina-muted hover:text-makina-text hover:bg-makina-surface transition-all"
              title="Copy feedback link"
            >
              {copied ? <Check size={15} className="text-makina-green" /> : <Link2 size={15} />}
            </button>
          </div>
        </div>

        {/* Zone 2: Form + Context */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 animate-fade-in-up" style={{ animationDelay: "100ms" }}>

          {/* Form card */}
          <div className="rounded-xl bg-makina-card border border-makina-border overflow-hidden hover-lift">
            {/* Card header */}
            <div className="px-6 py-4 border-b border-makina-border/60 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-makina-text">Submit Feedback</h2>
                <p className="text-[11px] text-makina-muted mt-0.5">{categoryPrompts[category]}</p>
              </div>
              {/* Category pills in header */}
              <div className="flex gap-1.5">
                {CATEGORIES.map((cat) => {
                  const activeColor: Record<string, string> = {
                    Core: "bg-blue-500 text-white",
                    "UI/UX": "bg-violet-500 text-white",
                    App: "bg-emerald-500 text-white",
                    "Operator CLI": "bg-orange-500 text-white",
                  };
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        category === cat
                          ? activeColor[cat]
                          : "bg-makina-surface border border-makina-border text-makina-text/70 hover:border-makina-accent/30 hover:text-makina-text"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Feedback type / severity */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-makina-text/60 uppercase tracking-wider">Type of feedback</label>
                <div className="grid grid-cols-3 gap-2">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setFeedbackType(opt.id)}
                      className={`rounded-lg px-3 py-2.5 text-left transition-all border ${
                        feedbackType === opt.id
                          ? opt.selectedBg
                          : "bg-makina-surface text-makina-text border-makina-border hover:border-makina-accent/30"
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
                <label className="text-[10px] font-medium text-makina-text/50 uppercase tracking-wider">Quick tag <span className="normal-case">(optional)</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => setQuickAction(quickAction === action.id ? null : action.id)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] transition-all ${
                        quickAction === action.id
                          ? "bg-makina-accent-dim text-makina-accent border border-makina-accent/30"
                          : "bg-makina-surface text-makina-text/70 border border-makina-border hover:text-makina-text hover:border-makina-accent/30"
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-makina-text/60 uppercase tracking-wider">Your message</label>
                  <button
                    type="button"
                    onClick={() => setAnonymous(!anonymous)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                      anonymous
                        ? "bg-makina-accent-dim text-makina-accent border border-makina-accent/30"
                        : "bg-makina-surface text-makina-text/60 border border-makina-border hover:border-makina-accent/30 hover:text-makina-text/80"
                    }`}
                  >
                    <EyeOff size={10} />
                    Anonymous
                  </button>
                </div>

                {!anonymous && (
                  <div className="flex items-center gap-2 rounded-md bg-makina-surface border border-makina-border px-3 py-2">
                    <User size={13} className="text-makina-text/40 shrink-0" />
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Your name (optional)"
                      className="flex-1 bg-transparent text-sm text-makina-text placeholder:text-makina-text/35 focus:outline-none"
                    />
                  </div>
                )}

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full resize-none rounded-md bg-makina-surface border border-makina-border px-4 py-3 text-sm text-makina-text placeholder:text-makina-text/35 focus:outline-none focus:border-makina-accent/50 transition-colors"
                  rows={4}
                />
              </div>

              {/* Screenshot upload */}
              <div className="flex items-center gap-3">
                {screenshotUrl ? (
                  <>
                    <div className="relative h-14 w-14 rounded-md overflow-hidden border border-makina-border shrink-0">
                      <img src={screenshotUrl} alt="Screenshot preview" className="h-full w-full object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setScreenshotUrl(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="flex items-center gap-1 rounded-md bg-makina-surface border border-makina-border px-2 py-1 text-xs text-makina-text/60 hover:text-red-400 hover:border-red-500/30 transition-colors"
                    >
                      <X size={12} />
                      Remove screenshot
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 rounded-md bg-makina-surface border border-makina-border px-3 py-2 text-xs text-makina-text/60 hover:border-makina-accent/30 hover:text-makina-text transition-colors disabled:opacity-50"
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
                        <span className="text-makina-text/40 ml-0.5">· JPG/PNG, max 5MB</span>
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
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
                  className="w-full flex items-center justify-center gap-2 rounded-lg gradient-accent py-3 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed glow-accent"
                >
                  <Send size={14} />
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </button>
              )}
            </div>
          </div>

          {/* Context panel */}
          <div className="space-y-4 lg:self-start">
            {/* Category breakdown */}
            <div className="rounded-xl bg-makina-card border border-makina-border p-4 space-y-3">
              <span className="text-xs font-semibold text-makina-text/60 uppercase tracking-wider">Feedback Breakdown</span>
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

            {/* Common tags */}
            <div className="rounded-xl bg-makina-card border border-makina-border p-4 space-y-3">
              <span className="text-xs font-semibold text-makina-text/60 uppercase tracking-wider">Common Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {(stats?.reactionTotals ?? []).slice(0, 6).map((r) => (
                  <span key={r.label} className="inline-flex items-center gap-1 rounded-md bg-makina-surface border border-makina-border/50 px-2 py-1 text-[11px] text-makina-muted">
                    <span>{r.label}</span>
                    <span className="text-makina-subtle font-medium ml-0.5">{r.count}</span>
                  </span>
                ))}
                {(!stats || stats.reactionTotals.length === 0) && (
                  <p className="text-xs text-makina-subtle">No tags yet</p>
                )}
              </div>
            </div>

            {/* Social proof */}
            <div className="rounded-xl bg-makina-accent-dim border border-makina-accent/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Zap size={13} className="text-makina-accent" />
                <span className="text-xs font-semibold text-makina-accent">Your voice matters</span>
              </div>
              <p className="text-[11px] text-makina-muted leading-relaxed">
                Help shape the future of Makina. Every submission is reviewed by our team.
              </p>
            </div>

            {/* How it works */}
            <div className="rounded-xl bg-makina-card border border-makina-border p-4 space-y-3">
              <span className="text-xs font-semibold text-makina-text/60 uppercase tracking-wider">How it works</span>
              <div className="space-y-3">
                {[
                  { n: "1", title: "Submit feedback", desc: "Pick a category, type, and share your thoughts." },
                  { n: "2", title: "Team reviews", desc: "Our team reads and triages every submission." },
                  { n: "3", title: "Track progress", desc: "Your submissions appear below so you can follow up." },
                ].map((step) => (
                  <div key={step.n} className="flex items-start gap-2.5">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-makina-accent/15 text-[10px] font-bold text-makina-accent">{step.n}</div>
                    <div>
                      <p className="text-xs font-medium text-makina-text">{step.title}</p>
                      <p className="text-[10px] text-makina-muted mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* My submissions */}
        {myFeedback.length > 0 && (
          <div className="space-y-3 pt-2 animate-fade-in-up" style={{ animationDelay: "150ms" }}>
            <div className="flex items-center gap-2 border-t border-makina-border pt-6">
              <Inbox size={14} className="text-makina-muted" />
              <h2 className="text-xs font-semibold text-makina-muted uppercase tracking-wider">My Submissions</h2>
              <span className="text-[10px] text-makina-muted bg-makina-surface rounded-full px-1.5 py-0.5">{myFeedback.length}</span>
              <button
                onClick={() => setHideSubmissions(!hideSubmissions)}
                className="ml-auto flex items-center gap-1 text-[11px] text-makina-muted hover:text-makina-text transition-colors"
              >
                {hideSubmissions ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                {hideSubmissions ? "Show" : "Hide"}
              </button>
            </div>
            {!hideSubmissions && (
              <LiveFeed
                feedback={myFeedback}
                category="all"
                hideReplyInput
                hideReplies
                hidePublicStatus
                hidePriority
                onItemUpdate={handleMyItemUpdate}
              />
            )}
          </div>
        )}

      </main>
    </div>
  );
}

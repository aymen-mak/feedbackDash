"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Check, EyeOff, MessageSquare, Zap, Users, Hash, Flame, Sparkles, BarChart3, User, Image as ImageIcon, X, Upload } from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Tooltip from "@/components/Tooltip";

export default function LandingPage() {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen overflow-hidden">
      {/* ── Hero Section ── */}
      <section className="relative min-h-[92vh] flex flex-col items-center justify-center px-4">
        {/* Ambient glow backdrop */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-makina-accent/[0.04] blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-makina-blue/[0.03] blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-makina-accent/[0.025] blur-[80px]" />
        </div>

        {/* Isometric scene - floating above hero */}
        <div className="relative mb-10 animate-fade-in-up">
          <div className="iso-scene">
            {/* Central platform */}
            <div className="iso-platform" />

        {/* Zone 1: Hero + Metrics */}
        <div className="text-center space-y-4 animate-fade-in-up">
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Link href="/" className="inline-block">
              <img src="/logo-mark.svg" alt="Makina Pulse" width={72} height={72} className="mx-auto hover:opacity-80 transition-opacity cursor-pointer" />
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Makina <span className="gradient-text">Pulse</span></h1>
            <p className="text-sm text-makina-muted">Your feedback shapes what we build next</p>
          </div>

            {/* Pulse rings radiating from center */}
            <div className="iso-pulse iso-pulse-1" />
            <div className="iso-pulse iso-pulse-2" />
            <div className="iso-pulse iso-pulse-3" />

            {/* Small floating dots (data points) */}
            <div className="iso-dot iso-dot-1" />
            <div className="iso-dot iso-dot-2" />
            <div className="iso-dot iso-dot-3" />
            <div className="iso-dot iso-dot-4" />
            <div className="iso-dot iso-dot-5" />
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
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      category === cat
                        ? "gradient-accent text-makina-bg"
                        : "bg-makina-surface border border-makina-border text-makina-text/70 hover:border-makina-accent/30 hover:text-makina-text"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
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
                <label className="text-[10px] font-medium text-makina-text/50 uppercase tracking-wider">Quick reaction <span className="normal-case">(optional)</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => setQuickAction(quickAction === action.id ? null : action.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-all ${
                        quickAction === action.id
                          ? "bg-makina-accent-dim text-makina-accent border border-makina-accent/30"
                          : "bg-makina-surface text-makina-text/70 border border-makina-border hover:text-makina-text hover:border-makina-accent/30"
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
                        <span className="text-makina-text/40 ml-0.5">· JPG, max 1.5MB</span>
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
                  className="w-full flex items-center justify-center gap-2 rounded-lg gradient-accent py-3 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed glow-accent"
                >
                  <Send size={14} />
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </button>
              )}
            </div>
          </div>

          {/* Context panel */}
          <div className="space-y-4 lg:sticky lg:top-6">
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
              <span className="text-xs font-semibold text-makina-text/60 uppercase tracking-wider">Common Reactions</span>
              <div className="flex flex-wrap gap-1.5">
                {(stats?.reactionTotals ?? []).slice(0, 6).map((r) => (
                  <span key={r.label} className="inline-flex items-center gap-1 rounded-md bg-makina-surface border border-makina-border/50 px-2 py-1 text-[11px] text-makina-muted">
                    <span>{r.emoji}</span>
                    <span>{r.label}</span>
                    <span className="text-makina-subtle font-medium ml-0.5">{r.count}</span>
                  </span>
                ))}
                {(!stats || stats.reactionTotals.length === 0) && (
                  <p className="text-xs text-makina-subtle">No reactions yet</p>
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
                  { n: "3", title: "Track progress", desc: "Check the dashboard to see the status of your feedback." },
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

        {/* Zone 3: Trending Topics */}
        {stats && stats.trendingTopics.length > 0 && (
          <div className={`grid gap-3 animate-fade-in-up ${
            stats.trendingTopics.length === 1 ? "grid-cols-1 max-w-md" :
            stats.trendingTopics.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
            "grid-cols-1 sm:grid-cols-3"
          }`} style={{ animationDelay: "150ms" }}>
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
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-makina-muted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What you can do ── */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <Lightbulb size={18} />, title: "Suggest ideas", desc: "Have a feature in mind? Tell us. The best ideas come from real users." },
              { icon: <Zap size={18} />, title: "Quick reactions", desc: "Short on time? Use one-tap labels like \"Love it!\" or \"Needs improvement\"." },
              { icon: <ImageIcon size={18} />, title: "Attach screenshots", desc: "A picture is worth a thousand words. Show us exactly what you see." },
              { icon: <MessageSquare size={18} />, title: "Report issues", desc: "Found a bug or something broken? Flag it so we can fix it fast." },
              { icon: <Eye size={18} />, title: "Stay anonymous", desc: "Prefer not to share your name? Toggle anonymous mode. It's your call." },
            ].map((cap, i) => (
              <div
                key={cap.title}
                className="rounded-xl bg-makina-card/60 border border-makina-border/60 p-6 hover:border-makina-accent/20 transition-colors animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-makina-surface text-makina-accent mb-4">
                  {cap.icon}
                </div>
                <h4 className="text-sm font-bold mb-1">{cap.title}</h4>
                <p className="text-xs text-makina-muted leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative px-4 py-20 text-center">
        <div className="mx-auto max-w-lg animate-fade-in-up">
          <h2 className="text-2xl font-bold mb-3">We&apos;re listening</h2>
          <p className="text-sm text-makina-muted mb-8">
            It only takes a minute. Your feedback directly influences what gets built next.
          </p>
          <Link
            href="/feedback"
            className="group inline-flex items-center gap-2.5 rounded-xl gradient-accent px-8 py-4 text-sm font-bold text-makina-bg shadow-lg shadow-makina-accent/20 hover:shadow-makina-accent/30 hover:brightness-110 transition-all"
          >
            Share Your Feedback
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-20 text-xs text-makina-subtle">
          &copy; 2026 Makina Finance. All rights reserved.
        </div>
      </section>
    </div>
  );
}

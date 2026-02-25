"use client";

import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { ArrowRight, MessageSquare, BarChart3, Users, Zap, Shield, Layers } from "lucide-react";

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

            {/* Floating feedback cards */}
            <div className="iso-card iso-card-1">
              <div className="iso-card-inner">
                <div className="w-6 h-1 rounded-full bg-makina-accent/60 mb-1.5" />
                <div className="w-10 h-1 rounded-full bg-makina-accent/30 mb-1" />
                <div className="w-8 h-1 rounded-full bg-makina-accent/20" />
              </div>
            </div>
            <div className="iso-card iso-card-2">
              <div className="iso-card-inner">
                <div className="w-5 h-1 rounded-full bg-makina-green/60 mb-1.5" />
                <div className="w-9 h-1 rounded-full bg-makina-green/30 mb-1" />
                <div className="w-7 h-1 rounded-full bg-makina-green/20" />
              </div>
            </div>
            <div className="iso-card iso-card-3">
              <div className="iso-card-inner">
                <div className="w-7 h-1 rounded-full bg-amber-400/60 mb-1.5" />
                <div className="w-8 h-1 rounded-full bg-amber-400/30 mb-1" />
                <div className="w-5 h-1 rounded-full bg-amber-400/20" />
              </div>
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

        {/* Logo */}
        <div className="relative animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={theme === "light" ? "/makina_pulse_logo_trimmed_dark.png" : "/makina_pulse_logo_trimmed.png"}
            alt="Makina Pulse"
            className="h-12 w-auto"
          />
        </div>

        {/* Headline */}
        <div className="relative text-center mt-8 max-w-2xl animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
            Your feedback{" "}
            <span className="gradient-text">shapes</span>
            <br />
            what we build next
          </h1>
          <p className="text-base sm:text-lg text-makina-muted mt-5 max-w-lg mx-auto leading-relaxed">
            A single place for your team to collect, triage, and act on user feedback. Every voice matters.
          </p>
        </div>

        {/* CTA */}
        <div className="relative flex items-center gap-4 mt-10 animate-fade-in-up" style={{ animationDelay: "350ms" }}>
          <Link
            href="/feedback"
            className="group flex items-center gap-2.5 rounded-xl gradient-accent px-7 py-3.5 text-sm font-bold text-makina-bg shadow-lg shadow-makina-accent/20 hover:shadow-makina-accent/30 hover:brightness-110 transition-all"
          >
            Share Feedback
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/review"
            className="flex items-center gap-2 rounded-xl bg-makina-card border border-makina-border px-7 py-3.5 text-sm font-semibold text-makina-text hover:border-makina-accent/40 hover:bg-makina-card-hover transition-all"
          >
            Review Dashboard
          </Link>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 animate-bounce-slow opacity-40">
          <div className="w-5 h-8 rounded-full border-2 border-makina-muted flex justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-makina-muted animate-scroll-dot" />
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="relative px-4 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16 animate-fade-in-up">
            <p className="text-xs font-semibold uppercase tracking-widest text-makina-accent mb-3">How it works</p>
            <h2 className="text-3xl font-bold">Feedback flows, your product grows</h2>
          </div>

          {/* Isometric flow — 3 step pipeline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <MessageSquare size={22} />,
                title: "Collect",
                desc: "Users submit feedback — issues, suggestions, questions — with screenshots, ratings, and quick actions.",
                color: "text-makina-accent",
                bg: "bg-makina-accent-dim",
                border: "border-makina-accent/20",
                delay: "0ms",
              },
              {
                icon: <BarChart3 size={22} />,
                title: "Triage",
                desc: "Reviewers prioritize, tag, pin, and escalate. Analytics surface trends so nothing slips through the cracks.",
                color: "text-amber-400",
                bg: "bg-amber-400/10",
                border: "border-amber-400/20",
                delay: "100ms",
              },
              {
                icon: <Users size={22} />,
                title: "Act",
                desc: "The team board shows what needs attention. Address, dismiss, or reply — with full attribution of who did what.",
                color: "text-makina-green",
                bg: "bg-green-500/10",
                border: "border-green-500/20",
                delay: "200ms",
              },
            ].map((step) => (
              <div
                key={step.title}
                className={`group relative rounded-2xl bg-makina-card border ${step.border} p-8 hover-lift animate-fade-in-up`}
                style={{ animationDelay: step.delay }}
              >
                {/* Connector line between cards on desktop */}
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-makina-border last:hidden" />

                <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${step.bg} ${step.color} mb-5`}>
                  {step.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-makina-muted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities grid ── */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <Zap size={18} />, title: "Quick actions", desc: "One-tap feedback labels for fast classification" },
              { icon: <Shield size={18} />, title: "Password-gated", desc: "Review and team pages protected behind a shared key" },
              { icon: <Layers size={18} />, title: "Multi-category", desc: "Core, UI/UX, App, Operator CLI — slice feedback by domain" },
              { icon: <BarChart3 size={18} />, title: "Live analytics", desc: "Daily submission trends, category breakdowns, sentiment at a glance" },
              { icon: <Users size={18} />, title: "Team attribution", desc: "Every action stamped with who did it — no accounts needed" },
              { icon: <MessageSquare size={18} />, title: "Threaded replies", desc: "Reply directly to feedback — users see team responses" },
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
          <h2 className="text-2xl font-bold mb-3">Ready to start collecting?</h2>
          <p className="text-sm text-makina-muted mb-8">
            Share the feedback link with your users. It takes seconds.
          </p>
          <Link
            href="/feedback"
            className="group inline-flex items-center gap-2.5 rounded-xl gradient-accent px-8 py-4 text-sm font-bold text-makina-bg shadow-lg shadow-makina-accent/20 hover:shadow-makina-accent/30 hover:brightness-110 transition-all"
          >
            Open Feedback Form
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-20 text-xs text-makina-subtle">
          Makina Pulse &middot; Built to listen
        </div>
      </section>
    </div>
  );
}

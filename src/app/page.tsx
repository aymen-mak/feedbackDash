"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useTheme } from "@/lib/theme";
import { ArrowRight, Radar, BarChart3, TrendingUp, Users, Activity, Coins } from "lucide-react";

export default function LandingPage() {
  const { theme } = useTheme();

  return (
    <>
      <Navbar />
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

            {/* Floating metric cards */}
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
            Every competitor&apos;s growth.{" "}
            <span className="gradient-text">Our own pulse.</span>
            <br />
            One dashboard.
          </h1>
          <p className="text-base sm:text-lg text-makina-muted mt-5 max-w-lg mx-auto leading-relaxed">
            Makina Pulse auto-collects community size, engagement, and on-chain TVL across the protocols we watch — and
            benchmarks our own accounts against the field.
          </p>
        </div>

        {/* CTA */}
        <div className="relative flex flex-wrap items-center justify-center gap-4 mt-10 animate-fade-in-up" style={{ animationDelay: "350ms" }}>
          <Link
            href="/competitors"
            className="group flex items-center gap-2.5 rounded-xl gradient-accent px-7 py-3.5 text-sm font-bold text-makina-bg shadow-lg shadow-makina-accent/20 hover:shadow-makina-accent/30 hover:brightness-110 transition-all"
          >
            Open the dashboard
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/metrics"
            className="flex items-center gap-2 rounded-xl border border-makina-border bg-makina-surface px-6 py-3.5 text-sm font-semibold text-makina-muted hover:border-makina-accent/40 hover:text-makina-text transition-all"
          >
            Our metrics
          </Link>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 animate-bounce-slow opacity-40">
          <div className="w-5 h-8 rounded-full border-2 border-makina-muted flex justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-makina-muted animate-scroll-dot" />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative px-4 py-24 overflow-hidden">
        {/* Isometric background — pulsating grid + glow */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Tilted grid plane */}
          <div className="iso-bg-grid" />
          {/* Pulsating rings behind the cards */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="iso-bg-ring iso-bg-ring-1" />
            <div className="iso-bg-ring iso-bg-ring-2" />
            <div className="iso-bg-ring iso-bg-ring-3" />
          </div>
          {/* Floating accent particles */}
          <div className="iso-bg-particle iso-bg-particle-1" />
          <div className="iso-bg-particle iso-bg-particle-2" />
          <div className="iso-bg-particle iso-bg-particle-3" />
          <div className="iso-bg-particle iso-bg-particle-4" />
        </div>

        <div className="relative mx-auto max-w-5xl">
          <div className="text-center mb-16 animate-fade-in-up">
            <p className="text-xs font-semibold uppercase tracking-widest text-makina-accent mb-3">How it works</p>
            <h2 className="text-3xl font-bold">Track. Compare. Act.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <Radar size={22} />,
                title: "Track",
                desc: "Add the protocols you watch. Pulse auto-collects their X, Discord, Telegram, website and on-chain numbers — no manual tallying.",
                color: "text-makina-accent",
                bg: "bg-makina-accent-dim",
                border: "border-makina-accent/20",
                delay: "0ms",
              },
              {
                icon: <BarChart3 size={22} />,
                title: "Compare",
                desc: "See community reach, growth trends and TVL side by side, and benchmark our own accounts against the field.",
                color: "text-amber-400",
                bg: "bg-amber-400/10",
                border: "border-amber-400/20",
                delay: "100ms",
              },
              {
                icon: <TrendingUp size={22} />,
                title: "Act",
                desc: "Spot who's accelerating, see what's landing in our own posts, and decide where to push next — backed by real numbers.",
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

      {/* ── What's inside ── */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <Users size={18} />, title: "Multi-platform reach", desc: "Followers and members across X, Discord, Telegram, LinkedIn and more — rolled into one number." },
              { icon: <Activity size={18} />, title: "Our own performance", desc: "Per-post impressions, likes and engagement for our accounts — scraped from public data, never guessed." },
              { icon: <TrendingUp size={18} />, title: "Trends over time", desc: "Week-over-week history and sparklines, so you see momentum — not just a snapshot." },
              { icon: <Coins size={18} />, title: "On-chain TVL", desc: "Live TVL from DefiLlama sitting right next to the social signals." },
              { icon: <Radar size={18} />, title: "Auto-collected", desc: "Numbers refresh on a schedule. No spreadsheets, no copy-paste, no manual entry." },
              { icon: <BarChart3 size={18} />, title: "Export anytime", desc: "Pull any account's full history to CSV in a single click." },
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
          <h2 className="text-2xl font-bold mb-3">See the whole field</h2>
          <p className="text-sm text-makina-muted mb-8">
            Competitor intelligence and our own analytics, refreshed automatically — in one pulse.
          </p>
          <Link
            href="/competitors"
            className="group inline-flex items-center gap-2.5 rounded-xl gradient-accent px-8 py-4 text-sm font-bold text-makina-bg shadow-lg shadow-makina-accent/20 hover:shadow-makina-accent/30 hover:brightness-110 transition-all"
          >
            Open the dashboard
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-20 text-xs text-makina-subtle">
          &copy; 2026 Makina Finance. All rights reserved.
        </div>
      </section>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useTheme } from "@/lib/theme";
import { ArrowRight, Radar, Activity } from "lucide-react";

const ENTRIES = [
  {
    href: "/competitors",
    icon: <Radar size={18} />,
    title: "Competitors",
    desc: "Community size and on-chain TVL across every protocol we watch.",
  },
  {
    href: "/metrics",
    icon: <Activity size={18} />,
    title: "Makina metrics",
    desc: "Follower growth, engagement, and per-post performance.",
  },
];

export default function LandingPage() {
  const { theme } = useTheme();

  return (
    <>
      <Navbar />
      <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-1/3 h-[460px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-makina-accent/[0.045] blur-[120px] animate-pulse"
            style={{ animationDuration: "6s" }}
          />
        </div>

        <main className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
          <div className="relative flex items-center justify-center">
            {/* Pulse rings */}
            <span
              aria-hidden
              className="pointer-events-none absolute h-28 w-28 rounded-full bg-makina-accent/10 animate-ping"
              style={{ animationDuration: "3.2s" }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute h-28 w-28 rounded-full bg-makina-accent/10 animate-ping"
              style={{ animationDuration: "3.2s", animationDelay: "1.6s" }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={theme === "light" ? "/makina_pulse_logo_trimmed_dark.png" : "/makina_pulse_logo_trimmed.png"}
              alt="Makina Pulse"
              className="relative h-11 w-auto"
            />
          </div>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-makina-muted">
            Internal dashboard for competitor intelligence and Makina&apos;s social &amp; on-chain performance.
          </p>

          <div className="mt-9 grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
            {ENTRIES.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className="group flex flex-col items-start rounded-xl border border-makina-border bg-makina-card p-5 text-left transition-all hover-lift hover:border-makina-accent/40"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-makina-accent-dim text-makina-accent">
                  {e.icon}
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-makina-text">
                  {e.title}
                  <ArrowRight size={13} className="-translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </span>
                <span className="mt-1 text-xs leading-relaxed text-makina-muted">{e.desc}</span>
              </Link>
            ))}
          </div>

          <p className="mt-12 text-[11px] text-makina-subtle">Makina Finance · internal</p>
        </main>
      </div>
    </>
  );
}

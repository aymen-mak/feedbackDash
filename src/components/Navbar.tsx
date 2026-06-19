"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Link2,
  Menu,
  X,
  Sun,
  Moon,
  Droplets,
  Check,
  User,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useReviewer } from "@/lib/reviewer";
import { useLoadingBar } from "@/components/LoadingBar";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { theme, toggle, textSize, textSizeLabel, maxTextSize, cycleTextSize } = useTheme();
  const { name: reviewerName, openPrompt } = useReviewer();
  const { start: lbStart, done: lbDone } = useLoadingBar();
  const prevPath = useRef(pathname);

  // Trigger loading bar on page navigation
  useEffect(() => {
    if (prevPath.current !== pathname) {
      lbStart();
      // Done after a short delay to simulate page load
      const t = setTimeout(() => lbDone(), 300);
      prevPath.current = pathname;
      return () => clearTimeout(t);
    }
  }, [pathname, lbStart, lbDone]);

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

  const links = [
    { href: "/competitors", label: "Competitors" },
    { href: "/metrics", label: "Metrics" },
  ];

  const themeIcon = {
    dark: <Sun size={16} />,
    light: <Droplets size={16} />,
    glass: <Moon size={16} />,
  };

  const themeLabel = {
    dark: "Switch to light mode",
    light: "Switch to liquid glass mode",
    glass: "Switch to dark mode",
  };

  // Text size indicator dots
  const sizeIndicator = (
    <span className="flex items-center gap-0.5 ml-0.5">
      {Array.from({ length: maxTextSize + 1 }, (_, i) => i).map((i) => (
        <span
          key={i}
          className={`inline-block rounded-full transition-all ${
            i <= textSize
              ? "w-1 h-1 bg-current opacity-100"
              : "w-1 h-1 bg-current opacity-25"
          }`}
        />
      ))}
    </span>
  );

  return (
    <nav className="sticky top-0 z-40 border-b border-makina-border/30 bg-makina-bg/95 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
        {/* Brand */}
        <Link href="/" className="flex items-center shrink-0 mr-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={theme === "light" ? "/makina_pulse_logo_trimmed_dark.png" : "/makina_pulse_logo_trimmed.png"}
            alt="Makina Pulse"
            className="h-8 w-auto"
          />
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  isActive
                    ? "text-makina-accent bg-makina-accent-dim"
                    : "text-makina-muted hover:text-makina-text hover:bg-makina-surface"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right controls */}
        <div className="flex items-center gap-1.5">
          {/* Reviewer identity */}
          <button
            onClick={openPrompt}
            className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all text-makina-muted hover:text-makina-text hover:bg-makina-surface"
            title={reviewerName ? `Reviewing as ${reviewerName}, click to change` : "Set your name"}
          >
            <User size={14} />
            {reviewerName ? (
              <span className="max-w-[100px] truncate">{reviewerName}</span>
            ) : (
              <span className="text-makina-subtle italic">Set name</span>
            )}
          </button>

          <div className="hidden sm:block w-px h-5 bg-makina-border/50" />

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
            {sizeIndicator}
          </button>

          <button
            onClick={toggle}
            className="rounded-lg p-2 text-makina-muted hover:text-makina-text hover:bg-makina-surface transition-all"
            title={themeLabel[theme]}
          >
            {themeIcon[theme]}
          </button>

          <button
            onClick={handleShare}
            className="relative rounded-lg p-2 text-makina-muted hover:text-makina-text hover:bg-makina-surface transition-all"
            title="Copy link"
          >
            {copied ? <Check size={16} className="text-makina-green" /> : <Link2 size={16} />}
          </button>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden rounded-lg p-2 text-makina-muted hover:text-makina-text hover:bg-makina-surface ml-1"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-makina-border/30 bg-makina-surface/80 backdrop-blur-xl px-4 py-3 space-y-1">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "text-makina-accent bg-makina-accent-dim"
                    : "text-makina-muted hover:text-makina-text hover:bg-makina-surface"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}

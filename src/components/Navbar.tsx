"use client";

import { useState } from "react";
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
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import PulseLogo from "./Logo";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { theme, toggle, comfortText, toggleComfort } = useTheme();

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
    { href: "/", label: "Feedback" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/review", label: "Review" },
    { href: "/team", label: "Team" },
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

  return (
    <nav className="border-b border-makina-border/40">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <PulseLogo size={26} />
          <div className="flex items-baseline gap-1">
            <span className="text-[13px] font-bold tracking-[0.15em] uppercase text-makina-text">Makina</span>
            <span className="text-[13px] font-bold tracking-[0.15em] uppercase text-makina-accent">Pulse</span>
          </div>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "text-makina-accent"
                    : "text-makina-muted hover:text-makina-text"
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
        <div className="flex items-center gap-1">
          <button
            onClick={toggleComfort}
            className={`rounded-md px-1.5 py-1 text-xs font-bold transition-colors ${
              comfortText
                ? "text-makina-accent bg-makina-accent-dim"
                : "text-makina-muted hover:text-makina-text"
            }`}
            title={comfortText ? "Switch to compact text" : "Switch to comfortable text"}
          >
            Aa
          </button>

          <button
            onClick={toggle}
            className="rounded-md p-1.5 text-makina-muted hover:text-makina-text transition-colors"
            title={themeLabel[theme]}
          >
            {themeIcon[theme]}
          </button>

          <button
            onClick={handleShare}
            className="relative rounded-md p-1.5 text-makina-muted hover:text-makina-text transition-colors"
            title="Copy feedback link"
          >
            {copied ? <Check size={16} className="text-makina-green" /> : <Link2 size={16} />}
          </button>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden rounded-md p-1.5 text-makina-muted hover:text-makina-text ml-1"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-makina-border/40 bg-makina-surface px-4 py-2">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-md px-3 py-2.5 text-sm font-medium ${
                  isActive
                    ? "text-makina-accent"
                    : "text-makina-muted"
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

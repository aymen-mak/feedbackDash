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

  const logoSrc =
    theme === "light"
      ? "/1120592a-5c90-484b-a3d4-48f1cdb8e9d6.png"
      : "/makina_pulse_dark_transparent.png";

  return (
    <nav className="sticky top-0 z-40 border-b border-makina-border/30 bg-makina-bg/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
        {/* Brand */}
        <Link href="/" className="flex items-center shrink-0 mr-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="Makina Pulse"
            className="h-9 w-auto object-contain"
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
          <button
            onClick={toggleComfort}
            className={`rounded-lg px-2 py-1.5 text-xs font-bold transition-all ${
              comfortText
                ? "text-makina-accent bg-makina-accent-dim"
                : "text-makina-muted hover:text-makina-text hover:bg-makina-surface"
            }`}
            title={comfortText ? "Switch to compact text" : "Switch to comfortable text"}
          >
            Aa
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
            title="Copy feedback link"
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

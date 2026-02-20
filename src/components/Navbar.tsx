"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  LayoutDashboard,
  Link2,
  Menu,
  X,
  Sun,
  Moon,
  Droplets,
  Check,
  ClipboardList,
  Users,
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
    { href: "/", label: "Feedback", icon: MessageSquare },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/review", label: "Review", icon: ClipboardList },
    { href: "/team", label: "Team", icon: Users },
  ];

  const themeIcon = {
    dark: <Sun size={18} />,
    light: <Droplets size={18} />,
    glass: <Moon size={18} />,
  };

  const themeLabel = {
    dark: "Switch to light mode",
    light: "Switch to liquid glass mode",
    glass: "Switch to dark mode",
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-makina-border bg-makina-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 relative">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5">
          <span className="text-lg font-semibold tracking-tight">
            Makina <span className="gradient-text">Pulse</span>
          </span>
        </Link>

        {/* Desktop nav — absolutely centered */}
        <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-makina-accent-dim text-makina-accent"
                    : "text-makina-muted hover:text-makina-text hover:bg-makina-card"
                }`}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleComfort}
            className={`rounded-md px-1.5 py-1 text-xs font-bold transition-colors ${
              comfortText
                ? "text-makina-accent bg-makina-accent-dim"
                : "text-makina-muted hover:text-makina-text hover:bg-makina-card"
            }`}
            title={comfortText ? "Switch to compact text" : "Switch to comfortable text"}
          >
            Aa
          </button>

          <button
            onClick={toggle}
            className="rounded-md p-2 text-makina-muted hover:text-makina-text hover:bg-makina-card transition-colors"
            title={themeLabel[theme]}
          >
            {themeIcon[theme]}
          </button>

          <button
            onClick={handleShare}
            className="relative rounded-md p-2 text-makina-muted hover:text-makina-text hover:bg-makina-card transition-colors"
            title="Copy feedback link"
          >
            {copied ? <Check size={18} className="text-makina-green" /> : <Link2 size={18} />}
          </button>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden rounded-md p-2 text-makina-muted hover:text-makina-text"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-makina-border bg-makina-surface px-4 py-2">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium ${
                  isActive
                    ? "text-makina-accent bg-makina-accent-dim"
                    : "text-makina-muted"
                }`}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}

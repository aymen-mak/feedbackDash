"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  LayoutDashboard,
  Zap,
  Bell,
  Menu,
  X,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: "/", label: "Feedback", icon: MessageSquare },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-makina-border bg-makina-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-lg font-semibold tracking-tight">Feedback Hub</span>
          <span className="text-[10px] text-makina-subtle font-medium leading-none self-end mb-0.5">by makina</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
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
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-makina-card px-3 py-1.5 text-xs font-medium">
            <Zap size={12} className="text-makina-accent" />
            <span className="text-makina-accent">771</span>
            <span className="text-makina-muted">feedback today</span>
          </div>

          <button className="relative rounded-lg p-2 text-makina-muted hover:text-makina-text hover:bg-makina-card transition-colors">
            <Bell size={18} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-makina-accent" />
          </button>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden rounded-lg p-2 text-makina-muted hover:text-makina-text"
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
                className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
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

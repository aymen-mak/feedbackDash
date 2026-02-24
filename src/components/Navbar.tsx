"use client";

import Link from "next/link";
import { useTheme } from "@/lib/theme";

export default function Navbar() {
  const { theme, toggle } = useTheme();

  const logoSrc =
    theme === "light"
      ? "/makina_pulse_light_logo_320x80.png"
      : "/makina_pulse_logo_320x80.png";

  const themeLabel = {
    dark: "Dark",
    light: "Light",
    glass: "Liquid"
  };

  return (
    <nav className="w-full border-b border-makina-border bg-makina-bg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <img
            src={logoSrc}
            alt="Makina Pulse"
            className="h-10 w-auto"
          />
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-makina-accent transition">
            Feedback
          </Link>
          <Link href="/dashboard" className="hover:text-makina-accent transition">
            Dashboard
          </Link>
          <Link href="/review" className="hover:text-makina-accent transition">
            Review
          </Link>
        </div>

        {/* Theme Switch */}
        <button
          onClick={toggle}
          className="text-xs text-makina-muted hover:text-makina-text transition"
        >
          {themeLabel[theme]}
        </button>

      </div>
    </nav>
  );
}

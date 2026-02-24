"use client";

import Link from "next/link";

export default function Navbar({
  theme,
  setTheme,
}: {
  theme: "dark" | "light" | "glass";
  setTheme: (theme: "dark" | "light" | "glass") => void;
}) {

  const logoSrc =
    theme === "light"
      ? "/makina_pulse_light.png"   // your light logo filename
      : "/makina_pulse_dark_transparent.png"; // your dark/liquid logo filename

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
            className="h-16 md:h-20 w-auto"
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
          onClick={() =>
            setTheme(
              theme === "dark"
                ? "light"
                : theme === "light"
                ? "glass"
                : "dark"
            )
          }
          className="text-xs text-makina-muted hover:text-makina-text transition"
        >
          {themeLabel[theme]}
        </button>

      </div>
    </nav>
  );
}

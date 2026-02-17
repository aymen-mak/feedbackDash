"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "glass";

const THEME_ORDER: Theme[] = ["dark", "light", "glass"];

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("fh-theme") as Theme | null;
    if (stored && THEME_ORDER.includes(stored)) {
      setTheme(stored);
      document.documentElement.classList.remove("light", "glass");
      if (stored !== "dark") {
        document.documentElement.classList.add(stored);
      }
    }
  }, []);

  const toggle = () => {
    const idx = THEME_ORDER.indexOf(theme);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    setTheme(next);
    localStorage.setItem("fh-theme", next);
    document.documentElement.classList.remove("light", "glass");
    if (next !== "dark") {
      document.documentElement.classList.add(next);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "glass";

const THEME_ORDER: Theme[] = ["dark", "light", "glass"];

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  comfortText: boolean;
  toggleComfort: () => void;
}>({ theme: "dark", toggle: () => {}, comfortText: false, toggleComfort: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [comfortText, setComfortText] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("fh-theme") as Theme | null;
    if (stored && THEME_ORDER.includes(stored)) {
      setTheme(stored);
      document.documentElement.classList.remove("light", "glass");
      if (stored !== "dark") {
        document.documentElement.classList.add(stored);
      }
    }
    const comfort = localStorage.getItem("fh-comfort-text");
    if (comfort === "true") {
      setComfortText(true);
      document.documentElement.classList.add("comfort-text");
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

  const toggleComfort = () => {
    const next = !comfortText;
    setComfortText(next);
    localStorage.setItem("fh-comfort-text", String(next));
    if (next) {
      document.documentElement.classList.add("comfort-text");
    } else {
      document.documentElement.classList.remove("comfort-text");
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, comfortText, toggleComfort }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

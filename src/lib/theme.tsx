"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "glass";
type TextSize = 0 | 1 | 2;

const THEME_ORDER: Theme[] = ["dark", "light", "glass"];
const TEXT_SIZE_CLASSES = ["", "text-size-1", "text-size-2"] as const;
const TEXT_SIZE_LABELS = ["Compact", "Normal", "Comfort"] as const;

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  textSize: TextSize;
  textSizeLabel: string;
  cycleTextSize: () => void;
}>({ theme: "dark", toggle: () => {}, textSize: 0, textSizeLabel: "Compact", cycleTextSize: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [textSize, setTextSize] = useState<TextSize>(0);

  useEffect(() => {
    const stored = localStorage.getItem("fh-theme") as Theme | null;
    if (stored && THEME_ORDER.includes(stored)) {
      setTheme(stored);
      document.documentElement.classList.remove("light", "glass");
      if (stored !== "dark") {
        document.documentElement.classList.add(stored);
      }
    }
    const storedSize = localStorage.getItem("fh-text-size");
    if (storedSize) {
      const parsed = Number(storedSize) as TextSize;
      if (parsed >= 0 && parsed <= 2) {
        setTextSize(parsed);
        document.documentElement.classList.remove("text-size-1", "text-size-2", "comfort-text");
        if (TEXT_SIZE_CLASSES[parsed]) {
          document.documentElement.classList.add(TEXT_SIZE_CLASSES[parsed]);
        }
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

  const cycleTextSize = () => {
    const next = ((textSize + 1) % 3) as TextSize;
    setTextSize(next);
    localStorage.setItem("fh-text-size", String(next));
    document.documentElement.classList.remove("text-size-1", "text-size-2", "comfort-text");
    if (TEXT_SIZE_CLASSES[next]) {
      document.documentElement.classList.add(TEXT_SIZE_CLASSES[next]);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, textSize, textSizeLabel: TEXT_SIZE_LABELS[textSize], cycleTextSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "glass";
type TextSize = 0 | 1 | 2 | 3 | 4;

const THEME_ORDER: Theme[] = ["dark", "light", "glass"];
const TEXT_SIZE_CLASSES = ["", "text-size-1", "text-size-2", "text-size-3", "text-size-4"] as const;
const TEXT_SIZE_LABELS = ["Compact", "Normal", "Large", "Larger", "Max"] as const;
const ALL_TEXT_SIZE_CLASSES = ["text-size-1", "text-size-2", "text-size-3", "text-size-4", "comfort-text"];
const DEFAULT_TEXT_SIZE: TextSize = 1; // readable baseline, not Compact
const MAX_TEXT_SIZE = TEXT_SIZE_CLASSES.length - 1; // 4

function applyTextSize(size: TextSize) {
  const el = document.documentElement;
  el.classList.remove(...ALL_TEXT_SIZE_CLASSES);
  if (TEXT_SIZE_CLASSES[size]) el.classList.add(TEXT_SIZE_CLASSES[size]);
}

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  textSize: TextSize;
  textSizeLabel: string;
  maxTextSize: number;
  cycleTextSize: () => void;
}>({
  theme: "dark",
  toggle: () => {},
  textSize: DEFAULT_TEXT_SIZE,
  textSizeLabel: TEXT_SIZE_LABELS[DEFAULT_TEXT_SIZE],
  maxTextSize: MAX_TEXT_SIZE,
  cycleTextSize: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [textSize, setTextSize] = useState<TextSize>(DEFAULT_TEXT_SIZE);

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
    const size = (
      storedSize !== null ? Math.min(MAX_TEXT_SIZE, Math.max(0, Number(storedSize) || 0)) : DEFAULT_TEXT_SIZE
    ) as TextSize;
    setTextSize(size);
    applyTextSize(size);
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
    const next = (((textSize + 1) % (MAX_TEXT_SIZE + 1))) as TextSize;
    setTextSize(next);
    localStorage.setItem("fh-text-size", String(next));
    applyTextSize(next);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggle,
        textSize,
        textSizeLabel: TEXT_SIZE_LABELS[textSize],
        maxTextSize: MAX_TEXT_SIZE,
        cycleTextSize,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

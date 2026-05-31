"use client";

import { useState, useEffect } from "react";

export interface ChartColors {
  grid: string;
  tick: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  cursor: string;
  dotStroke: string;
}

const FALLBACK: ChartColors = {
  grid: "#1c2b42",
  tick: "#64748b",
  tooltipBg: "#131c2e",
  tooltipBorder: "#1c2b42",
  tooltipText: "#edf2f7",
  cursor: "#2d3d56",
  dotStroke: "#131c2e",
};

/** Reads the theme's chart CSS variables and tracks theme switches. */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(FALLBACK);
  useEffect(() => {
    const update = () => {
      const s = getComputedStyle(document.documentElement);
      const v = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb;
      setColors({
        grid: v("--chart-grid", FALLBACK.grid),
        tick: v("--chart-tick", FALLBACK.tick),
        tooltipBg: v("--chart-tooltip-bg", FALLBACK.tooltipBg),
        tooltipBorder: v("--chart-tooltip-border", FALLBACK.tooltipBorder),
        tooltipText: v("--chart-tooltip-text", FALLBACK.tooltipText),
        cursor: v("--chart-cursor", FALLBACK.cursor),
        dotStroke: v("--chart-dot-stroke", FALLBACK.dotStroke),
      });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return colors;
}

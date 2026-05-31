"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import {
  type Competitor,
  type Platform,
  type MetricSource,
  PLATFORMS,
  PLATFORM_LABELS,
  PLATFORM_METRIC_UNIT,
} from "@/lib/competitors/types";
import { PLATFORM_META, formatCount } from "./platformMeta";

interface Datum {
  name: string;
  value: number;
  isSelf: boolean;
  source: MetricSource;
}

function useChartColors() {
  const [colors, setColors] = useState({ tick: "#64748b", tooltipBg: "#131c2e", tooltipBorder: "#1c2b42", tooltipText: "#edf2f7", cursor: "#2d3d56" });
  useEffect(() => {
    const update = () => {
      const s = getComputedStyle(document.documentElement);
      setColors({
        tick: s.getPropertyValue("--chart-tick").trim() || "#64748b",
        tooltipBg: s.getPropertyValue("--chart-tooltip-bg").trim() || "#131c2e",
        tooltipBorder: s.getPropertyValue("--chart-tooltip-border").trim() || "#1c2b42",
        tooltipText: s.getPropertyValue("--chart-tooltip-text").trim() || "#edf2f7",
        cursor: s.getPropertyValue("--chart-cursor").trim() || "#2d3d56",
      });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return colors;
}

interface Props {
  competitors: Competitor[];
}

export default function CompetitorComparisonChart({ competitors }: Props) {
  const c = useChartColors();

  // Platforms that have at least one numeric value to compare.
  const available = useMemo(
    () =>
      PLATFORMS.filter((p) =>
        competitors.some((comp) => comp.platforms.some((m) => m.platform === p && m.value != null))
      ),
    [competitors]
  );

  const [platform, setPlatform] = useState<Platform>("twitter");
  const activePlatform = available.includes(platform) ? platform : available[0] ?? "twitter";

  const data = useMemo<Datum[]>(() => {
    return competitors
      .map((comp): Datum | null => {
        const m = comp.platforms.find((x) => x.platform === activePlatform);
        return m && m.value != null
          ? { name: comp.name, value: m.value, isSelf: comp.isSelf, source: m.source }
          : null;
      })
      .filter((d): d is Datum => d !== null)
      .sort((a, b) => b.value - a.value);
  }, [competitors, activePlatform]);

  const accent = PLATFORM_META[activePlatform].color;

  return (
    <div className="rounded-xl border border-makina-border bg-makina-card p-5 animate-fade-in-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-makina-muted">
            Reach comparison
          </p>
          <h2 className="text-sm font-bold text-makina-text">
            {PLATFORM_LABELS[activePlatform]} {PLATFORM_METRIC_UNIT[activePlatform]}
          </h2>
        </div>
        <div className="flex flex-wrap gap-1">
          {available.map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                activePlatform === p
                  ? "bg-makina-surface text-makina-text border border-makina-border"
                  : "text-makina-subtle hover:text-makina-muted"
              }`}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: PLATFORM_META[p].color }} />
              {PLATFORM_META[p].short}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-makina-muted">
          No numeric values yet for this platform.
        </div>
      ) : (
        <div style={{ height: Math.max(160, data.length * 38 + 24) }} className="mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 8, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fontSize: 11, fill: c.tick }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: c.cursor, opacity: 0.15 }}
                contentStyle={{
                  backgroundColor: c.tooltipBg,
                  border: `1px solid ${c.tooltipBorder}`,
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: c.tooltipText,
                }}
                formatter={(v: number | string | undefined) => [
                  Number(v ?? 0).toLocaleString(),
                  PLATFORM_METRIC_UNIT[activePlatform],
                ]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26}>
                {data.map((d, i) => (
                  <Cell key={i} fill={accent} opacity={d.isSelf ? 1 : 0.72} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(v) => formatCount(typeof v === "number" ? v : null)}
                  style={{ fontSize: 11, fill: c.tick, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-[10px] text-makina-subtle">
        Bars show the latest tracked value. X/LinkedIn are manual; Discord/Telegram/GitHub auto-refresh where enabled.
      </p>
    </div>
  );
}

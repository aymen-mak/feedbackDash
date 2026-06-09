import { type PlatformMetric, PLATFORM_LABELS } from "@/lib/competitors/types";
import { PLATFORM_META, PLATFORM_SOURCE, formatCount } from "./platformMeta";

interface Props {
  metric: PlatformMetric;
  /** Change vs. the previous snapshot, if known. */
  trend?: number | null;
}

// Distinct visual states so a "no presence" never looks like "awaiting data".
function emptyState(m: PlatformMetric): { text: string; cls: string; pulse?: boolean } {
  if (m.lastError) return { text: "error", cls: "border-makina-red/40 text-makina-red bg-makina-red/5" };
  switch (m.presence) {
    case "none":
      return { text: "—", cls: "border-dashed border-makina-border/50 text-makina-subtle bg-transparent" };
    case "inactive":
      return { text: "dormant", cls: "border-amber-500/30 text-amber-500 bg-amber-500/5" };
    case "external":
      return { text: "external", cls: "border-violet-500/30 text-violet-400 bg-violet-500/5" };
    case "private":
      return { text: "private", cls: "border-makina-border/60 text-makina-subtle bg-makina-surface/60" };
    default:
      // active / unknown with no number
      if (m.autoKey)
        return { text: "syncing", cls: "border-dotted border-makina-accent/40 text-makina-accent/80 bg-makina-accent-dim", pulse: true };
      return { text: "N/A", cls: "border-makina-border text-makina-muted bg-makina-surface" };
  }
}

export default function PlatformBadge({ metric, trend }: Props) {
  const meta = PLATFORM_META[metric.platform];
  const hasValue = metric.value != null;
  const state = hasValue ? null : emptyState(metric);

  const titleParts: string[] = [PLATFORM_LABELS[metric.platform]];
  if (metric.handle) titleParts.push(metric.handle);
  if (hasValue) titleParts.push(`${metric.value!.toLocaleString()} · ${metric.source}`);
  if (hasValue && metric.source === "auto") titleParts.push(`via ${PLATFORM_SOURCE[metric.platform].detail}`);
  else if (state) titleParts.push(state.text === "—" ? "no presence" : state.text);
  if (metric.reachExcluded) titleParts.push("excluded from Community reach");
  if (metric.note) titleParts.push(metric.note);
  if (metric.lastError) titleParts.push(`⚠ ${metric.lastError}`);

  return (
    <span
      title={titleParts.join(" — ")}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${
        hasValue ? "border-makina-border bg-makina-surface" : state!.cls
      }`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: meta.color, opacity: hasValue ? 1 : 0.55 }}
      />
      <span className="font-medium text-makina-text/70">{meta.short}</span>

      {hasValue ? (
        <>
          <span
            className={`font-semibold ${
              metric.reachExcluded
                ? "text-makina-muted line-through decoration-makina-subtle/50"
                : "text-makina-text"
            }`}
          >
            {formatCount(metric.value)}
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${metric.source === "auto" ? "bg-makina-green" : "bg-makina-muted"}`}
            title={metric.source === "auto" ? "Auto-collected" : "Manual entry"}
          />
          {typeof trend === "number" && trend !== 0 && (
            <span className={`text-[10px] font-medium ${trend > 0 ? "text-makina-green" : "text-makina-red"}`}>
              {trend > 0 ? "▲" : "▼"}
              {formatCount(Math.abs(trend))}
            </span>
          )}
          {metric.tag && (
            <span
              className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium text-amber-500"
              title={metric.reachExcluded ? "Excluded from Community reach" : undefined}
            >
              {metric.tag}
            </span>
          )}
          {!metric.tag && metric.reachExcluded && (
            <span className="text-[9px] text-makina-subtle" title="Excluded from Community reach">
              ⊘ reach
            </span>
          )}
        </>
      ) : (
        <span className="inline-flex items-center gap-1 font-medium">
          {state!.text}
          {state!.pulse && <span className="h-1 w-1 rounded-full bg-makina-accent animate-pulse-live" />}
        </span>
      )}
    </span>
  );
}

import { type PlatformMetric, PLATFORM_LABELS } from "@/lib/competitors/types";
import { PLATFORM_META, formatCount, presenceShort, isAbsent } from "./platformMeta";

interface Props {
  metric: PlatformMetric;
  /** Change vs. the previous snapshot, if known. */
  trend?: number | null;
}

export default function PlatformBadge({ metric, trend }: Props) {
  const meta = PLATFORM_META[metric.platform];
  const hasValue = metric.value != null;
  const absent = !hasValue && isAbsent(metric.presence);
  const display = hasValue ? formatCount(metric.value) : presenceShort(metric.presence);

  const titleParts: string[] = [PLATFORM_LABELS[metric.platform]];
  if (metric.handle) titleParts.push(metric.handle);
  if (hasValue) titleParts.push(`${metric.value!.toLocaleString()} · ${metric.source}`);
  if (metric.note) titleParts.push(metric.note);
  if (metric.lastError) titleParts.push(`⚠ ${metric.lastError}`);

  return (
    <span
      title={titleParts.join(" — ")}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors ${
        absent
          ? "border-makina-border/60 bg-transparent opacity-55"
          : "border-makina-border bg-makina-surface"
      }`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
      <span className="font-medium text-makina-text/70">{meta.short}</span>
      <span className={`font-semibold ${hasValue ? "text-makina-text" : "text-makina-muted"}`}>
        {display}
      </span>
      {hasValue && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            metric.source === "auto" ? "bg-makina-green" : "bg-makina-muted"
          }`}
          title={metric.source === "auto" ? "Auto-collected" : "Manual entry"}
        />
      )}
      {hasValue && typeof trend === "number" && trend !== 0 && (
        <span
          className={`text-[10px] font-medium ${trend > 0 ? "text-makina-green" : "text-makina-red"}`}
        >
          {trend > 0 ? "▲" : "▼"}
          {formatCount(Math.abs(trend))}
        </span>
      )}
      {!hasValue && metric.lastError && <span className="text-[10px] text-makina-red">⚠</span>}
    </span>
  );
}

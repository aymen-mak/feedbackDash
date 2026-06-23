import { Skeleton } from "@/components/Skeleton";

// Mirrors the metrics layout (the latest-summary line, the KPI card grid, and
// the chart + latest-posts row) so the page holds its shape while loading.
export default function MetricsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-72" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-makina-border bg-makina-card p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-6 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Trend + latest posts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-makina-border bg-makina-card p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-48 w-full" />
        </div>
        <div className="rounded-xl border border-makina-border bg-makina-card p-4">
          <Skeleton className="h-4 w-40" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

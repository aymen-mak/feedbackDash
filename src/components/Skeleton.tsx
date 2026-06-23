// A single placeholder block. Compose these into layout-shaped skeletons.
// The shimmer is defined in globals.css (.skeleton) — a subtle sweep, no pulse.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} aria-hidden />;
}

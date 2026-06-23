// Shared loading visuals. Spinner inherits the current text color (so it adapts
// to the button/section it sits in); PageLoader is the centered full-section
// state used while a page's data is being fetched.

export function Spinner({
  size = 16,
  strokeWidth = 2.5,
  className = "",
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      className={`animate-spin ${className}`}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth={strokeWidth} />
      <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Spinner size={26} className="text-makina-accent" />
      <span className="text-sm text-makina-muted animate-pulse">{label}</span>
    </div>
  );
}

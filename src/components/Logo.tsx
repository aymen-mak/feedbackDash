"use client";

interface LogoProps {
  size?: number;
  className?: string;
  variant?: "color" | "mono";
}

export default function PulseLogo({ size = 32, className = "", variant = "color" }: LogoProps) {
  const id = `knot-grad-${size}`;
  const m1 = `knot-m1-${size}`;
  const m2 = `knot-m2-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
    >
      <defs>
        {variant === "color" && (
          <linearGradient id={id} x1="8" y1="20" x2="32" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5b9cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        )}
        <mask id={m1}>
          <rect width="40" height="40" fill="white" />
          <circle cx="14.4" cy="25.6" r="3.5" fill="black" />
        </mask>
        <mask id={m2}>
          <rect width="40" height="40" fill="white" />
          <circle cx="25.6" cy="14.4" r="3.5" fill="black" />
        </mask>
      </defs>

      {/* Interlocking rings, geometric knot */}
      <circle
        cx="17" cy="17" r="9"
        stroke={variant === "color" ? `url(#${id})` : "currentColor"}
        strokeWidth="2.5"
        fill="none"
        mask={`url(#${m1})`}
      />
      <circle
        cx="23" cy="23" r="9"
        stroke={variant === "color" ? `url(#${id})` : "currentColor"}
        strokeWidth="2.5"
        fill="none"
        mask={`url(#${m2})`}
      />
    </svg>
  );
}

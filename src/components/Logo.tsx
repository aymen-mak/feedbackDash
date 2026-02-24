"use client";

interface LogoProps {
  size?: number;
  className?: string;
  variant?: "color" | "mono";
}

export default function PulseLogo({ size = 32, className = "", variant = "color" }: LogoProps) {
  const id = `pulse-grad-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
    >
      {/* Two offset circles — interconnection / knot feel */}
      <circle cx="16" cy="17" r="11" stroke={variant === "color" ? `url(#${id})` : "currentColor"} strokeWidth="1.5" opacity="0.18" />
      <circle cx="24" cy="23" r="11" stroke={variant === "color" ? `url(#${id})` : "currentColor"} strokeWidth="1.5" opacity="0.18" />

      {/* Pulse heartbeat — the hero line */}
      <path
        d="M3 20H12L14.5 11L17.5 29L20 13L22.5 27L25 20H37"
        stroke={variant === "color" ? `url(#${id})` : "currentColor"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {variant === "color" && (
        <defs>
          <linearGradient id={id} x1="3" y1="20" x2="37" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
}

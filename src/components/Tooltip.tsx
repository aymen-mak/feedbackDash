import { type ReactNode } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  return (
    <div className="relative group/tip inline-flex">
      {children}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-lg bg-makina-card border border-makina-border text-[11px] text-makina-text whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-150 shadow-lg z-50">
        {content}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-makina-border" />
      </div>
    </div>
  );
}

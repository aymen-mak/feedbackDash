import { type ReactNode } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom";
}

export default function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const isTop = position === "top";
  return (
    <div className="relative group/tip inline-flex">
      {children}
      <div className={`absolute ${isTop ? "bottom-full mb-2" : "top-full mt-2"} left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-makina-card border border-makina-border text-[11px] text-makina-text opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-150 shadow-lg z-50 min-w-max max-w-[200px] text-center leading-tight`}>
        {content}
        <div className={`absolute ${isTop ? "top-full border-t-makina-border" : "bottom-full border-b-makina-border"} left-1/2 -translate-x-1/2 border-4 border-transparent`} />
      </div>
    </div>
  );
}

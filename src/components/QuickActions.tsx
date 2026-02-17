"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { QUICK_ACTIONS } from "@/lib/mock-data";

interface QuickActionsProps {
  onSubmit: (actionId: string) => void;
}

export default function QuickActions({ onSubmit }: QuickActionsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (actionId: string) => {
    if (submitted) return;
    setSelected(actionId === selected ? null : actionId);
  };

  const handleSubmit = () => {
    if (!selected) return;
    onSubmit(selected);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setSelected(null);
    }, 2000);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {QUICK_ACTIONS.map((action, index) => (
          <button
            key={action.id}
            onClick={() => handleSelect(action.id)}
            disabled={submitted}
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all animate-fade-in-up hover-lift ${
              selected === action.id
                ? "gradient-accent text-makina-bg scale-[1.02]"
                : submitted
                ? "bg-makina-card/50 text-makina-subtle cursor-not-allowed"
                : "bg-makina-card text-makina-text border border-makina-border hover:border-makina-accent/40 hover:bg-makina-card-hover"
            }`}
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <span className="text-base">{action.emoji}</span>
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </div>
      {selected && !submitted && (
        <button
          onClick={handleSubmit}
          className="w-full rounded-xl gradient-accent py-3 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 glow-accent animate-fade-in-up"
        >
          Send Feedback
        </button>
      )}
      {submitted && (
        <div className="flex items-center justify-center gap-2 text-sm text-makina-green font-medium py-3 animate-success">
          <Check size={16} />
          Feedback sent! Thanks for sharing.
        </div>
      )}
    </div>
  );
}

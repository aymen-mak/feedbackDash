"use client";

import { CATEGORY_STATS, type CategoryId } from "@/lib/mock-data";

interface CategorySelectorProps {
  selected: CategoryId | "all";
  onSelect: (category: CategoryId | "all") => void;
}

export default function CategorySelector({ selected, onSelect }: CategorySelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onSelect("all")}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
          selected === "all"
            ? "bg-makina-accent text-makina-bg"
            : "bg-makina-card text-makina-muted border border-makina-border hover:border-makina-subtle hover:text-makina-text"
        }`}
      >
        All
      </button>
      {CATEGORY_STATS.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            selected === cat.id
              ? "bg-makina-accent text-makina-bg"
              : "bg-makina-card text-makina-muted border border-makina-border hover:border-makina-subtle hover:text-makina-text"
          }`}
        >
          <span>{cat.id}</span>
          <span className={`text-xs ${
            selected === cat.id ? "text-makina-bg/70" : "text-makina-subtle"
          }`}>
            {cat.submissions}
          </span>
        </button>
      ))}
    </div>
  );
}

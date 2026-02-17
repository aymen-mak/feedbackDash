"use client";

import { useState } from "react";
import { Send, Check, EyeOff } from "lucide-react";
import type { CategoryId } from "@/lib/mock-data";

const categoryPrompts: Record<CategoryId, string> = {
  Product: "What would you improve about the product?",
  UX: "What felt confusing or could work better?",
  Support: "What can we help you with?",
};

interface FeedbackComposerProps {
  category: CategoryId | "all";
  onSubmit: (message: string, category: CategoryId) => void;
}

export default function FeedbackComposer({ category, onSubmit }: FeedbackComposerProps) {
  const [message, setMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>(category === "all" ? "Product" : category);
  const [anonymous, setAnonymous] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const activeCategory = category === "all" ? selectedCategory : category;
  const placeholder = categoryPrompts[activeCategory];

  const handleSubmit = () => {
    if (!message.trim()) return;
    onSubmit(message, activeCategory);
    setMessage("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
  };

  return (
    <div className="rounded-md bg-makina-card border border-makina-border p-4 hover-lift animate-fade-in-up">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-makina-muted">Share detailed feedback</span>
        <div className="ml-auto flex items-center gap-3">
          {/* Anonymous toggle */}
          <button
            type="button"
            onClick={() => setAnonymous(!anonymous)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              anonymous
                ? "bg-makina-accent-dim text-makina-accent border border-makina-accent/30"
                : "bg-makina-surface text-makina-muted border border-makina-border hover:border-makina-subtle"
            }`}
          >
            <EyeOff size={11} />
            Anonymous
          </button>
          {category === "all" && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as CategoryId)}
              className="rounded-full bg-makina-surface border border-makina-border px-3 py-1 text-xs text-makina-text focus:outline-none focus:border-makina-accent cursor-pointer"
            >
              <option value="Product">Product</option>
              <option value="UX">UX</option>
              <option value="Support">Support</option>
            </select>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          className="flex-1 resize-none rounded-md bg-makina-surface border border-makina-border px-4 py-3 text-sm text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50 transition-colors"
          rows={2}
        />
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || submitted}
          className="self-end rounded-md gradient-accent p-3 text-makina-bg transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitted ? <Check size={16} /> : <Send size={16} />}
        </button>
      </div>
      {submitted && (
        <div className="mt-2 flex items-center gap-1.5 animate-success">
          <Check size={12} className="text-makina-green" />
          <p className="text-xs text-makina-green font-medium">Feedback submitted! Thank you.</p>
        </div>
      )}
    </div>
  );
}

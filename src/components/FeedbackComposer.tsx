"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import type { CategoryId } from "@/lib/mock-data";

interface FeedbackComposerProps {
  category: CategoryId | "all";
  onSubmit: (message: string, category: CategoryId) => void;
}

export default function FeedbackComposer({ category, onSubmit }: FeedbackComposerProps) {
  const [message, setMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>(category === "all" ? "Product" : category);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) return;
    onSubmit(message, selectedCategory);
    setMessage("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  return (
    <div className="rounded-2xl bg-makina-card border border-makina-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-makina-muted">Share detailed feedback</span>
        {category === "all" && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as CategoryId)}
            className="ml-auto rounded-full bg-makina-surface border border-makina-border px-3 py-1 text-xs text-makina-text focus:outline-none focus:border-makina-accent cursor-pointer"
          >
            <option value="Product">Product</option>
            <option value="UX">UX</option>
            <option value="Support">Support</option>
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's on your mind? Report a bug, suggest a feature, or share praise..."
          className="flex-1 resize-none rounded-xl bg-makina-surface border border-makina-border px-4 py-3 text-sm text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50 transition-colors"
          rows={2}
        />
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || submitted}
          className="self-end rounded-xl bg-makina-accent p-3 text-makina-bg transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={16} />
        </button>
      </div>
      {submitted && (
        <p className="mt-2 text-xs text-makina-green font-medium">Feedback submitted! Thank you.</p>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useReviewer } from "@/lib/reviewer";
import { User } from "lucide-react";

/**
 * Shows a modal asking for the reviewer's name when they first visit
 * /review or /team without a name set. Also used when editing the name.
 */
export default function ReviewerNamePrompt() {
  const { name, setName, promptOpen, closePrompt } = useReviewer();
  const [input, setInput] = useState(name);
  const [show, setShow] = useState(false);

  // Sync input when name changes externally (e.g. context update)
  useEffect(() => { setInput(name); }, [name]);

  // Show if explicitly opened or if no name is set
  useEffect(() => {
    if (promptOpen) {
      setShow(true);
    } else if (!name) {
      // Small delay so it doesn't flash on first render
      const t = setTimeout(() => setShow(true), 400);
      return () => clearTimeout(t);
    } else {
      setShow(false);
    }
  }, [name, promptOpen]);

  if (!show) return null;

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (trimmed) {
      setName(trimmed);
      setShow(false);
      closePrompt();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-makina-card border border-makina-border rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-makina-accent-dim text-makina-accent">
            <User size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-makina-text">
              {name ? "Change your name" : "What\u2019s your name?"}
            </h2>
            <p className="text-xs text-makina-muted">
              Used to track who reviewed and actioned feedback.
            </p>
          </div>
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="e.g. Sarah, Alex, Jordan..."
          className="w-full rounded-lg bg-makina-surface border border-makina-border px-4 py-2.5 text-sm text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50 transition-colors"
          autoFocus
        />

        <div className="flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="flex-1 rounded-lg gradient-accent px-4 py-2 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {name ? "Update" : "Continue"}
          </button>
          {name && (
            <button
              onClick={() => { setShow(false); closePrompt(); }}
              className="rounded-lg bg-makina-surface border border-makina-border px-4 py-2 text-sm font-medium text-makina-muted hover:text-makina-text transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

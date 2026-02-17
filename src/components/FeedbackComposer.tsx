"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import type { VaultId } from "@/lib/mock-data";

interface FeedbackComposerProps {
  vault: VaultId | "all";
  onSubmit: (message: string, vault: VaultId) => void;
}

export default function FeedbackComposer({ vault, onSubmit }: FeedbackComposerProps) {
  const [message, setMessage] = useState("");
  const [selectedVault, setSelectedVault] = useState<VaultId>(vault === "all" ? "DUSD" : vault);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) return;
    onSubmit(message, selectedVault);
    setMessage("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  return (
    <div className="rounded-2xl bg-makina-card border border-makina-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-makina-muted">Share detailed feedback</span>
        {vault === "all" && (
          <select
            value={selectedVault}
            onChange={(e) => setSelectedVault(e.target.value as VaultId)}
            className="ml-auto rounded-full bg-makina-surface border border-makina-border px-3 py-1 text-xs text-makina-text focus:outline-none focus:border-makina-accent cursor-pointer"
          >
            <option value="DBIT">DBIT</option>
            <option value="DETH">DETH</option>
            <option value="DUSD">DUSD</option>
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's on your mind about the vaults?"
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
        <p className="mt-2 text-xs text-makina-green font-medium">Feedback submitted!</p>
      )}
      <p className="mt-2 text-[11px] text-makina-subtle">
        Custom messages unlock at 500 ethos · your ethos: 67
      </p>
    </div>
  );
}

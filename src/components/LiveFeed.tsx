"use client";

import { Radio } from "lucide-react";
import FeedbackCard from "./FeedbackCard";
import { type FeedbackItem, type VaultId } from "@/lib/mock-data";

interface LiveFeedProps {
  feedback: FeedbackItem[];
  vault: VaultId | "all";
  showStatus?: boolean;
  onStatusChange?: (id: string, status: FeedbackItem["status"]) => void;
}

export default function LiveFeed({ feedback, vault, showStatus, onStatusChange }: LiveFeedProps) {
  const filtered = vault === "all" ? feedback : feedback.filter((f) => f.vault === vault);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Radio size={14} className="text-makina-green animate-pulse-live" />
        <span className="text-sm font-medium text-makina-green">
          {filtered.length} live
        </span>
        <span className="text-sm text-makina-muted">Community Feedback</span>
      </div>
      <div className="space-y-2">
        {filtered.map((item) => (
          <FeedbackCard
            key={item.id}
            item={item}
            showStatus={showStatus}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
    </div>
  );
}

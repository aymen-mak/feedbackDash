"use client";

import { Radio } from "lucide-react";
import FeedbackCard, { type FeedbackItemData } from "./FeedbackCard";

interface LiveFeedProps {
  feedback: FeedbackItemData[];
  category: string;
  showStatus?: boolean;
  onStatusChange?: (id: string, status: string) => void;
  onItemUpdate?: (item: FeedbackItemData) => void;
  columns?: 1 | 2;
}

export default function LiveFeed({ feedback, category, showStatus, onStatusChange, onItemUpdate, columns = 1 }: LiveFeedProps) {
  const filtered = category === "all" ? feedback : feedback.filter((f) => f.category === category);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Radio size={14} className="text-makina-green animate-pulse-live" />
        <span className="text-sm font-medium text-makina-green">
          {filtered.length} live
        </span>
        <span className="text-sm text-makina-muted">Community Feedback</span>
      </div>
      <div className={columns === 2 ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-2"}>
        {filtered.map((item, index) => (
          <div
            key={item.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <FeedbackCard
              item={item}
              showStatus={showStatus}
              onStatusChange={onStatusChange as (id: string, status: "new" | "reviewed" | "addressed" | "dismissed") => void}
              onItemUpdate={onItemUpdate}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

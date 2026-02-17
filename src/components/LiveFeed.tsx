"use client";

import { Radio } from "lucide-react";
import FeedbackCard from "./FeedbackCard";
import { type FeedbackItem, type CategoryId } from "@/lib/mock-data";

interface LiveFeedProps {
  feedback: FeedbackItem[];
  category: CategoryId | "all";
  showStatus?: boolean;
  onStatusChange?: (id: string, status: FeedbackItem["status"]) => void;
  onReply?: (id: string, message: string) => void;
  columns?: 1 | 2;
}

export default function LiveFeed({ feedback, category, showStatus, onStatusChange, onReply, columns = 1 }: LiveFeedProps) {
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
              onStatusChange={onStatusChange}
              onReply={onReply}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

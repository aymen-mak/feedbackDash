"use client";

import FeedbackCard, { type FeedbackItemData } from "./FeedbackCard";

interface LiveFeedProps {
  feedback: FeedbackItemData[];
  category: string;
  showStatus?: boolean;
  hideReplyInput?: boolean;
  onStatusChange?: (id: string, status: string) => void;
  onItemUpdate?: (item: FeedbackItemData) => void;
  columns?: 1 | 2;
}

export default function LiveFeed({ feedback, category, showStatus, hideReplyInput, onStatusChange, onItemUpdate, columns = 1 }: LiveFeedProps) {
  const filtered = category === "all" ? feedback : feedback.filter((f) => f.category === category);

  return (
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
            hideReplyInput={hideReplyInput}
            onStatusChange={onStatusChange as (id: string, status: "new" | "reviewed" | "addressed" | "dismissed") => void}
            onItemUpdate={onItemUpdate}
          />
        </div>
      ))}
    </div>
  );
}

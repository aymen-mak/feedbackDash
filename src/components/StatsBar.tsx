"use client";

import { TrendingUp, Users, MessageSquare, ThumbsUp } from "lucide-react";

interface Stat {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const stats: Stat[] = [
  {
    label: "Total Feedback",
    value: "771",
    change: "+12%",
    positive: true,
    icon: MessageSquare,
  },
  {
    label: "Unique Users",
    value: "284",
    change: "+8%",
    positive: true,
    icon: Users,
  },
  {
    label: "Avg Sentiment",
    value: "0.74",
    change: "+0.05",
    positive: true,
    icon: ThumbsUp,
  },
  {
    label: "Response Rate",
    value: "89%",
    change: "-2%",
    positive: false,
    icon: TrendingUp,
  },
];

export default function StatsBar() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl bg-makina-card border border-makina-border p-4 transition-colors hover:border-makina-subtle"
        >
          <div className="flex items-center justify-between">
            <stat.icon size={16} className="text-makina-muted" />
            <span
              className={`text-xs font-medium ${
                stat.positive ? "text-makina-green" : "text-makina-red"
              }`}
            >
              {stat.change}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold">{stat.value}</p>
          <p className="mt-0.5 text-xs text-makina-muted">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

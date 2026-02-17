"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import CategorySelector from "@/components/VaultSelector";
import QuickActions from "@/components/QuickActions";
import FeedbackComposer from "@/components/FeedbackComposer";
import LiveFeed from "@/components/LiveFeed";
import { MOCK_FEEDBACK, CATEGORY_STATS, type CategoryId } from "@/lib/mock-data";

export default function FeedbackPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | "all">("all");

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Share Your Feedback</h1>
          <p className="text-sm text-makina-muted">
            Help us improve. Report issues, suggest features, or tell us what you love.
          </p>
        </div>

        {/* Category overview cards */}
        <div className="grid grid-cols-3 gap-3">
          {CATEGORY_STATS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-2xl border p-4 text-center transition-all ${
                selectedCategory === cat.id
                  ? "border-makina-accent bg-makina-accent-dim glow-accent"
                  : "border-makina-border bg-makina-card hover:border-makina-subtle"
              }`}
            >
              <p className="text-lg font-bold">{cat.id}</p>
              <p className="text-xl font-bold text-makina-accent">{cat.submissions}</p>
              <p className="text-[11px] text-makina-muted mt-0.5">submissions · {cat.openIssues} open</p>
              <div className="mt-2 flex items-center justify-center gap-1">
                <div className="h-1.5 flex-1 rounded-full bg-makina-surface overflow-hidden">
                  <div
                    className="h-full rounded-full bg-makina-green"
                    style={{ width: `${cat.satisfaction * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-makina-muted">
                  {Math.round(cat.satisfaction * 100)}%
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Category filter pills */}
        <CategorySelector selected={selectedCategory} onSelect={setSelectedCategory} />

        {/* Quick action buttons */}
        <div className="rounded-2xl bg-makina-surface border border-makina-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Quick Feedback</h2>
            <span className="text-[11px] text-makina-muted">tap to select</span>
          </div>
          <QuickActions onSubmit={(actionId) => console.log("Quick action:", actionId)} />
        </div>

        {/* Detailed feedback composer */}
        <FeedbackComposer
          category={selectedCategory}
          onSubmit={(msg, cat) => console.log("Feedback:", msg, cat)}
        />

        {/* Live community feed */}
        <LiveFeed feedback={MOCK_FEEDBACK} category={selectedCategory} />
      </main>
    </div>
  );
}

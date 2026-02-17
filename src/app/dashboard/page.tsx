"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import VaultSelector from "@/components/VaultSelector";
import StatsBar from "@/components/StatsBar";
import LiveFeed from "@/components/LiveFeed";
import { SentimentChart, FeedbackTypePie, TopActionsChart } from "@/components/Charts";
import { MOCK_FEEDBACK, type VaultId, type FeedbackItem } from "@/lib/mock-data";
import { Filter, Download, Search } from "lucide-react";

type FilterType = "all" | FeedbackItem["type"];
type FilterStatus = "all" | FeedbackItem["status"];

export default function DashboardPage() {
  const [selectedVault, setSelectedVault] = useState<VaultId | "all">("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState(MOCK_FEEDBACK);

  const handleStatusChange = (id: string, status: FeedbackItem["status"]) => {
    setFeedback((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f))
    );
  };

  const filtered = feedback.filter((f) => {
    if (selectedVault !== "all" && f.vault !== selectedVault) return false;
    if (filterType !== "all" && f.type !== filterType) return false;
    if (filterStatus !== "all" && f.status !== filterStatus) return false;
    if (search && !f.message.toLowerCase().includes(search.toLowerCase()) && !f.user.displayName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Team Dashboard</h1>
            <p className="text-sm text-makina-muted">Review and manage community feedback</p>
          </div>
          <button className="flex items-center gap-2 self-start rounded-xl bg-makina-card border border-makina-border px-4 py-2 text-sm text-makina-muted hover:text-makina-text hover:border-makina-subtle transition-colors">
            <Download size={14} />
            Export CSV
          </button>
        </div>

        {/* Stats overview */}
        <StatsBar />

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <SentimentChart />
          </div>
          <FeedbackTypePie />
        </div>

        {/* Top quick actions chart */}
        <TopActionsChart />

        {/* Feedback management section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Vault filter */}
            <VaultSelector selected={selectedVault} onSelect={setSelectedVault} />
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-makina-muted">
              <Filter size={14} />
              <span>Filters:</span>
            </div>

            {/* Type filter */}
            <div className="flex gap-1">
              {(["all", "praise", "issue", "suggestion", "question"] as FilterType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filterType === type
                      ? "bg-makina-accent text-makina-bg"
                      : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"
                  }`}
                >
                  {type === "all" ? "All types" : type}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex gap-1">
              {(["all", "new", "reviewed", "addressed", "dismissed"] as FilterStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filterStatus === status
                      ? "bg-makina-blue text-white"
                      : "bg-makina-card text-makina-muted border border-makina-border hover:text-makina-text"
                  }`}
                >
                  {status === "all" ? "All statuses" : status}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-makina-subtle" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search feedback..."
                className="rounded-full bg-makina-card border border-makina-border pl-9 pr-4 py-1.5 text-xs text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50 w-48"
              />
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs text-makina-muted">
            Showing {filtered.length} of {feedback.length} feedback items
          </p>

          {/* Feed with status management */}
          <LiveFeed
            feedback={filtered}
            vault="all"
            showStatus
            onStatusChange={handleStatusChange}
          />
        </div>
      </main>
    </div>
  );
}

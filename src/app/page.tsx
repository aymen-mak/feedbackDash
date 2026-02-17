"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import VaultSelector from "@/components/VaultSelector";
import QuickActions from "@/components/QuickActions";
import FeedbackComposer from "@/components/FeedbackComposer";
import LiveFeed from "@/components/LiveFeed";
import { MOCK_FEEDBACK, VAULT_STATS, type VaultId } from "@/lib/mock-data";

export default function FeedbackPage() {
  const [selectedVault, setSelectedVault] = useState<VaultId | "all">("all");

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Share Your Feedback</h1>
          <p className="text-sm text-makina-muted">
            Help shape the future of Makina vaults. Your voice matters.
          </p>
        </div>

        {/* Vault overview cards */}
        <div className="grid grid-cols-3 gap-3">
          {VAULT_STATS.map((vault) => (
            <button
              key={vault.id}
              onClick={() => setSelectedVault(vault.id)}
              className={`rounded-2xl border p-4 text-center transition-all ${
                selectedVault === vault.id
                  ? "border-makina-accent bg-makina-accent-dim glow-accent"
                  : "border-makina-border bg-makina-card hover:border-makina-subtle"
              }`}
            >
              <p className="text-lg font-bold">{vault.id}</p>
              <p className="text-xl font-bold text-makina-accent">{vault.apy}%</p>
              <p className="text-[11px] text-makina-muted mt-0.5">APY · {vault.tvl} TVL</p>
              <div className="mt-2 flex items-center justify-center gap-1">
                <div className="h-1.5 flex-1 rounded-full bg-makina-surface overflow-hidden">
                  <div
                    className="h-full rounded-full bg-makina-green"
                    style={{ width: `${vault.sentiment * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-makina-muted">
                  {Math.round(vault.sentiment * 100)}%
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Vault filter pills */}
        <VaultSelector selected={selectedVault} onSelect={setSelectedVault} />

        {/* Quick action buttons (still.fun style) */}
        <div className="rounded-2xl bg-makina-surface border border-makina-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Quick Feedback</h2>
            <span className="text-[11px] text-makina-muted">tap to select</span>
          </div>
          <QuickActions onSubmit={(actionId) => console.log("Quick action:", actionId)} />
        </div>

        {/* Detailed feedback composer */}
        <FeedbackComposer
          vault={selectedVault}
          onSubmit={(msg, vault) => console.log("Feedback:", msg, vault)}
        />

        {/* Live community feed */}
        <LiveFeed feedback={MOCK_FEEDBACK} vault={selectedVault} />

        {/* Footer gamification hint */}
        <div className="text-center py-4 border-t border-makina-border">
          <p className="text-xs text-makina-subtle">
            Earn ethos by providing quality feedback · Active depositors get 2x ethos
          </p>
        </div>
      </main>
    </div>
  );
}

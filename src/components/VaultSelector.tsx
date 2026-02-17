"use client";

import { VAULT_STATS, type VaultId } from "@/lib/mock-data";

interface VaultSelectorProps {
  selected: VaultId | "all";
  onSelect: (vault: VaultId | "all") => void;
}

export default function VaultSelector({ selected, onSelect }: VaultSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onSelect("all")}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
          selected === "all"
            ? "bg-makina-accent text-makina-bg"
            : "bg-makina-card text-makina-muted border border-makina-border hover:border-makina-subtle hover:text-makina-text"
        }`}
      >
        All Vaults
      </button>
      {VAULT_STATS.map((vault) => (
        <button
          key={vault.id}
          onClick={() => onSelect(vault.id)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            selected === vault.id
              ? "bg-makina-accent text-makina-bg"
              : "bg-makina-card text-makina-muted border border-makina-border hover:border-makina-subtle hover:text-makina-text"
          }`}
        >
          <span>{vault.id}</span>
          <span className={`text-xs ${
            selected === vault.id ? "text-makina-bg/70" : "text-makina-subtle"
          }`}>
            {vault.apy}%
          </span>
        </button>
      ))}
    </div>
  );
}

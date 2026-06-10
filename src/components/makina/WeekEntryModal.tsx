"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  type AccountDef,
  type JournalEntry,
  CATEGORY_ORDER,
} from "@/lib/makina/journal";

interface Props {
  account: AccountDef;
  entry?: JournalEntry | null;
  defaultPeriodStart: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function WeekEntryModal({ account, entry, defaultPeriodStart, onClose, onSaved }: Props) {
  const [periodStart, setPeriodStart] = useState(entry?.periodStart ?? defaultPeriodStart);
  const [note, setNote] = useState(entry?.note ?? "");
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const m of account.metrics) {
      const v = entry?.values?.[m.key];
      init[m.key] = v != null ? String(v) : "";
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    const values: Record<string, number> = {};
    for (const m of account.metrics) {
      const raw = vals[m.key]?.trim();
      if (raw === "" || raw == null) continue;
      const n = Number(raw);
      if (Number.isFinite(n)) values[m.key] = n;
    }
    try {
      const res = await fetch("/api/makina/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: account.key, periodStart, values, note }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-xl border border-makina-border bg-makina-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-makina-border px-5 py-3">
          <h3 className="text-sm font-bold text-makina-text">
            {entry ? "Edit" : "Add"} period · <span className="text-makina-accent">{account.label}</span>
          </h3>
          <button onClick={onClose} className="text-makina-subtle hover:text-makina-text">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-makina-muted">
              Period start
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full rounded-lg border border-makina-border bg-makina-surface px-3 py-2 text-sm text-makina-text outline-none focus:border-makina-accent/50"
            />
          </div>

          {CATEGORY_ORDER.filter((cat) => account.metrics.some((m) => m.category === cat)).map((cat) => (
            <div key={cat}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-makina-muted">{cat}</p>
              <div className="grid grid-cols-2 gap-2">
                {account.metrics
                  .filter((m) => m.category === cat)
                  .map((m) => (
                    <label key={m.key} className="block">
                      <span className="mb-0.5 block text-[11px] text-makina-muted">
                        {m.label}
                        {m.kind === "ratio" ? " (%)" : ""}
                        {m.auto && <span className="ml-1 text-[9px] text-makina-green">auto</span>}
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={vals[m.key]}
                        onChange={(e) => setVals((p) => ({ ...p, [m.key]: e.target.value }))}
                        placeholder="—"
                        className="w-full rounded-md border border-makina-border bg-makina-surface px-2 py-1.5 text-sm tabular-nums text-makina-text outline-none focus:border-makina-accent/50"
                      />
                    </label>
                  ))}
              </div>
            </div>
          ))}

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-makina-muted">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Context, key events, spikes…"
              className="w-full resize-none rounded-lg border border-makina-border bg-makina-surface px-3 py-2 text-sm text-makina-text outline-none focus:border-makina-accent/50"
            />
          </div>

          {error && <p className="text-xs text-makina-red">{error}</p>}
          <p className="text-[10px] text-makina-subtle">
            Blank fields are left untouched (won’t overwrite auto-collected values). Use this to backfill history or
            fill owner-only gaps like profile visits.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-makina-border px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-makina-border px-3 py-2 text-sm text-makina-muted hover:text-makina-text">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg gradient-accent px-4 py-2 text-sm font-semibold text-makina-bg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

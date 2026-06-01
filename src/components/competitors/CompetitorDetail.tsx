"use client";

import { useState } from "react";
import { X, Pencil, Trash2, ExternalLink, AlertTriangle, Eye, EyeOff } from "lucide-react";
import {
  type Competitor,
  type Snapshot,
  type Platform,
  PLATFORM_LABELS,
  PLATFORM_METRIC_UNIT,
} from "@/lib/competitors/types";
import PlatformBadge from "./PlatformBadge";
import HistoryChart from "./HistoryChart";
import CompetitorEditor from "./CompetitorEditor";
import Sparkline from "./Sparkline";
import { PLATFORM_META, timeAgo, formatUsd, signedPct, audience, formatCount } from "./platformMeta";

const PLATFORM_ORDER: Platform[] = [
  "twitter",
  "discord",
  "telegram",
  "linkedin",
  "github",
  "reddit",
  "youtube",
  "other",
];

interface Props {
  competitor: Competitor;
  snapshots: Snapshot[];
  onClose: () => void;
  onChanged: () => void;
  onToggleHidden?: (id: string, hidden: boolean) => void;
}

export default function CompetitorDetail({ competitor, snapshots, onClose, onChanged, onToggleHidden }: Props) {
  const [current, setCurrent] = useState(competitor);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const platforms = [...current.platforms].sort(
    (a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform)
  );
  const withHistory = new Set(snapshots.map((s) => s.platform));
  const [selected, setSelected] = useState<Platform>(
    platforms.find((p) => withHistory.has(p.platform))?.platform ?? platforms[0]?.platform ?? "twitter"
  );
  const selectedMetric = current.platforms.find((p) => p.platform === selected);
  const selectedSnaps = snapshots.filter((s) => s.platform === selected);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/competitors/${current.id}`, { method: "DELETE" });
      if (res.ok) {
        onChanged();
        onClose();
      } else {
        setDeleting(false);
      }
    } catch {
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <CompetitorEditor
        initial={current}
        onClose={() => setEditing(false)}
        onSaved={(c) => {
          setCurrent(c);
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in-up"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-makina-border bg-makina-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-makina-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-bold text-makina-text">{current.name}</h2>
              {current.isSelf && (
                <span className="rounded-full bg-makina-accent-dim px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-makina-accent">
                  You
                </span>
              )}
              {current.website && (
                <a href={current.website} target="_blank" rel="noopener noreferrer" className="text-makina-subtle hover:text-makina-accent" title={current.website}>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
            <p className="mt-0.5 text-xs text-makina-muted">{current.segment}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {current.tvl && <span className="rounded-md bg-makina-surface px-1.5 py-0.5 text-[10px] text-makina-muted">TVL {current.tvl}</span>}
              {current.token && <span className="rounded-md bg-makina-surface px-1.5 py-0.5 text-[10px] font-medium text-makina-accent">{current.token}</span>}
              {audience(current) > 0 && (
                <span
                  className="rounded-md bg-makina-surface px-1.5 py-0.5 text-[10px] text-makina-muted"
                  title="X + Discord + Telegram + LinkedIn"
                >
                  Reach {formatCount(audience(current))}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 text-makina-muted hover:text-makina-text">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {current.remark && (
            <p className="text-xs leading-relaxed text-makina-muted">{current.remark}</p>
          )}

          {/* On-chain (DefiLlama) */}
          {(current.defillamaSlug || current.onchain?.tvl != null) && (
            <div className="rounded-lg border border-makina-border bg-makina-surface/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-makina-muted">
                  On-chain · DefiLlama
                </span>
                <span className="text-[10px] text-makina-subtle">
                  {current.onchain?.lastUpdated ? timeAgo(current.onchain.lastUpdated) : "awaiting refresh"}
                </span>
              </div>
              {current.onchain?.tvl != null ? (
                <>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-makina-text">{formatUsd(current.onchain.tvl)}</span>
                        <span className="text-[11px] text-makina-muted">TVL</span>
                      </div>
                      <div className="mt-0.5 flex gap-3 text-[11px]">
                        {current.onchain.tvlChange1d != null && (
                          <span className={current.onchain.tvlChange1d >= 0 ? "text-makina-green" : "text-makina-red"}>
                            24h {signedPct(current.onchain.tvlChange1d)}
                          </span>
                        )}
                        {current.onchain.tvlChange7d != null && (
                          <span className={current.onchain.tvlChange7d >= 0 ? "text-makina-green" : "text-makina-red"}>
                            7d {signedPct(current.onchain.tvlChange7d)}
                          </span>
                        )}
                      </div>
                    </div>
                    {current.onchain.tvlSeries.length >= 2 && (
                      <Sparkline data={current.onchain.tvlSeries.map((p) => p.v)} width={140} height={40} />
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-makina-muted sm:grid-cols-3">
                    {current.onchain.mcap != null && (
                      <span>Mcap <b className="font-semibold text-makina-text/80">{formatUsd(current.onchain.mcap)}</b></span>
                    )}
                    {current.onchain.fees24h != null && (
                      <span>Fees 24h <b className="font-semibold text-makina-text/80">{formatUsd(current.onchain.fees24h)}</b></span>
                    )}
                    {current.onchain.fees30d != null && (
                      <span>Fees 30d <b className="font-semibold text-makina-text/80">{formatUsd(current.onchain.fees30d)}</b></span>
                    )}
                    {current.onchain.revenue24h != null && (
                      <span>Rev 24h <b className="font-semibold text-makina-text/80">{formatUsd(current.onchain.revenue24h)}</b></span>
                    )}
                    {current.onchain.revenue30d != null && (
                      <span>Rev 30d <b className="font-semibold text-makina-text/80">{formatUsd(current.onchain.revenue30d)}</b></span>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-[11px] text-makina-subtle">
                  No on-chain data yet — slug <code className="text-makina-muted">{current.defillamaSlug}</code> populates on the next refresh.
                  {current.onchain?.lastError ? ` (${current.onchain.lastError})` : ""}
                </p>
              )}
            </div>
          )}

          {/* Platform overview */}
          <div className="flex flex-wrap gap-1.5">
            {platforms.map((p) => (
              <PlatformBadge key={p.platform} metric={p} />
            ))}
          </div>

          {/* History */}
          <div className="rounded-lg border border-makina-border bg-makina-surface/30 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-makina-muted">History</span>
              {platforms.map((p) => (
                <button
                  key={p.platform}
                  onClick={() => setSelected(p.platform)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-all ${
                    selected === p.platform
                      ? "bg-makina-surface text-makina-text border border-makina-border"
                      : "text-makina-subtle hover:text-makina-muted"
                  }`}
                >
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: PLATFORM_META[p.platform].color }} />
                  {PLATFORM_META[p.platform].short}
                </button>
              ))}
            </div>

            <HistoryChart snapshots={selectedSnaps} color={PLATFORM_META[selected].color} />

            {selectedMetric && (
              <div className="mt-2 space-y-1 text-[11px] text-makina-muted">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    Latest:{" "}
                    <span className="font-semibold text-makina-text">
                      {selectedMetric.value != null
                        ? `${selectedMetric.value.toLocaleString()} ${PLATFORM_METRIC_UNIT[selected]}`
                        : "N/A"}
                    </span>
                  </span>
                  <span>
                    Source: <span className={selectedMetric.source === "auto" ? "text-makina-green" : "text-makina-text"}>{selectedMetric.source}</span>
                  </span>
                  <span>Updated {timeAgo(selectedMetric.lastUpdated)}</span>
                </div>
                {selectedMetric.handle && (
                  <div>
                    Handle:{" "}
                    {selectedMetric.url ? (
                      <a href={selectedMetric.url} target="_blank" rel="noopener noreferrer" className="text-makina-accent hover:underline">
                        {selectedMetric.handle}
                      </a>
                    ) : (
                      <span className="text-makina-text">{selectedMetric.handle}</span>
                    )}
                  </div>
                )}
                {selectedMetric.note && <div className="italic">{selectedMetric.note}</div>}
                {selectedMetric.lastError && (
                  <div className="flex items-center gap-1 text-makina-red">
                    <AlertTriangle size={11} /> {selectedMetric.lastError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-makina-border px-5 py-3">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-makina-red">Delete {current.name}?</span>
              <button onClick={handleDelete} disabled={deleting} className="rounded-md bg-makina-red/90 px-2.5 py-1 text-xs font-semibold text-white hover:bg-makina-red disabled:opacity-50">
                {deleting ? "Deleting…" : "Confirm"}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-makina-muted hover:text-makina-text">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-makina-border bg-makina-surface px-3 py-1.5 text-xs text-makina-muted hover:border-makina-red/40 hover:text-makina-red"
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
          <div className="flex items-center gap-2">
            {onToggleHidden && (
              <button
                onClick={() => {
                  const next = !current.hidden;
                  setCurrent({ ...current, hidden: next });
                  onToggleHidden(current.id, next);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-makina-border bg-makina-surface px-3 py-1.5 text-xs text-makina-muted transition-colors hover:text-makina-text"
              >
                {current.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                {current.hidden ? "Un-hide" : "Hide"}
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-md gradient-accent px-4 py-1.5 text-sm font-semibold text-makina-bg transition-all hover:brightness-110"
            >
              <Pencil size={13} />
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

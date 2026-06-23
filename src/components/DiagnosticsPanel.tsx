"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, RefreshCw, type LucideIcon } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import type { FullDiag, DiagItem, DiagLevel } from "@/lib/diagnostics";

const LEVEL: Record<DiagLevel, { color: string; Icon: LucideIcon; word: string }> = {
  ok: { color: "#22c55e", Icon: CheckCircle2, word: "all healthy" },
  info: { color: "#5b9cf6", Icon: Info, word: "info" },
  warn: { color: "#f59e0b", Icon: AlertTriangle, word: "needs attention" },
  error: { color: "#ef4444", Icon: XCircle, word: "problem found" },
};

function fmtAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Fetches the app-wide diagnostics report; shared by the metrics + competitor pages. */
export function useDiagnostics() {
  const [report, setReport] = useState<FullDiag | null>(null);
  const [loading, setLoading] = useState(false);
  const run = useCallback(async () => {
    setLoading(true);
    try {
      const d = (await fetch("/api/diagnose").then((r) => (r.ok ? r.json() : null))) as FullDiag | null;
      if (d && Array.isArray(d.groups)) setReport(d);
    } catch {
      /* leave the previous report in place */
    }
    setLoading(false);
  }, []);
  return { report, loading, run };
}

function Linkify({ text }: { text: string }) {
  const m = text.match(/(https?:\/\/[^\s]+)/);
  if (!m) return <>{text}</>;
  const [before, after] = text.split(m[1]);
  return (
    <>
      {before}
      <a href={m[1]} target="_blank" rel="noopener noreferrer" className="text-makina-accent underline">
        {m[1]}
      </a>
      {after}
    </>
  );
}

function Evidence({ ev }: { ev: DiagItem["evidence"] }) {
  if (!ev) return null;
  const entries = Object.entries(ev).filter(([, v]) => v !== null && v !== "");
  if (!entries.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="rounded border border-makina-border bg-makina-surface px-1.5 py-px text-[10px] tabular-nums text-makina-subtle"
        >
          {k} <span className="text-makina-muted">{String(v)}</span>
        </span>
      ))}
    </div>
  );
}

function Item({ it }: { it: DiagItem }) {
  const { color, Icon } = LEVEL[it.level];
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Icon size={14} className="mt-0.5 shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p className="text-xs text-makina-text/90">
          <span className="font-semibold">{it.label}:</span> {it.summary}
        </p>
        {it.fix && (
          <p className="mt-0.5 text-[11px] text-makina-muted">
            <Linkify text={it.fix} />
          </p>
        )}
        <Evidence ev={it.evidence} />
      </div>
    </div>
  );
}

export default function DiagnosticsPanel({
  report,
  loading,
  onRefresh,
  onClose,
}: {
  report: FullDiag | null;
  loading: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const overall = report?.level ?? "info";
  const meta = LEVEL[overall];
  return (
    <div
      className="mb-4 rounded-xl border p-4 animate-fade-in-up"
      style={{ borderColor: `${meta.color}40`, backgroundColor: `${meta.color}0d` }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
          <meta.Icon size={13} /> Diagnostics{report ? ` · ${meta.word}` : ""}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-[11px] text-makina-subtle transition-colors hover:text-makina-text disabled:opacity-50"
          >
            {loading ? <Spinner size={12} /> : <RefreshCw size={12} />} re-check
          </button>
          <button onClick={onClose} className="text-[11px] text-makina-subtle transition-colors hover:text-makina-text">
            dismiss
          </button>
        </div>
      </div>

      {!report ? (
        <div className="flex items-center gap-2 py-3 text-xs text-makina-muted">
          <Spinner size={14} className="text-makina-accent" /> Running checks…
        </div>
      ) : (
        <div className="space-y-3">
          {report.groups.map((g) => (
            <div key={g.id}>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: LEVEL[g.level].color }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-makina-muted">{g.label}</span>
                {g.ranAt && <span className="text-[10px] text-makina-subtle">· ran {fmtAgo(g.ranAt)}</span>}
              </div>
              {g.items.length === 0 ? (
                <p className="ml-3.5 mt-1 text-[11px] text-makina-subtle">{g.note ?? "No checks."}</p>
              ) : (
                <div className="ml-3.5 mt-0.5 divide-y divide-makina-border/40">
                  {g.items.map((it) => (
                    <Item key={it.id} it={it} />
                  ))}
                </div>
              )}
            </div>
          ))}
          <p className="text-[10px] text-makina-subtle">Checked {fmtAgo(report.at)}.</p>
        </div>
      )}
    </div>
  );
}

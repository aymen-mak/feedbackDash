"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Upload, Plus, Trash2, Check, ExternalLink, FileText, X, Lightbulb } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PageLoader, Spinner } from "@/components/Spinner";
import { type TrafficWeek, type ActionItem, type Insight, type TrafficRow, pagesPerVisitor } from "@/lib/traffic/types";

const fmt = (n: number): string => n.toLocaleString("en-US");
const pct = (cur: number, prev: number | null | undefined): number | null =>
  prev != null && prev > 0 ? +(((cur - prev) / prev) * 100).toFixed(1) : null;

function Delta({ cur, prev }: { cur: number; prev: number | null | undefined }) {
  const p = pct(cur, prev);
  if (p == null) return <span className="text-[11px] text-makina-subtle">—</span>;
  const cls = Math.abs(p) < 0.1 ? "text-makina-subtle" : p > 0 ? "text-makina-green" : "text-makina-red";
  return <span className={`text-[11px] font-medium tabular-nums ${cls}`}>{p > 0 ? "+" : ""}{p}%</span>;
}

const TONE: Record<Insight["tone"], { dot: string; ring: string }> = {
  good: { dot: "#22c55e", ring: "border-makina-green/30" },
  watch: { dot: "#f59e0b", ring: "border-amber-500/30" },
  bad: { dot: "#ef4444", ring: "border-makina-red/30" },
  info: { dot: "#5b9cf6", ring: "border-makina-accent/30" },
};

function KPI({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-makina-border bg-makina-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-makina-subtle">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-makina-text">{value}</div>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

function DailyChart({ week }: { week: TrafficWeek }) {
  const d = week.daily;
  if (!d.length) return null;
  const W = 680, H = 180, pad = 28;
  const maxV = Math.max(...d.map((x) => x.pageviews), 1);
  const X = (i: number) => pad + (W - pad * 2) * (i / Math.max(1, d.length - 1));
  const Y = (v: number) => H - pad - (H - pad * 2) * (v / maxV);
  const line = (key: "visitors" | "pageviews") => d.map((x, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(x[key]).toFixed(1)}`).join(" ");
  return (
    <div className="rounded-xl border border-makina-border bg-makina-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-makina-text">Daily traffic</h3>
        <div className="flex items-center gap-3 text-[11px] text-makina-muted">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: "#5b9cf6" }} />Pageviews</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: "#22c55e" }} />Visitors</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 520 }}>
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={pad} x2={W - pad} y1={Y(maxV * f)} y2={Y(maxV * f)} stroke="rgba(120,130,150,0.25)" strokeWidth="1" />
          ))}
          <path d={line("pageviews")} fill="none" stroke="#5b9cf6" strokeWidth="2" strokeLinejoin="round" />
          <path d={line("visitors")} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" />
          {d.map((x, i) => (
            <g key={i}>
              <circle cx={X(i)} cy={Y(x.pageviews)} r="2.5" fill="#5b9cf6" />
              <circle cx={X(i)} cy={Y(x.visitors)} r="2.5" fill="#22c55e" />
              <text x={X(i)} y={H - 8} textAnchor="middle" className="fill-makina-subtle" style={{ fontSize: 9 }}>{x.day.split(" ").slice(1).join(" ")}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function RowTable({ title, rows, unit, depth }: { title: string; rows: TrafficRow[]; unit?: string; depth?: boolean }) {
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-makina-border bg-makina-card">
      <div className="border-b border-makina-border px-4 py-3 text-sm font-semibold text-makina-text">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-makina-subtle">
              <th className="px-4 py-2 text-left font-medium">{unit ?? "Name"}</th>
              <th className="px-4 py-2 text-right font-medium">Visitors</th>
              <th className="px-4 py-2 text-right font-medium">Views</th>
              {depth && <th className="px-4 py-2 text-right font-medium">Pages/visitor</th>}
              <th className="px-4 py-2 text-right font-medium">WoW</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-makina-border/50 hover:bg-makina-surface/40">
                <td className="px-4 py-2 font-medium text-makina-text/90">{r.name}</td>
                <td className="px-4 py-2 text-right tabular-nums text-makina-text">{fmt(r.visitors)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-makina-muted">{fmt(r.pageviews)}</td>
                {depth && <td className="px-4 py-2 text-right tabular-nums text-makina-muted">{pagesPerVisitor(r.pageviews, r.visitors)}</td>}
                <td className="px-4 py-2 text-right"><Delta cur={r.visitors} prev={r.priorVisitors} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrafficInner() {
  const [weeks, setWeeks] = useState<TrafficWeek[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [aiOn, setAiOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string>("");
  const [tab, setTab] = useState<"report" | "insights">("report");
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [newAction, setNewAction] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/traffic").then((x) => (x.ok ? x.json() : null));
      if (r) {
        setWeeks(r.weeks ?? []);
        setActions(r.actionItems ?? []);
        setAiOn(!!r.aiConfigured);
        setSel((cur) => cur || (r.weeks?.[0]?.id ?? ""));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const week = useMemo(() => weeks.find((w) => w.id === sel) ?? weeks[0], [weeks, sel]);

  const flash = (tone: "ok" | "err", text: string) => { setMsg({ tone, text }); setTimeout(() => setMsg(null), 6000); };

  const uploadPdf = async (file: File) => {
    setBusy("Reading the report and researching current trends. This can take a minute.");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/traffic/ingest", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) { await load(); setSel(data.week.id); setTab("insights"); flash("ok", "Done. Metrics and research updated."); }
      else flash("err", data?.error || "Upload failed.");
    } catch (e) { flash("err", String(e)); }
    setBusy("");
  };

  const importJson = async () => {
    setBusy("Importing…"); setMsg(null);
    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch("/api/traffic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "week-import", week: parsed }) });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) { await load(); setSel(data.week.id); setShowImport(false); setJsonText(""); flash("ok", "Week imported."); }
      else flash("err", data?.error || "Import failed.");
    } catch { flash("err", "That isn't valid JSON."); }
    setBusy("");
  };

  const action = async (op: string, payload: Record<string, unknown>) => {
    const res = await fetch("/api/traffic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, ...payload }) });
    const data = await res.json().catch(() => null);
    if (data?.actionItems) setActions(data.actionItems);
  };

  if (loading) return <PageLoader />;

  const research = week?.research;
  const openActions = actions.filter((a) => !a.done);
  const doneActions = actions.filter((a) => a.done);

  return (
    <div className="min-h-screen bg-makina-bg">
      <Navbar />
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = ""; }} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-makina-text">Web Traffic</h1>
            <p className="mt-0.5 text-xs text-makina-muted">
              {week ? `${week.label}${week.source ? ` · ${week.source}` : ""}` : "No reports yet"}
              {!aiOn && <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">AI research off · set ANTHROPIC_API_KEY</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {weeks.length > 0 && (
              <select value={sel} onChange={(e) => setSel(e.target.value)} className="rounded-lg border border-makina-border bg-makina-surface px-3 py-2 text-sm text-makina-text outline-none" title="Pick a week">
                {weeks.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
            )}
            <button onClick={() => setShowImport(true)} className="rounded-lg border border-makina-border px-3 py-2 text-xs font-medium text-makina-muted hover:text-makina-text" title="Paste a week's JSON">
              <FileText size={14} className="mr-1 inline" />JSON
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg gradient-accent px-4 py-2 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 disabled:opacity-50">
              {busy ? <Spinner size={14} /> : <Upload size={14} />}Upload report
            </button>
          </div>
        </div>

        {busy && <div className="mt-4 rounded-lg border border-makina-accent/30 bg-makina-accent-dim px-4 py-3 text-sm text-makina-accent">{busy}</div>}
        {msg && <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${msg.tone === "ok" ? "border-makina-green/30 bg-makina-green/10 text-makina-green" : "border-makina-red/30 bg-makina-red/10 text-makina-red"}`}>{msg.text}</div>}

        {/* Tabs */}
        <div className="mt-5 flex gap-1 border-b border-makina-border">
          {([["report", "Report"], ["insights", "Insights & actions"]] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-all ${tab === k ? "border-makina-accent text-makina-text" : "border-transparent text-makina-muted hover:text-makina-text"}`}>{lbl}</button>
          ))}
        </div>

        {!week ? (
          <div className="mt-10 text-center text-sm text-makina-muted">No reports yet. Upload a weekly PDF to begin.</div>
        ) : tab === "report" ? (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KPI label="Visitors" value={fmt(week.visitors)} sub={<Delta cur={week.visitors} prev={week.visitorsPrev} />} />
              <KPI label="Pageviews" value={fmt(week.pageviews)} sub={<Delta cur={week.pageviews} prev={week.pageviewsPrev} />} />
              <KPI label="Pages / visitor" value={String(pagesPerVisitor(week.pageviews, week.visitors))} />
              <KPI label="Busiest day" value={[...week.daily].sort((a, b) => b.visitors - a.visitors)[0]?.day.split(" ").slice(1).join(" ") ?? "—"} sub={<span className="text-[11px] text-makina-subtle">{[...week.daily].sort((a, b) => b.visitors - a.visitors)[0]?.visitors ?? 0} visitors</span>} />
            </div>
            <DailyChart week={week} />
            <div className="grid gap-5 lg:grid-cols-2">
              <RowTable title="Referrers" rows={week.sources} unit="Source" />
              <RowTable title="Countries" rows={week.countries} unit="Country" depth />
              <RowTable title="Routes" rows={week.routes} unit="Route" />
              <RowTable title="Devices" rows={week.devices} unit="Device" />
            </div>
            {week.observations && (
              <div className="rounded-xl border border-makina-border bg-makina-card p-4">
                <h3 className="mb-2 text-sm font-semibold text-makina-text">Report notes</h3>
                <p className="text-sm leading-relaxed text-makina-muted">{week.observations}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-5">
            {/* Insights */}
            <div className="space-y-4 lg:col-span-3">
              {research?.summary && (
                <div className="rounded-xl border border-makina-accent/25 bg-makina-accent-dim/40 p-4">
                  <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-makina-accent">
                    <Lightbulb size={13} /> Summary {research.model !== "heuristic" && <span className="text-makina-subtle normal-case tracking-normal">· {research.model}</span>}
                  </div>
                  <p className="text-sm leading-relaxed text-makina-text/90">{research.summary}</p>
                </div>
              )}
              <h3 className="text-sm font-semibold text-makina-text">Behaviour insights</h3>
              <div className="space-y-2.5">
                {(research?.insights ?? []).map((ins, i) => (
                  <div key={i} className={`rounded-xl border bg-makina-card p-3.5 ${TONE[ins.tone].ring}`}>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: TONE[ins.tone].dot }} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-makina-text">{ins.title}</span>
                          <span className="rounded bg-makina-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-makina-subtle">{ins.lens}</span>
                        </div>
                        <p className="mt-0.5 text-[13px] leading-snug text-makina-muted">{ins.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!research?.insights?.length && <p className="text-sm text-makina-subtle">No insights yet.</p>}
              </div>
              {!!research?.sources?.length && (
                <div className="rounded-xl border border-makina-border bg-makina-card p-4">
                  <h4 className="mb-2 text-[11px] uppercase tracking-wider text-makina-subtle">Research sources</h4>
                  <ul className="space-y-1.5">
                    {research.sources.map((s, i) => (
                      <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-makina-accent hover:underline"><ExternalLink size={12} />{s.title || s.url}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Action items (editable) */}
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-makina-border bg-makina-card">
                <div className="border-b border-makina-border px-4 py-3 text-sm font-semibold text-makina-text">Action items</div>
                <div className="flex gap-2 border-b border-makina-border/60 p-3">
                  <input value={newAction} onChange={(e) => setNewAction(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newAction.trim()) { action("action-add", { text: newAction.trim() }); setNewAction(""); } }} placeholder="Add an action item…" className="flex-1 rounded-lg border border-makina-border bg-makina-surface px-3 py-2 text-sm text-makina-text outline-none placeholder:text-makina-subtle" />
                  <button onClick={() => { if (newAction.trim()) { action("action-add", { text: newAction.trim() }); setNewAction(""); } }} className="rounded-lg bg-makina-accent-dim px-2.5 text-makina-accent hover:brightness-110"><Plus size={16} /></button>
                </div>
                <ul className="divide-y divide-makina-border/50">
                  {[...openActions, ...doneActions].map((a) => (
                    <li key={a.id} className="flex items-start gap-2.5 px-4 py-2.5">
                      <button onClick={() => action("action-update", { id: a.id, patch: { done: !a.done } })} className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${a.done ? "border-makina-green bg-makina-green/20 text-makina-green" : "border-makina-border"}`}>{a.done && <Check size={11} />}</button>
                      <span className={`flex-1 text-[13px] leading-snug ${a.done ? "text-makina-subtle line-through" : "text-makina-text/90"}`}>{a.text}</span>
                      {a.source === "auto" && <span className="mt-0.5 rounded bg-makina-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-makina-subtle">auto</span>}
                      <button onClick={() => action("action-delete", { id: a.id })} className="mt-0.5 text-makina-subtle hover:text-makina-red"><Trash2 size={13} /></button>
                    </li>
                  ))}
                  {!actions.length && <li className="px-4 py-6 text-center text-sm text-makina-subtle">No action items yet.</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowImport(false)}>
          <div className="w-full max-w-xl rounded-xl border border-makina-border bg-makina-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-makina-text">Import a week (JSON)</h3>
              <button onClick={() => setShowImport(false)} className="text-makina-subtle hover:text-makina-text"><X size={16} /></button>
            </div>
            <p className="mb-2 text-xs text-makina-muted">Use this if AI research is off. Paste one week as JSON: the totals plus the daily, sources, countries, routes and devices arrays.</p>
            <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={10} placeholder='{ "weekStart":"2026-11-09","label":"Nov 9–15","visitors":800, ... }' className="w-full rounded-lg border border-makina-border bg-makina-surface p-3 font-mono text-xs text-makina-text outline-none" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowImport(false)} className="rounded-lg border border-makina-border px-3 py-2 text-sm text-makina-muted">Cancel</button>
              <button onClick={importJson} disabled={!!busy} className="rounded-lg gradient-accent px-4 py-2 text-sm font-semibold text-makina-bg disabled:opacity-50">Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrafficPage() {
  return <TrafficInner />;
}

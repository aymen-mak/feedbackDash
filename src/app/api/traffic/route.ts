import { NextRequest, NextResponse } from "next/server";
import {
  getTraffic,
  upsertWeek,
  deleteWeek,
  addActionItem,
  updateActionItem,
  deleteActionItem,
  replaceAutoActions,
} from "@/lib/traffic/store";
import { deriveInsights, deriveSuggestions } from "@/lib/traffic/insights";
import { aiConfigured } from "@/lib/traffic/ingest";
import { type TrafficWeek, type WeekResearch, type TrafficRow } from "@/lib/traffic/types";

export const dynamic = "force-dynamic";

function heuristicResearch(w: TrafficWeek): WeekResearch {
  return { generatedAt: w.updatedAt, model: "heuristic", summary: "", insights: deriveInsights(w), suggestions: deriveSuggestions(w), sources: [] };
}

export async function GET() {
  try {
    const store = await getTraffic();
    const weeks = store.weeks.map((w) => (w.research && w.research.insights.length ? w : { ...w, research: heuristicResearch(w) }));
    return NextResponse.json({ weeks, actionItems: store.actionItems, aiConfigured: aiConfigured() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" ? +v.replace(/[, ]/g, "") || 0 : 0);
const nOrNull = (v: unknown): number | null => (v == null || v === "" ? null : num(v));
const rows = (v: unknown, withPrevPv = false): TrafficRow[] =>
  Array.isArray(v)
    ? v.map((d: Record<string, unknown>) => ({
        name: String(d.name ?? ""),
        visitors: num(d.visitors),
        pageviews: num(d.pageviews),
        priorVisitors: nOrNull(d.priorVisitors),
        ...(withPrevPv ? { priorPageviews: nOrNull(d.priorPageviews) } : {}),
      }))
    : [];

/** Coerce a pasted JSON week into a TrafficWeek with heuristic research. */
function normalizeManualWeek(raw: Record<string, unknown>): TrafficWeek {
  const weekStart = String(raw.weekStart ?? raw.id ?? new Date().toISOString().slice(0, 10));
  const now = new Date().toISOString();
  const w: TrafficWeek = {
    id: weekStart,
    weekStart,
    weekEnd: String(raw.weekEnd ?? weekStart),
    label: String(raw.label ?? weekStart),
    source: raw.source ? String(raw.source) : null,
    visitors: num(raw.visitors),
    pageviews: num(raw.pageviews),
    visitorsPrev: nOrNull(raw.visitorsPrev),
    pageviewsPrev: nOrNull(raw.pageviewsPrev),
    daily: Array.isArray(raw.daily) ? raw.daily.map((d: Record<string, unknown>) => ({ day: String(d.day ?? ""), visitors: num(d.visitors), pageviews: num(d.pageviews) })) : [],
    sources: rows(raw.sources),
    countries: rows(raw.countries),
    routes: rows(raw.routes),
    devices: rows(raw.devices, true),
    observations: raw.observations ? String(raw.observations) : null,
    research: null,
    createdAt: now,
    updatedAt: now,
  };
  w.research = heuristicResearch(w);
  return w;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const op = String(body.op ?? "");
    if (op === "action-add") return NextResponse.json(await addActionItem(String(body.text ?? "")));
    if (op === "action-update") return NextResponse.json(await updateActionItem(String(body.id), body.patch ?? {}));
    if (op === "action-delete") return NextResponse.json(await deleteActionItem(String(body.id)));
    if (op === "week-delete") return NextResponse.json(await deleteWeek(String(body.id)));
    if (op === "week-import" && body.week && typeof body.week === "object") {
      const w = normalizeManualWeek(body.week as Record<string, unknown>);
      await upsertWeek(w);
      await replaceAutoActions(w.id, w.research?.suggestions ?? []);
      return NextResponse.json({ ok: true, week: w });
    }
    return NextResponse.json({ error: "Unknown operation" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

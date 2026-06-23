// App-wide diagnostics: one report covering every moving part of the dashboard
// — system (config, storage, Apify), the Makina metrics collectors, and the
// competitor tracker (every social platform + on-chain). The Makina group is
// read back from the last collection run (the only place that knows whether the
// X scraper returned nothing vs. broke); the competitor group is derived live
// from the per-platform lastError/lastUpdated already stored on each competitor.

import {
  apifyDiag,
  envDiag,
  storageDiag,
  worstLevel,
  type DiagItem,
  type DiagLevel,
} from "@/lib/makina/diagnostics";
import { getDiag as getMakinaDiag, getJournal } from "@/lib/makina/service";
import { listCompetitors } from "@/lib/competitors/service";
import { PLATFORMS, PLATFORM_LABELS, type Competitor } from "@/lib/competitors/types";
import { hasPostgres } from "@/lib/db";

export type { DiagItem, DiagLevel } from "@/lib/makina/diagnostics";

export interface DiagGroup {
  id: string;
  label: string;
  level: DiagLevel;
  items: DiagItem[];
  /** When this group's data was produced (collection/refresh time). */
  ranAt?: string | null;
  /** Shown when the group has no data yet. */
  note?: string;
}

export interface FullDiag {
  at: string;
  level: DiagLevel;
  groups: DiagGroup[];
  apify: { usage: number | null; limit: number | null; resetAt: string | null } | null;
}

function levelFor(ok: number, errored: number): DiagLevel {
  if (errored > 0 && ok === 0) return "error";
  if (errored > 0) return "warn";
  if (ok === 0) return "info";
  return "ok";
}

/** Live competitor health, aggregated per platform + on-chain, from stored data. */
function competitorItems(competitors: Competitor[]): DiagItem[] {
  const active = competitors.filter((c) => !c.hidden);
  const items: DiagItem[] = [];

  for (const p of PLATFORMS) {
    const withKey = active.filter((c) => c.platforms.some((m) => m.platform === p && m.autoKey));
    if (withKey.length === 0) continue;
    let ok = 0;
    let errored = 0;
    let sampleErr: string | null = null;
    let lastUpdated: string | null = null;
    for (const c of withKey) {
      const m = c.platforms.find((x) => x.platform === p && x.autoKey)!;
      if (m.lastError) {
        errored++;
        if (!sampleErr) sampleErr = `${c.name}: ${m.lastError}`;
      } else if (m.value != null) {
        ok++;
      }
      if (m.lastUpdated && (!lastUpdated || m.lastUpdated > lastUpdated)) lastUpdated = m.lastUpdated;
    }
    items.push({
      id: `comp:${p}`,
      label: `Competitors · ${PLATFORM_LABELS[p]}`,
      level: levelFor(ok, errored),
      summary: `${ok}/${withKey.length} auto-collected OK${errored ? `, ${errored} errored` : ""}${
        sampleErr ? ` — e.g. ${sampleErr}` : ""
      }.`,
      fix: errored > 0 ? "Open the affected competitor to see the per-platform error (usually a changed handle or a transient block)." : undefined,
      evidence: { ok, errored, total: withKey.length, lastUpdated },
    });
  }

  const withSlug = active.filter((c) => c.defillamaSlug);
  if (withSlug.length) {
    let ok = 0;
    let errored = 0;
    let sampleErr: string | null = null;
    let lastUpdated: string | null = null;
    for (const c of withSlug) {
      const oc = c.onchain;
      if (oc?.lastError) {
        errored++;
        if (!sampleErr) sampleErr = `${c.name}: ${oc.lastError}`;
      } else if (oc?.tvl != null) {
        ok++;
      }
      if (oc?.lastUpdated && (!lastUpdated || oc.lastUpdated > lastUpdated)) lastUpdated = oc.lastUpdated;
    }
    items.push({
      id: "comp:onchain",
      label: "Competitors · On-chain (DefiLlama)",
      level: levelFor(ok, errored),
      summary: `${ok}/${withSlug.length} protocols have TVL${errored ? `, ${errored} errored` : ""}${
        sampleErr ? ` — e.g. ${sampleErr}` : ""
      }.`,
      fix: errored > 0 ? "Check the DefiLlama slug on the affected protocol(s)." : undefined,
      evidence: { ok, errored, total: withSlug.length, lastUpdated },
    });
  }

  const allUpdated = active
    .flatMap((c) => [...c.platforms.map((m) => m.lastUpdated), c.onchain?.lastUpdated])
    .filter(Boolean)
    .sort() as string[];
  const latest = allUpdated[allUpdated.length - 1] ?? null;
  const ageH = latest ? (Date.now() - new Date(latest).getTime()) / 3.6e6 : Infinity;
  items.push({
    id: "comp:freshness",
    label: "Competitors · Freshness",
    level: !latest ? "info" : ageH > 48 ? "warn" : "ok",
    summary: !latest
      ? "No competitor data has been collected yet."
      : `Most recent data point is ${Math.round(ageH)}h old${ageH > 48 ? " — the daily refresh may not be running." : "."}`,
    fix: !latest
      ? "Open the Competitors page and click Refresh now."
      : ageH > 48
      ? "Run Refresh now; if it keeps going stale, check the daily cron in vercel.json."
      : undefined,
    evidence: { lastUpdated: latest, competitors: active.length },
  });

  return items;
}

export async function diagnoseAll(): Promise<FullDiag> {
  const [{ item: apifyItem, apify }, makina, journal, competitors] = await Promise.all([
    apifyDiag(),
    getMakinaDiag(),
    getJournal(),
    listCompetitors().catch(() => [] as Competitor[]),
  ]);

  const lastEntry = journal.entries.length ? journal.entries[journal.entries.length - 1].periodStart : null;
  const systemItems: DiagItem[] = [
    apifyItem,
    envDiag(),
    storageDiag({ postgres: hasPostgres(), entries: journal.entries.length, lastAt: lastEntry }),
  ];

  // Makina group: only the per-source items from the last run (apify/env live in System).
  const makinaSrc = (makina?.items ?? []).filter((it) => it.id.startsWith("src:"));
  const makinaGroup: DiagGroup = {
    id: "makina",
    label: "Makina metrics",
    items: makinaSrc,
    level: makinaSrc.length ? worstLevel(makinaSrc) : "info",
    ranAt: makina?.at ?? null,
    note: makinaSrc.length ? undefined : "No collection has run yet — use “Collect now” on the Metrics page.",
  };

  const compItems = competitorItems(competitors);
  const groups: DiagGroup[] = [
    { id: "system", label: "System", items: systemItems, level: worstLevel(systemItems) },
    makinaGroup,
    { id: "competitors", label: "Competitor tracker", items: compItems, level: worstLevel(compItems) },
  ];

  return {
    at: new Date().toISOString(),
    level: worstLevel(groups.flatMap((g) => g.items)),
    groups,
    apify,
  };
}

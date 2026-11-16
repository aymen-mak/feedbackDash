import pdf from "pdf-parse/lib/pdf-parse.js";
import { type TrafficDay, type TrafficRow } from "./types";

// Deterministic PDF -> metrics parser. No API key needed. Works on the weekly
// report format by reconstructing table columns from text-item positions:
// pdf-parse joins same-line items, so we insert a tab between them and a
// newline on a vertical change, which recovers clean rows and cells.

export interface ParsedWeek {
  weekStart: string;
  weekEnd: string;
  label: string;
  source: string | null;
  visitors: number;
  pageviews: number;
  visitorsPrev: number | null;
  pageviewsPrev: number | null;
  daily: TrafficDay[];
  sources: TrafficRow[];
  countries: TrafficRow[];
  routes: TrafficRow[];
  devices: TrafficRow[];
  observations: string | null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const pad = (n: number) => String(n).padStart(2, "0");

const toNum = (s: string): number | null => {
  const t = (s ?? "").replace(/[,+\s]/g, "").trim();
  if (t === "" || t === "—" || t === "-" || t === "–") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const toInt = (s: string): number => {
  const n = toNum(s);
  return n == null ? 0 : Math.round(n);
};
// Prior-period visitor/pageview counts are whole numbers. A non-integer here
// (e.g. 4.21) means we latched onto a pages-per-visitor ratio column, not a
// prior count, so reject it and let week-over-week come from stored history.
const intCount = (s: string): number | null => {
  const n = toNum(s);
  return n != null && Number.isInteger(n) ? n : null;
};

function pagerender(pageData: { getTextContent: (o: object) => Promise<{ items: { str: string; transform: number[] }[] }> }): Promise<string> {
  return pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false }).then((tc) => {
    let lastY: number | null = null;
    let out = "";
    for (const it of tc.items) {
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) out += "\n";
      else if (lastY !== null) out += "\t";
      out += it.str;
      lastY = y;
    }
    return out;
  });
}

function parseDateRange(line: string): { label: string; weekStart: string; weekEnd: string; source: string | null } {
  const label = line.split(/,?\s*compared|\.\s*Source/i)[0].trim();
  const yearM = line.match(/\b(20\d{2})\b/);
  const year = yearM ? +yearM[1] : new Date().getFullYear();
  const monRe = /([A-Za-z]{3,})\s+(\d{1,2})/g;
  const toks: { mon: number; day: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = monRe.exec(label)) && toks.length < 2) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon) toks.push({ mon, day: +m[2] });
  }
  let start = toks[0];
  let end = toks[1];
  if (start && !end) {
    const dashM = label.match(/\d{1,2}\s*[–-]\s*(\d{1,2})/);
    if (dashM) end = { mon: start.mon, day: +dashM[1] };
  }
  const iso = (t?: { mon: number; day: number }) => (t ? `${year}-${pad(t.mon)}-${pad(t.day)}` : "");
  const ws = iso(start) || new Date().toISOString().slice(0, 10);
  const we = iso(end) || ws;
  const sm = line.match(/Source:\s*([^.]+)/i);
  return { label: label || ws, weekStart: ws, weekEnd: we, source: sm ? sm[1].trim() : null };
}

export async function parsePdf(buf: Buffer): Promise<ParsedWeek> {
  const data = await pdf(buf, { pagerender });
  const lines = data.text.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
  const cellsOf = (l: string) => l.split("\t").map((c) => c.trim());

  let label = "", weekStart = "", weekEnd = "", source: string | null = null;
  const dateLine = lines.find((l) => /compared with/i.test(l)) || lines.find((l) => /\b20\d{2}\b/.test(l) && /[A-Za-z]{3,}\s+\d{1,2}/.test(l));
  if (dateLine) {
    const d = parseDateRange(dateLine);
    label = d.label; weekStart = d.weekStart; weekEnd = d.weekEnd; source = d.source;
  }

  let visitors = 0, pageviews = 0;
  let visitorsPrev: number | null = null, pageviewsPrev: number | null = null;
  const hl = lines.find((l) => /visitors,.*pageviews/i.test(l));
  if (hl) {
    const vm = hl.match(/([\d,]+)\s+visitors/i);
    const pm = hl.match(/([\d,]+)\s+pageviews/i);
    visitors = vm ? toInt(vm[1]) : 0;
    pageviews = pm ? toInt(pm[1]) : 0;
    const vd = hl.match(/Visitors\s*([+-][\d,]+)/i);
    const pd = hl.match(/Pageviews\s*([+-][\d,]+)/i);
    if (vd) visitorsPrev = visitors - toInt(vd[1]);
    if (pd) pageviewsPrev = pageviews - toInt(pd[1]);
  }

  const daily: TrafficDay[] = [], sources: TrafficRow[] = [], countries: TrafficRow[] = [], routes: TrafficRow[] = [], devices: TrafficRow[] = [];
  let mode: "" | "day" | "source" | "country" | "route" | "device" = "";
  const obs: string[] = [];
  let inObs = false;

  for (const line of lines) {
    const cells = cellsOf(line);
    if (cells[0] === "Day" && /visitor/i.test(cells[1] || "")) { mode = "day"; inObs = false; continue; }
    if (cells[0] === "Source") { mode = "source"; inObs = false; continue; }
    if (cells[0] === "Country") { mode = "country"; inObs = false; continue; }
    if (cells[0] === "Route") { mode = "route"; inObs = false; continue; }
    if (cells[0] === "Device") { mode = "device"; inObs = false; continue; }
    if (/^observations$/i.test(cells[0])) { inObs = true; mode = ""; continue; }
    if (cells.length === 1) {
      if (/^(by day|referrers|countries|routes|devices|headline)$/i.test(cells[0])) { mode = ""; inObs = false; continue; }
      if (inObs) obs.push(cells[0]);
      continue;
    }
    if (!mode || toNum(cells[1]) == null) continue;
    const name = cells[0];
    if (mode === "day") daily.push({ day: name, visitors: toInt(cells[1]), pageviews: toInt(cells[2] || "0") });
    else if (mode === "source") sources.push({ name, visitors: toInt(cells[1]), pageviews: toInt(cells[2] || "0"), priorVisitors: intCount(cells[3] || "") });
    else if (mode === "country") countries.push({ name, visitors: toInt(cells[1]), pageviews: toInt(cells[2] || "0"), priorVisitors: intCount(cells[4] || "") });
    else if (mode === "route") routes.push({ name, visitors: toInt(cells[1]), pageviews: toInt(cells[2] || "0"), priorVisitors: intCount(cells[3] || "") });
    else if (mode === "device") devices.push({ name, visitors: toInt(cells[1]), pageviews: toInt(cells[2] || "0"), priorVisitors: intCount(cells[3] || ""), priorPageviews: intCount(cells[4] || "") });
  }

  if (!visitors && daily.length) visitors = daily.reduce((a, b) => a + b.visitors, 0);
  if (!pageviews && daily.length) pageviews = daily.reduce((a, b) => a + b.pageviews, 0);
  if (!weekStart) weekStart = new Date().toISOString().slice(0, 10);
  if (!weekEnd) weekEnd = weekStart;
  if (!label) label = weekStart;

  if (!daily.length && !sources.length && !routes.length && visitors === 0) {
    throw new Error("Could not read any metrics from this PDF. Check the report format, or use JSON import.");
  }

  return { weekStart, weekEnd, label, source, visitors, pageviews, visitorsPrev, pageviewsPrev, daily, sources, countries, routes, devices, observations: obs.join(" ").trim() || null };
}

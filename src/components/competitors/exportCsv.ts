import { type Competitor, type Platform, PLATFORM_LABELS } from "@/lib/competitors/types";
import { presenceShort } from "./platformMeta";

const COLS: Platform[] = [
  "twitter",
  "linkedin",
  "discord",
  "telegram",
  "github",
  "reddit",
  "youtube",
  "other",
];

function esc(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Wide comparison table: one row per competitor, a column per platform. */
export function competitorsToCsv(competitors: Competitor[]): string {
  const header = [
    "Name",
    "Segment",
    "TVL",
    "Token",
    "Community strength",
    ...COLS.map((p) => PLATFORM_LABELS[p]),
    "Website",
    "Remark",
  ];
  const rows = competitors.map((c) => {
    const cells: (string | number | null)[] = [
      c.name,
      c.segment,
      c.tvl,
      c.token,
      c.isSelf ? "" : c.communityStrength,
    ];
    for (const p of COLS) {
      const m = c.platforms.find((x) => x.platform === p);
      cells.push(!m ? "" : m.value != null ? m.value : presenceShort(m.presence));
    }
    cells.push(c.website, c.remark);
    return cells;
  });
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

/** Trigger a client-side CSV download. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Generic risk severity shared across risk tools (protocol monitor, peg monitor,
// …). Tools map their domain state onto this so colors/ordering stay consistent —
// without dictating any tool's layout.

export type Severity = "ok" | "info" | "warn" | "critical";

export const SEVERITY_COLOR: Record<Severity, string> = {
  ok: "#22c55e",
  info: "#5b9cf6",
  warn: "#f59e0b",
  critical: "#ef4444",
};

export const SEVERITY_RANK: Record<Severity, number> = { ok: 0, info: 1, warn: 2, critical: 3 };

export function worstSeverity(list: Severity[]): Severity {
  return list.reduce<Severity>((acc, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[acc] ? s : acc), "ok");
}

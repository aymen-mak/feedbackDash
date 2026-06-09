import { type Competitor } from "@/lib/competitors/types";
import { formatUsd, signedPct, ONCHAIN_SOURCE } from "./platformMeta";
import Sparkline from "./Sparkline";

// Compact on-chain strip for a competitor card: TVL + 24h change + sparkline,
// with fees/revenue underneath. Renders nothing for non-DefiLlama protocols.
export default function OnchainRow({ c }: { c: Competitor }) {
  const oc = c.onchain;
  const hasTvl = oc?.tvl != null;
  if (!c.defillamaSlug && !hasTvl) return null;

  const series = (oc?.tvlSeries ?? []).map((p) => p.v);
  const chg = oc?.tvlChange1d;

  return (
    <div className="mt-3 rounded-lg border border-makina-border bg-makina-surface/40 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-wider text-makina-muted">TVL</span>
          <span className="text-sm font-bold text-makina-text">{hasTvl ? formatUsd(oc!.tvl) : "—"}</span>
          {chg != null && (
            <span className={`text-[11px] font-medium ${chg >= 0 ? "text-makina-green" : "text-makina-red"}`}>
              {signedPct(chg)}
            </span>
          )}
          <span className="text-[9px] text-makina-subtle" title={ONCHAIN_SOURCE.detail}>
            · {ONCHAIN_SOURCE.short}
          </span>
        </div>
        {series.length >= 2 ? (
          <Sparkline data={series} width={72} height={20} />
        ) : (
          <span className="text-[10px] text-makina-subtle">{c.defillamaSlug ? "awaiting refresh" : ""}</span>
        )}
      </div>
      {(oc?.fees24h != null || oc?.revenue24h != null) && (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-makina-muted">
          {oc?.fees24h != null && (
            <span>
              Fees 24h <b className="font-semibold text-makina-text/80">{formatUsd(oc.fees24h)}</b>
            </span>
          )}
          {oc?.revenue24h != null && (
            <span>
              Rev 24h <b className="font-semibold text-makina-text/80">{formatUsd(oc.revenue24h)}</b>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

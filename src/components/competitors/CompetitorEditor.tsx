"use client";

import { useState } from "react";
import { X, Plus, Trash2, Save } from "lucide-react";
import {
  type Competitor,
  type PlatformMetric,
  type Platform,
  type Presence,
  PLATFORMS,
  PLATFORM_LABELS,
  PLATFORM_METRIC_UNIT,
  PLATFORM_AUTOKEY_HINT,
  PLATFORM_AUTO_SUPPORTED,
  makeMetric,
} from "@/lib/competitors/types";
import { PLATFORM_META } from "./platformMeta";

const PRESENCE_OPTS: Presence[] = ["active", "inactive", "none", "external", "private", "unknown"];
const PRESENCE_LABEL: Record<Presence, string> = {
  active: "Active",
  inactive: "Dormant",
  none: "None",
  external: "External",
  private: "Private / no public count",
  unknown: "Unknown",
};

const inputCls =
  "w-full rounded-md bg-makina-surface border border-makina-border px-2.5 py-1.5 text-sm text-makina-text placeholder:text-makina-subtle focus:outline-none focus:border-makina-accent/50 transition-colors";
const labelCls = "block text-[10px] font-medium uppercase tracking-wider text-makina-muted mb-1";

function defaultPlatforms(): PlatformMetric[] {
  return (["twitter", "linkedin", "discord", "telegram"] as Platform[]).map((p) =>
    makeMetric({ platform: p, presence: "unknown" })
  );
}

interface Props {
  initial?: Competitor;
  onClose: () => void;
  onSaved: (c: Competitor) => void;
}

export default function CompetitorEditor({ initial, onClose, onSaved }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [segment, setSegment] = useState(initial?.segment ?? "");
  const [tvl, setTvl] = useState(initial?.tvl ?? "");
  const [token, setToken] = useState(initial?.token ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [defillamaSlug, setDefillamaSlug] = useState(initial?.defillamaSlug ?? "");
  const [remark, setRemark] = useState(initial?.remark ?? "");
  const [platforms, setPlatforms] = useState<PlatformMetric[]>(
    initial ? initial.platforms.map((p) => ({ ...p })) : defaultPlatforms()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const originalById = new Map((initial?.platforms ?? []).map((p) => [p.platform, p]));

  const updatePlatform = (platform: Platform, patch: Partial<PlatformMetric>) =>
    setPlatforms((prev) => prev.map((p) => (p.platform === platform ? { ...p, ...patch } : p)));
  const removePlatform = (platform: Platform) =>
    setPlatforms((prev) => prev.filter((p) => p.platform !== platform));
  const addPlatform = (platform: Platform) =>
    setPlatforms((prev) => [...prev, makeMetric({ platform, presence: "unknown" })]);

  const remaining = PLATFORMS.filter((p) => !platforms.some((x) => x.platform === p));

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError("");

    // Editing a value flips it to "manual"; an untouched value keeps its source.
    const outPlatforms = platforms.map((p) => {
      const orig = originalById.get(p.platform);
      let source = p.source;
      if (orig && orig.value === p.value) source = orig.source;
      else if (p.value != null) source = "manual";
      return { ...p, source };
    });

    const payload = {
      name: name.trim(),
      segment,
      tvl: tvl.trim() || null,
      token: token.trim() || null,
      website: website.trim() || null,
      defillamaSlug: defillamaSlug.trim() || null,
      remark,
      platforms: outPlatforms,
    };

    try {
      const res = initial
        ? await fetch(`/api/competitors/${initial.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/competitors`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Save failed.");
        setSaving(false);
        return;
      }
      onSaved(await res.json());
    } catch {
      setError("Save failed — check your connection.");
      setSaving(false);
    }
  };

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
        <div className="flex items-center justify-between border-b border-makina-border px-5 py-3">
          <h2 className="text-sm font-bold text-makina-text">
            {initial ? `Edit ${initial.name}` : "Add competitor"}
          </h2>
          <button onClick={onClose} className="text-makina-muted hover:text-makina-text">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Profile */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Name *</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Competitor name" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Segment</label>
              <input className={inputCls} value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="e.g. Bitcoin LST, RWA, Vault infra" />
            </div>
            <div>
              <label className={labelCls}>TVL</label>
              <input className={inputCls} value={tvl} onChange={(e) => setTvl(e.target.value)} placeholder="$700M+" />
            </div>
            <div>
              <label className={labelCls}>Token</label>
              <input className={inputCls} value={token} onChange={(e) => setToken(e.target.value)} placeholder="$BARD" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Website</label>
              <input className={inputCls} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>
                DefiLlama slug <span className="lowercase text-makina-subtle">— enables TVL / fees / revenue (e.g. lombard)</span>
              </label>
              <input
                className={inputCls}
                value={defillamaSlug}
                onChange={(e) => setDefillamaSlug(e.target.value)}
                placeholder="slug from api.llama.fi/protocol/<slug>"
              />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Analyst remark</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={4}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Overall read on their community…"
              />
            </div>
          </div>

          {/* Platforms */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-makina-text">Platforms</span>
              {remaining.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-makina-muted">Add:</span>
                  {remaining.map((p) => (
                    <button
                      key={p}
                      onClick={() => addPlatform(p)}
                      className="inline-flex items-center gap-1 rounded-md border border-makina-border bg-makina-surface px-1.5 py-0.5 text-[10px] text-makina-muted hover:border-makina-accent/40 hover:text-makina-text"
                    >
                      <Plus size={9} />
                      {PLATFORM_META[p].short}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {platforms.map((p) => (
                <div key={p.platform} className="rounded-lg border border-makina-border bg-makina-surface/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLATFORM_META[p.platform].color }} />
                      <span className="text-xs font-semibold text-makina-text">{PLATFORM_LABELS[p.platform]}</span>
                      {PLATFORM_AUTO_SUPPORTED[p.platform] ? (
                        <span className="rounded bg-makina-green/10 px-1 py-0.5 text-[9px] font-medium text-makina-green">auto-capable</span>
                      ) : (
                        <span className="rounded bg-makina-surface px-1 py-0.5 text-[9px] text-makina-subtle">manual only</span>
                      )}
                    </div>
                    <button onClick={() => removePlatform(p.platform)} className="text-makina-subtle hover:text-makina-red" title="Remove platform">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>{PLATFORM_METRIC_UNIT[p.platform]}</label>
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        value={p.value ?? ""}
                        onChange={(e) =>
                          updatePlatform(p.platform, {
                            value: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))),
                          })
                        }
                        placeholder="N/A"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Presence</label>
                      <select
                        className={inputCls}
                        value={p.presence}
                        onChange={(e) => updatePlatform(p.platform, { presence: e.target.value as Presence })}
                      >
                        {PRESENCE_OPTS.map((opt) => (
                          <option key={opt} value={opt}>
                            {PRESENCE_LABEL[opt]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Handle</label>
                      <input className={inputCls} value={p.handle ?? ""} onChange={(e) => updatePlatform(p.platform, { handle: e.target.value || null })} placeholder="@handle / page / channel" />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>URL</label>
                      <input className={inputCls} value={p.url ?? ""} onChange={(e) => updatePlatform(p.platform, { url: e.target.value || null })} placeholder="https://…" />
                    </div>
                    {PLATFORM_AUTO_SUPPORTED[p.platform] && (
                      <div className="col-span-2">
                        <label className={labelCls}>
                          Auto key <span className="lowercase text-makina-subtle">— {PLATFORM_AUTOKEY_HINT[p.platform]}</span>
                        </label>
                        <input className={inputCls} value={p.autoKey ?? ""} onChange={(e) => updatePlatform(p.platform, { autoKey: e.target.value.trim() || null })} placeholder="leave blank for manual" />
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className={labelCls}>Note</label>
                      <input className={inputCls} value={p.note ?? ""} onChange={(e) => updatePlatform(p.platform, { note: e.target.value || null })} placeholder="Optional context" />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>
                        Tag <span className="lowercase text-makina-subtle">— e.g. announcement, airdrop, inflated?</span>
                      </label>
                      <input className={inputCls} value={p.tag ?? ""} onChange={(e) => updatePlatform(p.platform, { tag: e.target.value || null })} placeholder="optional label shown on the metric" />
                    </div>
                    <label className="col-span-2 flex cursor-pointer items-center gap-2 text-[11px] text-makina-muted">
                      <input
                        type="checkbox"
                        checked={!!p.reachExcluded}
                        onChange={(e) => updatePlatform(p.platform, { reachExcluded: e.target.checked })}
                        className="accent-makina-accent"
                      />
                      Exclude from Community reach (announcement / bot-inflated)
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-makina-red/20 bg-makina-red/10 px-3 py-2 text-sm text-makina-red">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-makina-border px-5 py-3">
          <button onClick={onClose} className="rounded-md border border-makina-border bg-makina-surface px-3 py-1.5 text-sm text-makina-muted hover:text-makina-text">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md gradient-accent px-4 py-1.5 text-sm font-semibold text-makina-bg transition-all hover:brightness-110 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving…" : initial ? "Save changes" : "Add competitor"}
          </button>
        </div>
      </div>
    </div>
  );
}

# Competitor Community Tracker — Build Plan & Progress

> **Purpose:** Real-time-ish dashboard to track the *community* footprint of Makina's
> competitors (Twitter/X, LinkedIn, Discord, Telegram, Reddit, GitHub, etc.), with
> historical trend lines, qualitative remarks, and a community-strength ranking.
>
> This doc is the **single source of truth for resuming work across sessions.**
> If a session ends mid-build, the next session should read this file first, find the
> phase marked 🔵 IN PROGRESS (or the first ⬜ TODO), and continue. Every phase is
> committed + pushed so nothing is lost.

Branch: `claude/focused-heisenberg-gN9fW`

---

## Product decisions (locked by user)

1. **Add alongside** the existing Makina Pulse feedback app — same Next.js app,
   reuse theme/auth/Vercel infra, but a brand-new data model + routes under
   `/competitors` and `/api/competitors/*`. Do **not** disturb feedback features.
2. **Auto-where-free + manual rest.** Auto-collect what's freely available on a
   schedule; manual entry/override for the rest. Store periodic **snapshots** so the
   dashboard shows real trend lines over time. No paid API keys required.

### What can be auto-collected for free (and what can't)

| Platform | Auto? | Method | Needs |
|----------|-------|--------|-------|
| Telegram | ✅ | Scrape public channel page `t.me/<channel>` for "N subscribers" | channel username |
| Discord  | ✅ | `GET discord.com/api/v10/invites/<code>?with_counts=true` → `approximate_member_count` | invite code |
| Reddit   | ✅ | `GET reddit.com/r/<sub>/about.json` → `data.subscribers` (custom UA) | subreddit |
| GitHub   | ✅ | `GET api.github.com/users/<org>` → `followers` (also stars via repos) | org slug |
| Twitter/X| ⚠️ | No free follower API; best-effort, usually **manual** | handle (manual value) |
| LinkedIn | ❌ | No public API, auth-walled → **manual** | url (manual value) |
| YouTube  | ❌ | Needs API key → **manual** | url (manual value) |

Collectors fail gracefully: on error the previous value is kept and `lastError` is set.
Auto only runs for a platform when its `autoKey` is filled in; otherwise it stays manual.

---

## Competitors tracked (seed data from Aymen's analysis, 2026-05-31)

Veda (baseline), Mellow, Lagoon, Midas, Upshift, Superform, Flux Finance, Lombard.
Plus **Makina** itself as the `isSelf` reference row. Values encoded verbatim from the
analysis; unknown = `null` (renders as "N/A"). Full seed lives in
`src/lib/competitors/seed.ts`.

---

## Architecture

Dual-mode persistence (mirrors the feedback app): **Postgres when `POSTGRES_URL`/`DATABASE_URL`
is set, file/in-memory fallback otherwise.** Seed auto-loads when empty.

```
src/lib/competitors/
  types.ts        # Competitor, PlatformMetric, Snapshot, Platform, enums
  seed.ts         # initial competitors from the analysis
  store.ts        # file (data/competitors.json) + in-memory fallback CRUD
  db.ts           # Postgres backend (competitors JSONB + snapshots table)
  collectors.ts   # telegram/discord/reddit/github/twitter fetchers (free, best-effort)
  service.ts      # backend-agnostic facade: list/get/create/update/delete,
                  # refresh() orchestration, snapshot-on-change logic

src/app/api/competitors/
  route.ts            # GET list, POST create
  [id]/route.ts       # GET one, PATCH update, DELETE
  refresh/route.ts    # POST (button) + GET (cron) → run collectors, write snapshots
  history/route.ts    # GET ?id=&platform= → snapshot series for charts

src/app/competitors/page.tsx     # the dashboard (PasswordGate + Navbar)

src/components/competitors/
  CompetitorComparisonChart.tsx  # followers across competitors (recharts)
  CompetitorCard.tsx             # per-competitor summary card
  PlatformBadge.tsx              # platform pill w/ value, source dot, trend arrow
  CompetitorDetail.tsx           # modal: full remark + per-platform edit + history
  CompetitorEditor.tsx           # add/edit competitor form
  HistoryChart.tsx               # per-platform snapshot line chart

vercel.json                      # cron → /api/competitors/refresh (daily; bump on Pro)
docs/competitor-dashboard/README.md  # setup / deploy / usage
```

Design tokens reused: `makina-*` colors, `hover-lift`, `gradient-accent/text`,
`animate-fade-in-up`, recharts CSS-var color hook. Internal page → wrapped in
`<PasswordGate>` like /review and /team. No new npm dependencies.

---

## Build phases (commit + push after each)

- [x] **Phase 0 — Plan & scaffolding.** This PLAN.md. _(committed)_
- [x] **Phase 1 — Data layer.** types, seed, file store, pg backend, service facade (no collectors yet). _(committed)_
- [x] **Phase 2 — Collectors + refresh.** telegram/discord/reddit/github/twitter + `refreshAll()` in service. Verified `autoKey`s folded into seed. _(committed)_
- [x] **Phase 3 — API routes.** list/create, get/patch/delete, refresh, history. Smoke-tested: list=9, history OK, refresh runs gracefully (1 live GitHub fetch succeeded in-sandbox, rest 403 as expected). _(committed)_
- [x] **Phase 4 — Dashboard UI.** /competitors page (PasswordGate+Navbar), summary tiles, comparison chart, ranked cards, platform badges, navbar link. tsc clean, route serves 200. _(committed)_
- [x] **Phase 5 — Detail + editing.** detail modal w/ per-platform history chart, manual-override editor (profile + every platform field + enable-auto), add + delete. CRUD verified live (create/patch/history/delete). _(committed)_
- [x] **Phase 6 — Scheduling + docs + verify.** vercel.json daily cron, operator README, parallelized `refreshAll`, clean `npm run build`, prod server serves `/competitors` + API (200, 9 competitors). _(committed)_

Status legend: ⬜ TODO · 🔵 IN PROGRESS · ✅ DONE

| Phase | Status |
|-------|--------|
| 0 Plan | ✅ DONE |
| 1 Data layer | ✅ DONE |
| 2 Collectors | ✅ DONE |
| 3 API | ✅ DONE |
| 4 Dashboard UI | ✅ DONE |
| 5 Detail + editing | ✅ DONE |
| 6 Schedule + docs + verify | ✅ DONE |

---

## Resume pointer

**v1 status: ✅ COMPLETE & pushed** (PR #8). Build clean, API/CRUD verified.

---

## v2 — On-chain data + monitoring UX (in progress)

User asks: more refined + more useful data; differentiate the look-alike "dashes"
(N/A states); tailor toward **active-monitoring UI/UX**; pull on-chain data
(TVL/fees/revenue/mcap) from **DefiLlama** (free); make social numbers **accurate**
via free scraping.

**Hard environment finding (confirmed 3 ways):** this build sandbox firewalls
*every* external host except github.com — `api.llama.fi`, discord, t.me, x.com,
linkedin all return 403 ("host not in allowlist"); the research agents' WebFetch
is also blocked (Cloudflare 403 on everything incl. example.com); and the headless
chromium binary download is blocked. So **no accurate live social/on-chain number
can be fetched from here by any means.** Accuracy is delivered **at runtime on the
deploy** (Vercel egress) via the collectors + cron. Do NOT bake unverified
WebSearch-snippet numbers into the seed — keep analyst figures (dated, source=manual)
and let the deploy's refresh replace them with live auto values.

Verified-from-research (reliable identifiers, not counts): DefiLlama slugs `veda`,
`mellow-protocol`, `lagoon`, `midas-rwa`, `upshift`, `superform`, `flux-finance`,
`lombard`.

- [x] **Phase 7 — On-chain backend.** `OnchainMetrics` type; `fetchDefillama` (TVL +
  %1d/%7d from history + mcap + fees + revenue + 30d TVL sparkline series);
  best-effort X + LinkedIn scrapers via reader proxy; `refreshAll` returns
  `{results, onchain}` and maintains `onchain.tvlSeries`; seed slugs + auto-keys;
  routes thread `defillamaSlug`. tsc clean. _(committing)_
- [x] **Phase 8 — Monitoring UI.** On-chain display (TVL + Δ colored, fees, revenue,
  mcap, TVL sparkline) on cards + detail; comparison chart now covers TVL/fees/mcap +
  socials; **differentiated state badges** (none / dormant / external / syncing / N/A /
  error — distinct glyphs+colors); per-row **freshness/health** chip; **sortable
  monitoring table** (default view) + cards toggle; **live auto-refresh** toggle;
  Total-TVL tile. Build clean; runtime verified (graceful, no errors). _(committing)_

| Phase | Status |
|-------|--------|
| 7 On-chain backend | ✅ DONE |
| 8 Monitoring UI | ✅ DONE |

**v2 status: ✅ COMPLETE.** Build clean, refresh handles socials + DefiLlama
(34 collectors) gracefully. Numbers populate from a deploy with egress (cron /
Refresh). DAU is intentionally omitted — DefiLlama has no free DAU endpoint;
documented in README.

**Resume note:** if extending, the comparison chart + table read on-chain from
`competitor.onchain` (filled by `fetchDefillama` in `refreshAll`); social X/LinkedIn
use best-effort reader-proxy scrapers (may need a paid source if the proxy is
unreliable in prod).

Recharts + TS note: Tooltip/LabelList `formatter` params are loosely typed
(`RenderableText`). Don't over-annotate — narrow with `typeof v === "number"`.

**Env caveat (important):** this build sandbox returns HTTP 403 for x.com,
discord.com, t.me and linkedin to automated fetches, so live auto-collection
cannot be exercised here — it relies on real outbound egress (Vercel). GitHub's
API is the most reliable. Verified `autoKey`s wired: Discord (Midas, Mellow,
Superform, Lombard), Telegram (Mellow, Midas), GitHub (Veda, Mellow, Lagoon,
Superform, Flux, Lombard). Upshift Discord left manual (invite unverified).

_(Update this section + the table at the end of every phase before committing.)_

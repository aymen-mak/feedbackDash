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
- [ ] **Phase 1 — Data layer.** types, seed, file store, pg backend, service facade (no collectors yet).
- [ ] **Phase 2 — Collectors + refresh.** telegram/discord/reddit/github/twitter + snapshot-on-change in service.
- [ ] **Phase 3 — API routes.** list/create, get/patch/delete, refresh, history.
- [ ] **Phase 4 — Dashboard UI.** /competitors page, cards, platform badges, comparison chart, navbar link.
- [ ] **Phase 5 — Detail + editing.** detail modal, manual override editor, per-platform history chart, add-competitor.
- [ ] **Phase 6 — Scheduling + docs + verify.** vercel.json cron, README, `npm run build` clean, dev smoke test.

Status legend: ⬜ TODO · 🔵 IN PROGRESS · ✅ DONE

| Phase | Status |
|-------|--------|
| 0 Plan | ✅ DONE |
| 1 Data layer | ⬜ TODO |
| 2 Collectors | ⬜ TODO |
| 3 API | ⬜ TODO |
| 4 Dashboard UI | ⬜ TODO |
| 5 Detail + editing | ⬜ TODO |
| 6 Schedule + docs + verify | ⬜ TODO |

---

## Resume pointer

**Next action:** Start Phase 1 — create `src/lib/competitors/{types,seed,store,db,service}.ts`.

_(Update this section + the table at the end of every phase before committing.)_

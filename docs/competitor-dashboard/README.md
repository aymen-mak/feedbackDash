# Competitor Community Tracker

A real-time-ish dashboard for tracking the **community footprint** of Makina's
competitors across X/Twitter, LinkedIn, Discord, Telegram, Reddit and GitHub —
with historical trend lines, qualitative analyst remarks, and a community-strength
ranking. It lives alongside the Makina Pulse feedback app in the same Next.js
project.

- **Dashboard:** [`/competitors`](/competitors) (behind the team password gate)
- **Navbar:** "Competitors"

> Build notes / phase history: [`PLAN.md`](./PLAN.md).

---

## What it does

- Tracks each competitor's per-platform follower/member counts, the **source**
  of each number (🟢 auto-collected vs. 🔵 manual), and a **trend** vs. the
  previous snapshot.
- **Auto-collects** what's freely available on a schedule; everything else is
  **manual entry/override**. Every refresh writes a snapshot, so charts build a
  real time series over time.
- Per-competitor **detail modal** with a history line chart and a full editor.
- A **reach-comparison** bar chart across competitors, per platform.
- Seeded from Aymen's manual community analysis (2026-05-31); `N/A` where a
  value was unknown/unverifiable.

### Auto vs. manual, by platform

| Platform | Auto | How | What to paste to enable (the "Auto key") |
|----------|:----:|-----|------------------------------------------|
| Telegram | ✅ | scrapes the public `t.me/<channel>` page | channel username (no `@`) |
| Discord  | ✅ | invite endpoint `with_counts` | invite code (the part after `discord.gg/`) |
| Reddit   | ✅ | `r/<sub>/about.json` | subreddit (no `r/`) |
| GitHub   | ✅ | public users API → follower count | org/user slug |
| X / Twitter | ⚠️ manual | no free follower API | (handle is for display; enter the count manually) |
| LinkedIn | ❌ manual | auth-walled | — |
| YouTube  | ❌ manual | needs an API key | — |

Enabling auto for a platform = open a competitor → **Edit** → set its **Auto key**
→ Save. The next refresh will populate it. Auto failures are non-fatal: the
previous value is kept and a ⚠ error is shown on the badge.

Verified auto keys pre-wired in the seed: Discord (Midas, Mellow, Superform,
Lombard), Telegram (Mellow, Midas), GitHub (Veda, Mellow, Lagoon, Superform,
Flux, Lombard).

---

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
```

Open `/competitors` and enter the team password (default `makina2026!)`, or set
`GATE_PASSWORD`). With no database configured it runs on a JSON file store
(`data/competitors.json`) seeded automatically on first load.

---

## Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `POSTGRES_URL` / `DATABASE_URL` | Durable storage (Vercel Postgres / Neon). **Required for persistence in production** — without it, serverless writes are ephemeral. | file/in-memory |
| `GATE_PASSWORD` | Team password for the gate | `makina2026!)` |
| `AUTH_SECRET` | HMAC secret for the gate token | dev default |
| `CRON_SECRET` | If set, the cron `GET /api/competitors/refresh` requires `Authorization: Bearer <CRON_SECRET>`. Vercel sends this automatically. | _(unset = open)_ |

---

## Scheduling (the "real-time" engine)

[`vercel.json`](../../vercel.json) registers a daily cron that calls
`GET /api/competitors/refresh`:

```json
{ "crons": [ { "path": "/api/competitors/refresh", "schedule": "0 6 * * *" } ] }
```

- **Daily** is the Vercel Hobby limit. On **Pro** you can go more frequent, e.g.
  hourly: `"0 * * * *"`.
- You can always hit **"Refresh now"** in the UI (`POST /api/competitors/refresh`).
- Set `CRON_SECRET` in project env to lock down the cron endpoint.

---

## Deploy to Vercel (turnkey)

1. Import the repo into Vercel (or `vercel` CLI). It's a standard Next.js app.
2. **Add a Postgres database** (Vercel Postgres or Neon from the Marketplace) and
   attach it — this sets `POSTGRES_URL` automatically. Skipping this means data
   won't persist across deploys/cold starts.
3. Set `GATE_PASSWORD`, `AUTH_SECRET`, and (optional) `CRON_SECRET`.
4. Deploy. The cron in `vercel.json` is picked up automatically (production).
5. First load seeds the competitor set; "Refresh now" / the cron fills auto
   values and starts the time series.

> **Network note:** auto-collection needs outbound HTTPS to x/t.me/discord/api.github.
> Vercel has this. (The build sandbox used to develop this returns HTTP 403 to
> those hosts, so live auto-collection can't be exercised there — only GitHub's
> API responded. This is environmental, not a code issue.)

---

## API

| Method & path | Purpose |
|---------------|---------|
| `GET /api/competitors` | list all competitors (with latest metrics) |
| `POST /api/competitors` | create a competitor |
| `GET /api/competitors/[id]` | one competitor |
| `PATCH /api/competitors/[id]` | update profile/metrics (manual override) |
| `DELETE /api/competitors/[id]` | remove a competitor |
| `GET /api/competitors/history?id=&platform=` | snapshot time series |
| `POST /api/competitors/refresh` | run auto-collectors now |
| `GET /api/competitors/refresh` | cron entrypoint (CRON_SECRET-guarded) |

---

## Data model (`src/lib/competitors/`)

- **`Competitor`** — `id`, `name`, `isSelf`, `segment`, `tvl`, `token`, `website`,
  `remark`, `communityStrength` (0–100), `platforms[]`, timestamps.
- **`PlatformMetric`** — `platform`, `handle`, `url`, `autoKey`, `value`,
  `presence` (active/inactive/none/external/unknown), `source` (auto/manual),
  `note`, `lastUpdated`, `lastError`.
- **`Snapshot`** — `competitorId`, `platform`, `value`, `source`, `capturedAt`
  (one per value change / successful auto-fetch).

Backends: `store.ts` (file/in-memory) and `db.ts` (Postgres — competitor doc as
JSONB + a `competitor_snapshots` table), chosen at runtime by `service.ts`.
Collectors live in `collectors.ts`.

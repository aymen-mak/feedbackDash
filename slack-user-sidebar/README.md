# Slack User Sidebar

A Discord-style online/offline user list sidebar for Slack workspaces.

## Setup

### 1. Create the Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From an app manifest**
2. Paste the contents of `slack-manifest.json`
3. Install the app to your workspace

### 2. Get your credentials

From your app's settings page:
- **Bot Token** (`xoxb-…`): OAuth & Permissions → Bot User OAuth Token
- **Signing Secret**: Basic Information → App Credentials

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET
```

### 4. Install dependencies and run

```bash
npm install
npm start        # production
npm run dev      # auto-restart on file changes (requires Node 18+)
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

## How it works

| Endpoint | Description |
|---|---|
| `GET /api/users` | Returns all workspace members with presence (`active` / `away`) |
| `GET /api/presence/:userId` | Returns presence for a single user |
| `GET /` | Serves the sidebar UI |

The sidebar auto-refreshes presence every **60 seconds**. Click the refresh icon to force an immediate update.

## Required OAuth scopes

| Scope | Reason |
|---|---|
| `users:read` | List workspace members and their profiles |

> **Note:** Slack's `users.getPresence` API is rate-limited. For large workspaces (500+ members) consider caching presence results server-side and using the [Events API](https://api.slack.com/apis/presence-and-status) to receive push updates instead of polling.

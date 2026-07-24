# Ticket Archival Bot

A Discord bot that replaces the tedious manual ticket-archiving flow (delete →
find transcript channel → open in browser → download → rename → upload to Drive)
with a **single command**.

Run `/archive` inside a ticket channel and the bot will:

1. Copy the **entire** ticket into a self-contained HTML transcript (messages,
   embeds, and attachments as links).
2. Auto-detect **who opened the ticket** and name the file after them
   (e.g. `jane_doe - 2026-07-24.html`).
3. Save it locally to a folder you choose.
4. Optionally **upload it straight to Google Drive**.
5. Optionally **delete the ticket channel** afterwards.

No MEE6 transcript channel, no browser, no manual renaming.

---

## Command

```
/archive [opener] [upload] [close]
```

| Option    | Type    | Default          | What it does                                                        |
| --------- | ------- | ---------------- | ------------------------------------------------------------------- |
| `opener`  | user    | auto-detected    | Override who the file is named after.                               |
| `upload`  | boolean | `DRIVE_UPLOAD_DEFAULT` | Also upload the transcript to Google Drive.                  |
| `close`   | boolean | `false`          | Delete the ticket channel after a successful archive.               |

Only members with **Manage Channels** can see/use the command by default.

### How the opener is detected

The bot tries, in order: a member-level "View Channel" permission overwrite on
the channel (how ticket bots grant the opener access) → a user ID/mention in the
channel topic → the first human to post → the first user the opening bot
message mentions. If none work, it falls back to the channel name. Use the
`opener` option to override.

---

## Setup

### 1. Create the Discord application & bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** tab → **Reset Token** → copy it → this is `DISCORD_TOKEN`.
3. On the same **Bot** tab, enable **Message Content Intent** (required to read
   ticket history). `Server Members Intent` is not required.
4. **General Information** tab → copy the **Application ID** → this is `DISCORD_CLIENT_ID`.
5. **OAuth2 → URL Generator**: scopes `bot` + `applications.commands`; bot
   permissions **View Channels**, **Read Message History**, **Send Messages**,
   **Attach Files**, and **Manage Channels** (only needed for `close:true`).
   Open the generated URL to invite the bot to your server.

### 2. Configure

```bash
cd discord-bot
cp .env.example .env
# edit .env and fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID
npm install
```

Set `DISCORD_GUILD_ID` to your server ID so the command registers instantly
(right-click the server icon → **Copy Server ID**, with Developer Mode on).

### 3. Register the slash command and start

```bash
npm run deploy   # registers /archive (run again whenever the command changes)
npm start        # starts the bot
```

That's it — go into a ticket channel and run `/archive`.

---

## Google Drive upload (optional)

Files land in the folder set by `GOOGLE_DRIVE_FOLDER_ID` (from the folder's URL).
Pick **one** of these auth methods.

### Option A — Service account + Shared Drive (recommended)

Service accounts have no personal Drive storage, so uploads must target a
**Shared Drive** (or a folder inside one).

1. In [Google Cloud Console](https://console.cloud.google.com/): create/select a
   project → **APIs & Services** → enable the **Google Drive API**.
2. **Credentials** → **Create credentials** → **Service account** → create a
   **JSON key** and download it.
3. Create a **Shared Drive** in Google Drive, then share it (or a folder in it)
   with the service account's email (`...@...iam.gserviceaccount.com`) as
   **Content manager**.
4. In `.env`, set `GOOGLE_DRIVE_FOLDER_ID` to that folder and either paste the
   key JSON into `GOOGLE_SERVICE_ACCOUNT_JSON` (single line) or save it as
   `google-credentials.json` and set
   `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./google-credentials.json`.

### Option B — OAuth2 (upload into your own "My Drive")

Use this to upload into a normal folder in your personal/workspace Drive.

1. Enable the **Google Drive API** (as above).
2. **Credentials** → **Create credentials** → **OAuth client ID** → *Desktop app*.
3. Get a **refresh token** for the scope
   `https://www.googleapis.com/auth/drive.file` (e.g. via the
   [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/):
   set your own client ID/secret in its settings, authorize that scope, exchange
   for tokens).
4. In `.env`, set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
   `GOOGLE_OAUTH_REFRESH_TOKEN`, and `GOOGLE_DRIVE_FOLDER_ID`.

Set `DRIVE_UPLOAD_DEFAULT=true` to always upload without passing `upload:true`.

---

## Keeping it running

`npm start` runs in the foreground. For always-on hosting use a process manager
such as [pm2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start src/index.js --name ticket-bot
pm2 save
```

## Notes & limits

- Discord caps bot file attachments at ~10 MB (higher with server boosts). If a
  transcript exceeds the limit it's still saved locally and uploaded to Drive —
  only the in-chat attachment is skipped.
- Transcripts reference images via Discord's CDN by default (keeps files small).
  Set `saveImages: true` in `src/lib/transcript.js` to embed them instead.
- `LOG_CHANNEL_ID` mirrors every archive (with the file) to an audit channel.

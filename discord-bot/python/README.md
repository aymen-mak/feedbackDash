# Ticket Archival Bot — Python (Pterodactyl)

Python / `discord.py` version of the bot, packaged for a Pterodactyl panel.
It will:

1. Copy the **entire** ticket into an HTML transcript.
2. Auto-detect **who opened the ticket** and name the file after them
   (`jane doe - 2026-07-24.html`).
3. **Send it to you as a Discord attachment** — click to download it to your PC.
4. Optionally **upload to Google Drive**.
5. Optionally **delete the ticket channel**.

### Where does the file go?

The bot runs on a remote server, so it can't write directly to your PC. Instead
it hands you the transcript **in Discord** — download the attachment and it's on
your PC. By default nothing is written to the Pterodactyl disk (`SAVE_LOCAL=false`),
so limited disk isn't a problem. Set `SAVE_LOCAL=true` if you also want a
server-side copy in `TRANSCRIPT_DIR`. For a permanent hands-off archive, turn on
Google Drive upload. Setting `LOG_CHANNEL_ID` also drops every transcript into
one channel, making it a convenient place to grab them all.

## Two ways to trigger it

### Buttons (like MEE6's ticket panel)

An **Archive** panel with three buttons is posted automatically into new ticket
channels (any channel whose name starts with `TICKET_NAME_PREFIX`, default
`ticket`). You can also post one manually with `/panel` or by typing `!panel`.

- 📥 **Archive** — save an HTML transcript named after the opener
- ☁️ **Archive + Drive** — also upload it to Google Drive
- 🗑️ **Archive & Delete** — archive, then delete this channel

Buttons are persistent — they keep working after the bot restarts.

### Slash command

```
/archive [opener] [upload] [close]
```

| Option   | Type    | Default                | Effect                                    |
| -------- | ------- | ---------------------- | ----------------------------------------- |
| `opener` | user    | auto-detected          | Override who the file is named after.     |
| `upload` | boolean | `DRIVE_UPLOAD_DEFAULT` | Also upload the transcript to Drive.      |
| `close`  | boolean | `false`                | Delete the ticket channel after archiving.|

Only members with **Manage Channels** can use the buttons or command.

## Files

- `MakinaTVL.py` — the whole bot in one file.
- `requirements.txt` — dependencies (Pterodactyl installs these on start).
- `.env.example` — the environment variables to set (in the panel's Variables tab).

## Deploy on Pterodactyl

1. **Discord app setup** (once):
   - [Developer Portal](https://discord.com/developers/applications) → your app →
     **Bot** → copy the token (`DISCORD_TOKEN`) and enable **Message Content
     Intent** (required to read ticket history).
   - **OAuth2 → URL Generator**: scopes `bot` + `applications.commands`;
     permissions **View Channels**, **Read Message History**, **Send Messages**,
     **Attach Files**, and **Manage Channels** (for `close`). Invite the bot.

2. **Create the server** using a **Python egg** (the generic
   "Python Generic" / "discord.py" egg works).

3. **Upload files**: put `MakinaTVL.py` and `requirements.txt` in the server's
   root (drag them into the panel's File Manager, or point it at this repo).

4. **BOT PY FILE** field: set it to `MakinaTVL.py` (the startup runs this file).
   Most Python eggs auto-run `pip install -r requirements.txt` on boot, so no
   extra startup command is needed.

5. **Variables**: in the panel's **Startup** tab, add the variables from
   `.env.example` (at minimum `DISCORD_TOKEN` and `DISCORD_GUILD_ID`).

6. **Start** the server. On boot it registers `/archive` and logs in. Go into a
   ticket channel and run `/archive`.

> Transcripts are saved under `TRANSCRIPT_DIR` **inside the Pterodactyl
> container** — download them from the panel's File Manager, or use the Google
> Drive upload so they land somewhere permanent automatically.

## Google Drive (optional)

Set `GOOGLE_DRIVE_FOLDER_ID` (from the folder URL) and pick one auth method:

- **Service account (recommended with a Shared Drive):** enable the Drive API in
  Google Cloud, create a service account + JSON key, create a **Shared Drive**,
  and share the target folder with the service account email as **Content
  manager**. Paste the key into `GOOGLE_SERVICE_ACCOUNT_JSON` (single line), or
  upload it and set `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./google-credentials.json`.
  (Service accounts have no personal Drive storage, so a Shared Drive is needed.)

- **OAuth2 (upload into your own My Drive):** create an OAuth client (Desktop
  app), obtain a refresh token for scope
  `https://www.googleapis.com/auth/drive.file` (e.g. via the
  [OAuth Playground](https://developers.google.com/oauthplayground/)), then set
  `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  `GOOGLE_OAUTH_REFRESH_TOKEN`.

Set `DRIVE_UPLOAD_DEFAULT=true` to always upload without passing `upload:true`.

## Notes

- Discord caps bot attachments at ~10 MB (more with boosts). Over that, the file
  is still saved locally / uploaded to Drive — only the in-chat attachment is
  skipped.
- How the opener is detected: member "View Channel" permission overwrite →
  user id in the channel topic → first human to post → first user mentioned by
  the opening message. Falls back to the channel name; override with `opener`.

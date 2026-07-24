"""
Ticket Archival Bot (Python / discord.py) — Pterodactyl-ready.

Run /archive inside a ticket channel to:
  1. Copy the entire ticket into a self-contained HTML transcript.
  2. Auto-detect who opened the ticket and name the file after them.
  3. Save it locally (TRANSCRIPT_DIR).
  4. Optionally upload it to Google Drive.
  5. Optionally delete the ticket channel afterwards.

Everything is configured with environment variables — set them in the
Pterodactyl panel (Startup / Variables tab). See .env.example / README.md.
"""

import asyncio
import io
import os
import re
import datetime
from pathlib import Path
from typing import Optional

# Load a local .env file if present (how the Pterodactyl "Generic Python" egg
# gets the token — it has no Discord-token variable field). Optional: real
# environment variables set in the panel work too.
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

import discord
from discord import app_commands
import chat_exporter


# ─── Configuration (from environment variables) ────────────────────────
def _get_bool(value: Optional[str], default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


DISCORD_TOKEN = os.environ.get("DISCORD_TOKEN")
GUILD_ID = os.environ.get("DISCORD_GUILD_ID") or None

TRANSCRIPT_DIR = os.environ.get("TRANSCRIPT_DIR", "./transcripts")
LOG_CHANNEL_ID = os.environ.get("LOG_CHANNEL_ID") or None

GOOGLE_DRIVE_FOLDER_ID = os.environ.get("GOOGLE_DRIVE_FOLDER_ID") or None
DRIVE_UPLOAD_DEFAULT = _get_bool(os.environ.get("DRIVE_UPLOAD_DEFAULT"), False)

# Option A: service account (recommended with a Shared Drive)
GOOGLE_SERVICE_ACCOUNT_JSON = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON") or None
GOOGLE_SERVICE_ACCOUNT_KEY_FILE = os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY_FILE") or None
# Option B: OAuth2 (upload into a normal "My Drive" folder you own)
GOOGLE_OAUTH_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID") or None
GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET") or None
GOOGLE_OAUTH_REFRESH_TOKEN = os.environ.get("GOOGLE_OAUTH_REFRESH_TOKEN") or None

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]

ARCHIVABLE_CHANNEL_TYPES = (
    discord.ChannelType.text,
    discord.ChannelType.news,
    discord.ChannelType.public_thread,
    discord.ChannelType.private_thread,
)

SNOWFLAKE_RE = re.compile(r"(\d{17,20})")
ILLEGAL_FS_CHARS_RE = re.compile(r'[/\\:*?"<>|]')
CONTROL_CHARS_RE = re.compile(r"[\x00-\x1f\x7f]")


# ─── Filename helpers ──────────────────────────────────────────────────
def sanitize_name(name: str) -> str:
    """Make a label safe as a filename on any OS while keeping accents/emoji-free names."""
    cleaned = ILLEGAL_FS_CHARS_RE.sub("", str(name))
    cleaned = CONTROL_CHARS_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = cleaned.strip(".").strip()
    cleaned = cleaned[:100].strip()
    return cleaned or "ticket"


def unique_path(directory: str, base_name: str, ext: str = ".html") -> Path:
    """Return a path that doesn't clash with an existing file, adding ' (2)', ' (3)'..."""
    folder = Path(directory)
    candidate = folder / f"{base_name}{ext}"
    i = 2
    while candidate.exists():
        candidate = folder / f"{base_name} ({i}){ext}"
        i += 1
    return candidate


# ─── Ticket opener detection ───────────────────────────────────────────
async def resolve_ticket_opener(channel: discord.abc.GuildChannel):
    """
    Best-effort detection of who opened a ticket. Returns a discord.Member/User
    or None. Tries: member permission overwrite -> user id in topic ->
    first human author -> first user mentioned by the opening message.
    """
    guild = channel.guild
    if guild is None:
        return None

    # 1) Member-level "View Channel" overwrite (how ticket bots grant access).
    try:
        for target, overwrite in channel.overwrites.items():
            if not isinstance(target, discord.Member):
                continue
            if target.bot:
                continue
            allow, _deny = overwrite.pair()
            if allow.view_channel:
                return target
    except Exception:
        pass

    # 2) A user id / mention in the channel topic.
    topic = getattr(channel, "topic", None)
    if topic:
        match = SNOWFLAKE_RE.search(topic)
        if match:
            user_id = int(match.group(1))
            try:
                user = await guild.fetch_member(user_id)
                if user and not user.bot:
                    return user
            except Exception:
                try:
                    user = await bot.fetch_user(user_id)
                    if user and not user.bot:
                        return user
                except Exception:
                    pass

    # 3) & 4) Earliest messages in the channel.
    try:
        messages = [m async for m in channel.history(limit=20, oldest_first=True)]
        for message in messages:
            if not message.author.bot:
                return message.author
        for message in messages:
            for mentioned in message.mentions:
                if not mentioned.bot:
                    return mentioned
    except Exception:
        pass

    return None


# ─── Google Drive ──────────────────────────────────────────────────────
def is_drive_configured() -> bool:
    oauth_ready = bool(
        GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REFRESH_TOKEN
    )
    service_ready = bool(GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY_FILE)
    return oauth_ready or service_ready


def _upload_to_drive_sync(file_path: str, file_name: str) -> dict:
    """Blocking Drive upload. Run via run_in_executor so it doesn't block the bot."""
    import json as _json
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    if GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REFRESH_TOKEN:
        # Option B: OAuth2 (uploads into a real user's My Drive)
        from google.oauth2.credentials import Credentials

        creds = Credentials(
            token=None,
            refresh_token=GOOGLE_OAUTH_REFRESH_TOKEN,
            client_id=GOOGLE_OAUTH_CLIENT_ID,
            client_secret=GOOGLE_OAUTH_CLIENT_SECRET,
            token_uri="https://oauth2.googleapis.com/token",
            scopes=DRIVE_SCOPES,
        )
    else:
        # Option A: service account (best with a Shared Drive)
        from google.oauth2 import service_account

        if GOOGLE_SERVICE_ACCOUNT_JSON:
            info = _json.loads(GOOGLE_SERVICE_ACCOUNT_JSON)
        else:
            with open(GOOGLE_SERVICE_ACCOUNT_KEY_FILE, "r", encoding="utf-8") as fh:
                info = _json.load(fh)
        creds = service_account.Credentials.from_service_account_info(info, scopes=DRIVE_SCOPES)

    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    metadata = {"name": file_name}
    if GOOGLE_DRIVE_FOLDER_ID:
        metadata["parents"] = [GOOGLE_DRIVE_FOLDER_ID]

    media = MediaFileUpload(file_path, mimetype="text/html", resumable=False)
    result = (
        service.files()
        .create(
            body=metadata,
            media_body=media,
            fields="id, name, webViewLink",
            supportsAllDrives=True,
        )
        .execute()
    )
    return result


async def upload_to_drive(file_path: str, file_name: str) -> dict:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _upload_to_drive_sync, file_path, file_name)


# ─── Bot ───────────────────────────────────────────────────────────────
class TicketBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True  # privileged: enable it in the dev portal
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self):
        if GUILD_ID:
            guild = discord.Object(id=int(GUILD_ID))
            self.tree.copy_global_to(guild=guild)
            synced = await self.tree.sync(guild=guild)
            print(f"Registered {len(synced)} command(s) to guild {GUILD_ID} (instant).")
        else:
            synced = await self.tree.sync()
            print(f"Registered {len(synced)} global command(s) (can take up to 1h to appear).")


bot = TicketBot()


@bot.event
async def on_ready():
    try:
        chat_exporter.init_exporter(bot)
    except Exception:
        pass
    print(f"Logged in as {bot.user} — ready to archive tickets.")


@bot.tree.command(
    name="archive",
    description="Save an HTML transcript of this ticket, named after the ticket opener.",
)
@app_commands.describe(
    opener="Override the auto-detected ticket opener (used for the filename).",
    upload="Also upload the transcript to Google Drive.",
    close="Delete this ticket channel after archiving (careful!).",
)
@app_commands.default_permissions(manage_channels=True)
@app_commands.guild_only()
async def archive(
    interaction: discord.Interaction,
    opener: Optional[discord.User] = None,
    upload: Optional[bool] = None,
    close: Optional[bool] = False,
):
    channel = interaction.channel

    if channel is None or channel.type not in ARCHIVABLE_CHANNEL_TYPES:
        await interaction.response.send_message(
            "Run this command inside the ticket channel you want to archive.",
            ephemeral=True,
        )
        return

    await interaction.response.defer(ephemeral=True)

    want_upload = DRIVE_UPLOAD_DEFAULT if upload is None else upload
    want_close = bool(close)

    # 1) Determine the opener (drives the filename).
    resolved = opener or await resolve_ticket_opener(channel)
    if resolved:
        member = interaction.guild.get_member(resolved.id)
        if member is None:
            try:
                member = await interaction.guild.fetch_member(resolved.id)
            except Exception:
                member = None
        opener_label = (
            member.display_name
            if member
            else (getattr(resolved, "global_name", None) or resolved.name)
        )
    else:
        opener_label = channel.name

    date_stamp = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    base_name = sanitize_name(f"{opener_label} - {date_stamp}")

    # 2) Generate the transcript (full history).
    try:
        transcript = await chat_exporter.export(
            channel,
            limit=None,
            tz_info="UTC",
            military_time=True,
            bot=bot,
        )
    except Exception as err:
        await interaction.edit_original_response(
            content=f"Failed to generate the transcript: {err}"
        )
        return

    if transcript is None:
        await interaction.edit_original_response(
            content="Failed to generate the transcript (no messages or missing permissions)."
        )
        return

    transcript_bytes = transcript.encode("utf-8")

    # 3) Save locally.
    Path(TRANSCRIPT_DIR).mkdir(parents=True, exist_ok=True)
    saved_path = unique_path(TRANSCRIPT_DIR, base_name)
    saved_path.write_bytes(transcript_bytes)
    saved_name = saved_path.name

    lines = [
        "✅ **Ticket archived.**",
        f"**Opener:** {resolved.mention if resolved else opener_label}",
        f"**Source:** {channel.mention}",
        f"**Saved as:** `{saved_name}`",
    ]

    # 4) Optional Google Drive upload.
    if want_upload:
        if not is_drive_configured():
            lines.append("⚠️ Drive upload requested but Google Drive is not configured on the bot.")
        else:
            try:
                uploaded = await upload_to_drive(str(saved_path), saved_name)
                link = uploaded.get("webViewLink")
                lines.append(f"☁️ Uploaded to Google Drive{f': <{link}>' if link else ''}")
            except Exception as err:
                lines.append(f"⚠️ Google Drive upload failed: {err}")

    summary = "\n".join(lines)

    def make_file() -> discord.File:
        return discord.File(io.BytesIO(transcript_bytes), filename=saved_name)

    # 5) Mirror to an audit-log channel if configured.
    if LOG_CHANNEL_ID and str(LOG_CHANNEL_ID) != str(channel.id):
        try:
            log_channel = bot.get_channel(int(LOG_CHANNEL_ID)) or await bot.fetch_channel(
                int(LOG_CHANNEL_ID)
            )
            if log_channel is not None:
                await log_channel.send(content=summary, file=make_file())
        except Exception:
            pass

    # 6) Reply to the invoker, attaching the transcript when it fits.
    try:
        await interaction.edit_original_response(content=summary, attachments=[make_file()])
    except discord.HTTPException:
        await interaction.edit_original_response(
            content=summary
            + "\n(⚠️ Transcript too large to attach here — grab it from the saved file or Drive.)"
        )

    # 7) Optionally delete the ticket channel.
    if want_close:
        perms = channel.permissions_for(interaction.guild.me)
        if not perms.manage_channels:
            await interaction.followup.send(
                "⚠️ I need the **Manage Channels** permission to delete this channel.",
                ephemeral=True,
            )
            return
        await asyncio.sleep(5)
        try:
            await channel.delete(reason=f"Ticket archived by {interaction.user}")
        except Exception:
            pass


def main():
    if not DISCORD_TOKEN:
        raise SystemExit("Missing DISCORD_TOKEN environment variable.")
    bot.run(DISCORD_TOKEN)


if __name__ == "__main__":
    main()

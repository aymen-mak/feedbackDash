import 'dotenv/config';

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
};

export const config = {
  // Discord
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID || null,

  // Where transcripts are written on the machine running the bot
  transcriptDir: process.env.TRANSCRIPT_DIR || './transcripts',

  // Optional channel where every archive is also posted (audit log)
  logChannelId: process.env.LOG_CHANNEL_ID || null,

  // Google Drive
  drive: {
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
    uploadByDefault: bool(process.env.DRIVE_UPLOAD_DEFAULT, false),
    // Option A: service account (recommended with a Shared Drive)
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || null,
    serviceAccountKeyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || null,
    // Option B: OAuth2 (upload into a normal "My Drive" folder you own)
    oauth: {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || null,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || null,
      refreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || null,
    },
  },
};

export function assertBotConfig() {
  const missing = [];
  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('DISCORD_CLIENT_ID');
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill it in.',
    );
  }
}

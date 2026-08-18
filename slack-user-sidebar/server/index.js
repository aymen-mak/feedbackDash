require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const { WebClient } = require('@slack/web-api');

const app = express();
const PORT = process.env.PORT || 3001;

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Fetch all non-bot, non-deleted workspace members
async function fetchMembers() {
  const members = [];
  let cursor;

  do {
    const res = await slack.users.list({ limit: 200, cursor });
    for (const user of res.members) {
      if (!user.deleted && !user.is_bot && user.id !== 'USLACKBOT') {
        members.push({
          id: user.id,
          name: user.profile.display_name || user.real_name || user.name,
          real_name: user.real_name,
          avatar: user.profile.image_72,
          title: user.profile.title || '',
          is_admin: user.is_admin || false,
          is_owner: user.is_owner || false,
          tz: user.tz || '',
        });
      }
    }
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);

  return members;
}

// GET /api/users — returns members with their current presence
app.get('/api/users', async (req, res) => {
  try {
    const members = await fetchMembers();

    // Slack rate-limits presence checks; batch them with small delays
    const withPresence = await Promise.all(
      members.map(async (member) => {
        try {
          const p = await slack.users.getPresence({ user: member.id });
          return { ...member, presence: p.presence }; // 'active' | 'away'
        } catch {
          return { ...member, presence: 'away' };
        }
      })
    );

    // Sort: online first, then alphabetically within each group
    withPresence.sort((a, b) => {
      if (a.presence === b.presence) return a.name.localeCompare(b.name);
      return a.presence === 'active' ? -1 : 1;
    });

    res.json({ ok: true, users: withPresence });
  } catch (err) {
    console.error('Slack API error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/presence/:userId — single-user presence refresh
app.get('/api/presence/:userId', async (req, res) => {
  try {
    const p = await slack.users.getPresence({ user: req.params.userId });
    res.json({ ok: true, presence: p.presence });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Serve the frontend for any unknown route (SPA fallback)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Slack user sidebar running at http://localhost:${PORT}`);
  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn('Warning: SLACK_BOT_TOKEN not set — copy .env.example to .env and fill in your credentials.');
  }
});

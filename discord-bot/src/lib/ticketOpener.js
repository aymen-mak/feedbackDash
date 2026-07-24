import { PermissionsBitField, OverwriteType } from 'discord.js';

const SNOWFLAKE = /(\d{17,20})/;

/**
 * Best-effort detection of the member who opened a ticket, using the signals
 * ticket bots (MEE6, Ticket Tool, etc.) typically leave behind. Returns a
 * discord.js User, or null if nothing conclusive is found.
 *
 * Order of preference:
 *   1. A per-member permission overwrite granting "View Channel" (how most
 *      ticket bots give the opener access to their private channel).
 *   2. A user id/mention embedded in the channel topic.
 *   3. The first human author in the channel.
 *   4. The first user mentioned by the opening bot message.
 */
export async function resolveTicketOpener(channel) {
  const guild = channel.guild;
  if (!guild) return null;

  // 1) Permission overwrites — the opener almost always has an explicit
  //    member-level "View Channel" allow on their ticket channel.
  try {
    const overwrites = channel.permissionOverwrites?.cache;
    if (overwrites) {
      for (const overwrite of overwrites.values()) {
        if (overwrite.type !== OverwriteType.Member) continue;
        if (!overwrite.allow.has(PermissionsBitField.Flags.ViewChannel)) continue;
        const member = await guild.members.fetch(overwrite.id).catch(() => null);
        if (member && !member.user.bot) return member.user;
      }
    }
  } catch {
    /* ignore and fall through */
  }

  // 2) Channel topic often contains the opener's id or mention.
  if (channel.topic) {
    const match = channel.topic.match(SNOWFLAKE);
    if (match) {
      const user = await guild.client.users.fetch(match[1]).catch(() => null);
      if (user && !user.bot) return user;
    }
  }

  // 3) & 4) Fall back to the earliest messages in the channel.
  try {
    const firstBatch = await channel.messages.fetch({ limit: 20, after: '0' });
    const oldestFirst = [...firstBatch.values()].sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp,
    );

    for (const message of oldestFirst) {
      if (!message.author.bot) return message.author;
    }
    for (const message of oldestFirst) {
      const mentioned = message.mentions.users.find((u) => !u.bot);
      if (mentioned) return mentioned;
    }
  } catch {
    /* ignore */
  }

  return null;
}

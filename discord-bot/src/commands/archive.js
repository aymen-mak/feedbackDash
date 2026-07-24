import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
  ChannelType,
} from 'discord.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { buildTranscript } from '../lib/transcript.js';
import { resolveTicketOpener } from '../lib/ticketOpener.js';
import { sanitizeName, uniquePath } from '../lib/naming.js';
import { isDriveConfigured, uploadToDrive } from '../lib/drive.js';

const ARCHIVABLE_CHANNELS = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
];

export const data = new SlashCommandBuilder()
  .setName('archive')
  .setDescription('Save an HTML transcript of this ticket, named after the ticket opener.')
  .addUserOption((o) =>
    o
      .setName('opener')
      .setDescription('Override the auto-detected ticket opener (used for the filename).')
      .setRequired(false),
  )
  .addBooleanOption((o) =>
    o
      .setName('upload')
      .setDescription('Also upload the transcript to Google Drive.')
      .setRequired(false),
  )
  .addBooleanOption((o) =>
    o
      .setName('close')
      .setDescription('Delete this ticket channel after archiving (careful!).')
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setDMPermission(false);

export async function execute(interaction) {
  const channel = interaction.channel;

  if (!channel || !ARCHIVABLE_CHANNELS.includes(channel.type)) {
    await interaction.reply({
      content: 'Run this command inside the ticket channel you want to archive.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const wantUpload = interaction.options.getBoolean('upload') ?? config.drive.uploadByDefault;
  const wantClose = interaction.options.getBoolean('close') ?? false;

  // 1) Figure out who opened the ticket (drives the filename).
  const opener = interaction.options.getUser('opener') ?? (await resolveTicketOpener(channel));

  let openerLabel;
  if (opener) {
    const member = await interaction.guild.members.fetch(opener.id).catch(() => null);
    openerLabel = member?.displayName || opener.globalName || opener.username;
  } else {
    openerLabel = channel.name;
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const baseName = sanitizeName(`${openerLabel} - ${dateStamp}`);
  const fileName = `${baseName}.html`;

  // 2) Generate the transcript.
  let buffer;
  try {
    buffer = await buildTranscript(channel, fileName);
  } catch (err) {
    await interaction.editReply(`❌ Failed to generate the transcript: ${err.message}`);
    return;
  }

  // 3) Save it locally.
  const dir = path.resolve(config.transcriptDir);
  await mkdir(dir, { recursive: true });
  const savedPath = await uniquePath(dir, baseName);
  await writeFile(savedPath, buffer);
  const savedName = path.basename(savedPath);

  const lines = [
    '✅ **Ticket archived.**',
    `**Opener:** ${opener ? `<@${opener.id}>` : openerLabel}`,
    `**Messages source:** ${channel}`,
    `**Saved as:** \`${savedName}\``,
  ];

  // 4) Optionally upload to Google Drive.
  if (wantUpload) {
    if (!isDriveConfigured()) {
      lines.push('⚠️ Drive upload was requested but Google Drive is not configured on the bot.');
    } else {
      try {
        const uploaded = await uploadToDrive(savedPath, savedName);
        lines.push(
          `☁️ Uploaded to Google Drive${uploaded.webViewLink ? `: <${uploaded.webViewLink}>` : ''}`,
        );
      } catch (err) {
        lines.push(`⚠️ Google Drive upload failed: ${err.message}`);
      }
    }
  }

  const summary = lines.join('\n');

  // 5) Mirror to an audit-log channel if configured.
  if (config.logChannelId && config.logChannelId !== channel.id) {
    const logChannel = await interaction.client.channels
      .fetch(config.logChannelId)
      .catch(() => null);
    if (logChannel?.isTextBased?.()) {
      await logChannel
        .send({ content: summary, files: [new AttachmentBuilder(buffer, { name: savedName })] })
        .catch(() => {});
    }
  }

  // 6) Reply to the invoker, attaching the transcript when it fits.
  try {
    await interaction.editReply({
      content: summary,
      files: [new AttachmentBuilder(buffer, { name: savedName })],
    });
  } catch {
    await interaction.editReply({
      content: `${summary}\n(⚠️ Transcript too large to attach here — grab it from the saved file or Drive.)`,
    });
  }

  // 7) Optionally delete the ticket channel.
  if (wantClose) {
    if (!channel.manageable) {
      await interaction
        .followUp({
          content: '⚠️ I need the **Manage Channels** permission to delete this channel.',
          ephemeral: true,
        })
        .catch(() => {});
      return;
    }
    // Give the reply a moment to render before the channel disappears.
    setTimeout(() => {
      channel.delete(`Ticket archived by ${interaction.user.tag}`).catch(() => {});
    }, 5000);
  }
}

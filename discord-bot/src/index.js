import { Client, Collection, GatewayIntentBits, Events } from 'discord.js';
import { config, assertBotConfig } from './config.js';
import * as archive from './commands/archive.js';

assertBotConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // required to read historical message text
  ],
});

client.commands = new Collection();
client.commands.set(archive.data.name, archive);

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}. Ready to archive tickets.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error running /${interaction.commandName}:`, err);
    const payload = { content: `Something went wrong: ${err.message}`, ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(config.token);

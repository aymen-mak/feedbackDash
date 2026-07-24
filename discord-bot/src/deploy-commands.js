import { REST, Routes } from 'discord.js';
import { config, assertBotConfig } from './config.js';
import * as archive from './commands/archive.js';

assertBotConfig();

const commands = [archive.data.toJSON()];
const rest = new REST().setToken(config.token);

async function run() {
  try {
    if (config.guildId) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
        body: commands,
      });
      console.log(
        `✅ Registered ${commands.length} guild command(s) to ${config.guildId} (available instantly).`,
      );
    } else {
      await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
      console.log(
        `✅ Registered ${commands.length} global command(s). Global commands can take up to 1 hour to appear.`,
      );
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
    process.exit(1);
  }
}

run();

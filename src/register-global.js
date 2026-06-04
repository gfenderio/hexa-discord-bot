import { REST, Routes } from 'discord.js';
import { ENV } from './env.js';
import { COMMANDS } from './commands.js';

const rest = new REST({ version: '10' }).setToken(ENV.DISCORD_TOKEN);

async function main() {
  const body = COMMANDS.map((c) => c.toJSON());
  await rest.put(Routes.applicationCommands(ENV.DISCORD_CLIENT_ID), { body });
  console.log(`Registered ${body.length} global commands for app ${ENV.DISCORD_CLIENT_ID}`);
  console.log('Note: global commands can take a few minutes to appear.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});


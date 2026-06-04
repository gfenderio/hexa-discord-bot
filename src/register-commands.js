import { REST, Routes } from 'discord.js';
import { ENV } from './env.js';
import { COMMANDS } from './commands.js';

const rest = new REST({ version: '10' }).setToken(ENV.DISCORD_TOKEN);

async function main() {
  const body = COMMANDS.map((c) => c.toJSON());
  try {
    await rest.put(
      Routes.applicationGuildCommands(ENV.DISCORD_CLIENT_ID, ENV.GUILD_ID),
      { body }
    );
    console.log(`Registered ${body.length} commands for guild ${ENV.GUILD_ID}`);
  } catch (err) {
    if (err?.code === 50001 || err?.status === 403) {
      console.error(err);
      console.log('');
      console.log('Missing Access registering guild commands.');
      console.log('- Ensure the bot is invited to that server (scope: bot + applications.commands).');
      console.log('- Ensure you authorized with an account that can Manage Server.');
      console.log('- Ensure GUILD_ID is the server where the bot is present.');
      console.log('');
      console.log('Fallback: register global commands instead:');
      console.log('  npm.cmd run register:global');
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});


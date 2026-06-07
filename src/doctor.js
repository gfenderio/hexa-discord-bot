import { ENV } from './env.js';

console.log('Env OK:');
console.log(`- DISCORD_CLIENT_ID=${ENV.DISCORD_CLIENT_ID}`);
console.log(`- GUILD_ID=${ENV.GUILD_ID}`);
console.log(`- DISCORD_TOKEN=(${ENV.DISCORD_TOKEN.length} chars)`);
console.log(`- NOTION_TOKEN=(${ENV.NOTION_TOKEN.length} chars)`);
console.log(`- NOTION_DATABASE_ID=${ENV.NOTION_DATABASE_ID}`);
console.log(`- NOTION_STANDUP_CHANNEL_ID=${ENV.NOTION_STANDUP_CHANNEL_ID}`);



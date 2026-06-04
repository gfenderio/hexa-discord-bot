import { ENV } from './env.js';

console.log('Env OK:');
console.log(`- DISCORD_CLIENT_ID=${ENV.DISCORD_CLIENT_ID}`);
console.log(`- GUILD_ID=${ENV.GUILD_ID}`);
console.log(`- DISCORD_TOKEN=(${ENV.DISCORD_TOKEN.length} chars)`);
console.log(`- GEMINI_API_KEY=(${ENV.GEMINI_API_KEY.length} chars)`);



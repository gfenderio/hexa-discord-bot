import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const ENV = {
  DISCORD_TOKEN: required('DISCORD_TOKEN'),
  DISCORD_CLIENT_ID: required('DISCORD_CLIENT_ID'),
  GUILD_ID: required('GUILD_ID'),
  GEMINI_API_KEYS: required('GEMINI_API_KEY').split(',').map(k => k.trim().replace(/^["']|["']$/g, '')),
  NOTION_TOKEN: required('NOTION_TOKEN'),
  NOTION_DATABASE_ID: required('NOTION_DATABASE_ID'),
  NOTION_STANDUP_CHANNEL_ID: process.env.NOTION_STANDUP_CHANNEL_ID || '1512690120875311105'
};



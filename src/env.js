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
  // AI routing sekarang lewat n9router (lihat src/mb01.js), key Gemini tidak lagi dipakai bot ini.
  NOTION_TOKEN: required('NOTION_TOKEN'),
  NOTION_DATABASE_ID: required('NOTION_DATABASE_ID'),
  NOTION_STANDUP_CHANNEL_ID: process.env.NOTION_STANDUP_CHANNEL_ID || '1512690120875311105',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || ''
};



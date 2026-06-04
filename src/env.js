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
  GEMINI_API_KEYS: required('GEMINI_API_KEY').split(',').map(k => k.trim().replace(/^["']|["']$/g, ''))
};



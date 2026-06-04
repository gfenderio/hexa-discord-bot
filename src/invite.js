import 'dotenv/config';

const clientId = process.env.DISCORD_CLIENT_ID;
if (!clientId) {
  console.error('Missing DISCORD_CLIENT_ID in .env');
  process.exitCode = 1;
} else {
  const permissions = '0';
  const scopes = encodeURIComponent('bot applications.commands');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scopes}`;
  console.log(url);
}


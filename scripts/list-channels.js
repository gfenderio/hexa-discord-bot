import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
  try {
    console.log(`Logged in as ${client.user.tag}`);
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    console.log(`Guild Name: ${guild.name}`);
    
    console.log('\n--- ROLES ---');
    const roles = await guild.roles.fetch();
    roles.forEach(r => console.log(`- [${r.id}] ${r.name}`));
    
    console.log('\n--- CHANNELS ---');
    const channels = await guild.channels.fetch();
    channels.forEach(c => {
      console.log(`- [${c.id}] ${c.name} (${c.type === 4 ? 'Category' : c.type === 2 ? 'Voice' : 'Text'}) - Parent: ${c.parentId || 'None'}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);

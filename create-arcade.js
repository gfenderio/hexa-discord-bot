import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import { ENV } from './src/env.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  try {
    const guildId = '1053332316908437515';
    const guild = await client.guilds.fetch(guildId);
    if (!guild) throw new Error('Guild not found');

    console.log('Recreating category: 🎮 ARCADE & HANGOUT...');
    const category = await guild.channels.create({
      name: '🎮 ARCADE & HANGOUT',
      type: ChannelType.GuildCategory,
    });

    console.log('Creating text channel: arcade-room...');
    const textChannel = await guild.channels.create({
      name: 'arcade-room',
      type: ChannelType.GuildText,
      parent: category.id,
      topic: 'Ruang ngobrol santai dan main game bareng teman-teman! 🎮✨'
    });

    console.log('Creating voice channel: Arcade Voice...');
    const voiceChannel = await guild.channels.create({
      name: 'Arcade Voice',
      type: ChannelType.GuildVoice,
      parent: category.id
    });

    console.log(`Success! Recreated category ${category.id}, text ${textChannel.id}, voice ${voiceChannel.id}`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.destroy();
  }
});

client.login(ENV.DISCORD_TOKEN);

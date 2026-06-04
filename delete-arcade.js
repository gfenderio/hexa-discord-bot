import { Client, GatewayIntentBits } from 'discord.js';
import { ENV } from './src/env.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  try {
    const guildId = '1053332316908437515';
    const guild = await client.guilds.fetch(guildId);
    if (!guild) throw new Error('Guild not found');

    const arcadeCategoryId = '1510991751052136648';
    const arcadeTextId = '1510991752788705371';
    const arcadeVoiceId = '1510991754395123753';

    console.log('Deleting arcade channels...');
    
    // Delete text channel
    try {
      const textCh = await guild.channels.fetch(arcadeTextId);
      if (textCh) {
        await textCh.delete('Hapus setup arcade');
        console.log(`Deleted text channel ${arcadeTextId}`);
      }
    } catch (e) {
      console.error(`Error deleting text channel:`, e.message);
    }

    // Delete voice channel
    try {
      const voiceCh = await guild.channels.fetch(arcadeVoiceId);
      if (voiceCh) {
        await voiceCh.delete('Hapus setup arcade');
        console.log(`Deleted voice channel ${arcadeVoiceId}`);
      }
    } catch (e) {
      console.error(`Error deleting voice channel:`, e.message);
    }

    // Delete category
    try {
      const categoryCh = await guild.channels.fetch(arcadeCategoryId);
      if (categoryCh) {
        await categoryCh.delete('Hapus setup arcade');
        console.log(`Deleted category ${arcadeCategoryId}`);
      }
    } catch (e) {
      console.error(`Error deleting category:`, e.message);
    }

    console.log('Arcade setup successfully deleted!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.destroy();
  }
});

client.login(ENV.DISCORD_TOKEN);

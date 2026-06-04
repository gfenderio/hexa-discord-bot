import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, entersState, VoiceConnectionStatus } from '@discordjs/voice';
import { ENV } from './src/env.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.once('ready', async () => {
  console.log('Ready as', client.user.tag);
  try {
    const guild = await client.guilds.fetch('1053332316908437515');
    const voiceChannel = guild.channels.cache.find(c => c.isVoiceBased());
    if (!voiceChannel) {
      console.log('No voice channel found');
      process.exit(1);
    }

    console.log('Joining', voiceChannel.name);
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    connection.on('stateChange', (oldState, newState) => {
      console.log(`Connection transitioned from ${oldState.status} to ${newState.status}`);
    });

    console.log('Waiting for Ready...');
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    console.log('Connection is READY!');
    connection.destroy();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.destroy();
  }
});

client.login(ENV.DISCORD_TOKEN);

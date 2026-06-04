import { Client, GatewayIntentBits, ChannelType, PermissionsBitField } from 'discord.js';
import { ENV } from './src/env.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  try {
    const guildId = '1053332316908437515';
    const guild = await client.guilds.fetch(guildId);
    if (!guild) throw new Error('Guild not found');

    const ownerId = '419213146209779713';
    const partnerRoleId = '1510993511917555775';

    console.log('Creating category...');
    const category = await guild.channels.create({
      name: '💕 PRIVATE ROOM',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: ownerId,
          allow: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: partnerRoleId,
          allow: [PermissionsBitField.Flags.ViewChannel],
        }
      ]
    });

    console.log('Creating text channel...');
    const textChannel = await guild.channels.create({
      name: 'diary-kita',
      type: ChannelType.GuildText,
      parent: category.id,
      topic: 'Ruang privat eksklusif 💖'
    });

    console.log('Creating voice channel...');
    const voiceChannel = await guild.channels.create({
      name: 'Private Voice',
      type: ChannelType.GuildVoice,
      parent: category.id
    });

    console.log(`Success! Created category ${category.id}, text ${textChannel.id}, voice ${voiceChannel.id}`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.destroy();
  }
});

client.login(ENV.DISCORD_TOKEN);

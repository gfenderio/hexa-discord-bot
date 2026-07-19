import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus
} from '@discordjs/voice';
import {
  buildAddedEmbed,
  buildMusicButtons,
  buildQueueEndedEmbed,
  buildSounddeckEmbed
} from './panel.js';
import { getSession } from './session.js';
import { createStreamResource } from './youtube.js';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function updatePanel(client, guildId) {
  const session = getSession(guildId);
  const { channelId, messageId } = session.panel;
  
  try {
    if (channelId && messageId) {
      const channel = await client.channels.fetch(channelId);
      if (channel?.isTextBased?.()) {
        const msg = await channel.messages.fetch(messageId);
        await msg.edit({
          embeds: [
            buildSounddeckEmbed({
              track: session.current,
              queueLen: session.queue.length,
              loop: session.loop,
              shuffle: session.shuffle,
              volume: session.volume,
              paused: session.paused
            })
          ],
          components: buildMusicButtons({
            paused: session.paused,
            loop: session.loop
          })
        });
        return; // Success, edited the existing panel
      }
    }
  } catch (e) {
    // If the message is deleted or channel is inaccessible, clear the panel ID
    session.panel = { channelId: null, messageId: null };
  }

  // If we reach here, the panel needs to be recreated but we only have textChannelId
  if (session.textChannelId) {
    try {
      const channel = await client.channels.fetch(session.textChannelId);
      if (channel?.isTextBased?.()) {
        await sendOrRefreshPanel(client, guildId, channel);
      }
    } catch (e) {
      console.error('Failed to recreate panel:', e.message);
    }
  }
}

async function sendOrRefreshPanel(client, guildId, textChannel) {
  const session = getSession(guildId);
  session.textChannelId = textChannel.id;

  const payload = {
    embeds: [
      buildSounddeckEmbed({
        track: session.current,
        queueLen: session.queue.length,
        loop: session.loop,
        shuffle: session.shuffle,
        volume: session.volume,
        paused: session.paused
      })
    ],
    components: buildMusicButtons({
      paused: session.paused,
      loop: session.loop
    })
  };

  if (session.panel.channelId && session.panel.messageId) {
    try {
      const ch = await client.channels.fetch(session.panel.channelId);
      const msg = await ch.messages.fetch(session.panel.messageId);
      await msg.edit(payload);
      return msg;
    } catch {
      session.panel = { channelId: null, messageId: null };
    }
  }

  const msg = await textChannel.send(payload);
  session.panel = { channelId: textChannel.id, messageId: msg.id };
  return msg;
}

async function ensureVoice(client, interaction, session) {
  const member = interaction.member;
  const voiceChannel = member?.voice?.channel;
  const guildId = interaction.guildId;
  if (!voiceChannel) {
    throw new Error('Kamu harus join **voice channel** dulu.');
  }

  if (!session.connection) {
    session.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: true
    });



    try {
      await entersState(session.connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (err) {
      session.connection.destroy();
      session.connection = null;
      throw new Error('Koneksi suara Discord RTO (Timeout). Silakan coba jalankan command `/play` lagi.');
    }
  } else if (session.connection.joinConfig.channelId !== voiceChannel.id) {
    session.connection.rejoin({
      channelId: voiceChannel.id,
      selfDeaf: true
    });
    try {
      await entersState(session.connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (err) {
      session.connection.destroy();
      session.connection = null;
      throw new Error('Gagal pindah Voice Channel (Timeout). Silakan coba lagi.');
    }
  }

  if (!session.player) {
    session.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play }
    });
    session.connection.subscribe(session.player);

    session.player.on(AudioPlayerStatus.Idle, () => {
      onTrackEnd(client, guildId).catch(console.error);
    });
  }

  return voiceChannel;
}


async function playTrack(client, guildId, track) {
  const session = getSession(guildId);
  session.current = track;
  session.paused = false;

  try {
    const resource = await createStreamResource(track.url, track.streamUrl);
    resource.volume?.setVolume(session.volume);

    session.player.play(resource);
    await updatePanel(client, guildId);
  } catch (err) {
    console.error('playTrack error:', err);
    session.current = null;
    // Try to play next track in queue
    if (session.queue.length > 0) {
      const next = session.queue.shift();
      await playTrack(client, guildId, next);
    }
  }
}

async function onTrackEnd(client, guildId) {
  const session = getSession(guildId);

  if (session.loop === 'track' && session.current) {
    await playTrack(client, guildId, session.current);
    return;
  }

  if (session.loop === 'queue' && session.current) {
    session.queue.push(session.current);
  }

  if (session.queue.length === 0) {
    session.current = null;
    await updatePanel(client, guildId);

    if (session.textChannelId) {
      try {
        const ch = await client.channels.fetch(session.textChannelId);
        if (ch?.isTextBased?.()) {
          await ch.send({ embeds: [buildQueueEndedEmbed()] });
        }
      } catch {
        /* ignore */
      }
    }
    return;
  }

  const next = session.queue.shift();
  await playTrack(client, guildId, next);
}

export async function enqueueAndPlay({ client, interaction, track }) {
  const guildId = interaction.guildId;
  const session = getSession(guildId);
  await ensureVoice(client, interaction, session);

  if (!session.current) {
    await playTrack(client, guildId, track);
    await sendOrRefreshPanel(client, guildId, interaction.channel);
    return { started: true, position: 0 };
  }

  session.queue.push(track);
  await updatePanel(client, guildId);
  if (!session.panel.messageId) {
    await sendOrRefreshPanel(client, guildId, interaction.channel);
  }

  return { started: false, position: session.queue.length };
}

export async function handleMusicButton({ client, interaction }) {
  const guildId = interaction.guildId;
  const session = getSession(guildId);
  const action = interaction.customId.replace('hexa:music:', '');

  if (!session.player && action !== 'queue') {
    await interaction.reply({
      content: 'Belum ada musik yang diputar. Pakai `/play` dulu.',
      ephemeral: true
    });
    return;
  }

  await interaction.deferUpdate();

  switch (action) {
    case 'pause': {
      if (session.player.state.status === AudioPlayerStatus.Playing) {
        session.player.pause();
        session.paused = true;
      } else if (session.player.state.status === AudioPlayerStatus.Paused) {
        session.player.unpause();
        session.paused = false;
      }
      break;
    }
    case 'skip': {
      session.player.stop();
      break;
    }
    case 'stop': {
      session.queue = [];
      session.current = null;
      session.player?.stop();
      session.connection?.destroy();
      session.connection = null;
      session.player = null;
      session.paused = false;
      await updatePanel(client, guildId);
      await interaction.followUp({
        content: '⏹️ Sounddeck dihentikan.',
        ephemeral: true
      });
      return;
    }
    case 'vol_down': {
      session.volume = Math.max(0.1, session.volume - 0.1);
      const sub = session.player.state.resource;
      sub?.volume?.setVolume(session.volume);
      break;
    }
    case 'vol_up': {
      session.volume = Math.min(1, session.volume + 0.1);
      const sub = session.player.state.resource;
      sub?.volume?.setVolume(session.volume);
      break;
    }
    case 'shuffle': {
      session.shuffle = !session.shuffle;
      if (session.shuffle && session.queue.length > 1) {
        session.queue = shuffleArray(session.queue);
      }
      break;
    }
    case 'loop': {
      session.loop =
        session.loop === 'off' ? 'track' : session.loop === 'track' ? 'queue' : 'off';
      break;
    }
    case 'replay': {
      if (session.current) {
        await playTrack(client, guildId, session.current);
      }
      break;
    }
    case 'queue': {
      const lines =
        session.queue.length === 0
          ? ['Antrian kosong.']
          : session.queue.slice(0, 10).map((t, i) => `${i + 1}. ${t.title}`);
      await interaction.followUp({
        content: `**📜 Antrian Hexa**\n${lines.join('\n').slice(0, 1900)}`,
        ephemeral: true
      });
      return;
    }
    default:
      break;
  }

  await updatePanel(client, guildId);
}

export { buildAddedEmbed, updatePanel };

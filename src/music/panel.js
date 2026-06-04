import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import { formatDuration } from './format.js';

export function buildSounddeckEmbed({ track, queueLen, loop, shuffle, volume, paused }) {
  const loopLabel =
    loop === 'track' ? '🔂 Track' : loop === 'queue' ? '🔁 Queue' : '➡️ Off';
  const status = paused ? '⏸ Jeda' : '▶️ Putar';

  const embed = new EmbedBuilder()
    .setTitle('🎧 Hexa Sounddeck')
    .setColor(0xEB459E)
    .setDescription(
      track
        ? `### ${clip(track.title, 100)}\n👤 Diminta oleh: <@${track.requestedBy}>`
        : '*Belum ada lagu — pakai `/play` untuk mulai.*'
    )
    .addFields(
      {
        name: '⏱️ Durasi',
        value: `\`${track ? formatDuration(track.durationSec) : '-'}\``,
        inline: true
      },
      {
        name: '📺 Channel',
        value: `\`${track ? clip(track.channel, 25) : '-'}\``,
        inline: true
      },
      {
        name: '📶 Status',
        value: `\`${status} • Vol ${Math.round(volume * 100)}%\``,
        inline: true
      },
      {
        name: '🎛️ Mode',
        value: `\`${shuffle ? '🔀 Acak ON' : '🔀 Acak OFF'} • ${loopLabel}\``,
        inline: true
      },
      {
        name: '📜 Antrian',
        value: `\`${queueLen > 0 ? queueLen + ' lagu menunggu' : 'Kosong'}\``,
        inline: true
      }
    )
    .setFooter({ text: 'Hexa Music Experience • Kontrol via tombol di bawah' })
    .setTimestamp();

  if (track?.thumbnail) embed.setImage(track.thumbnail);
  return embed;
}

export function buildAddedEmbed({ track, position }) {
  return new EmbedBuilder()
    .setTitle(`🎵 Masuk lineup #${position}`)
    .setColor(0x06b6d4)
    .setDescription(
      `\`\`\`\n${clip(track.title, 800)} [${formatDuration(track.durationSec)}]\n\`\`\``
    )
    .setFooter({ text: 'Hexa Sounddeck' });
}

export function buildQueueEndedEmbed() {
  return new EmbedBuilder()
    .setTitle('✨ Lineup selesai')
    .setColor(0x64748b)
    .setDescription(
      'Semua lagu sudah diputar.\nTambah lagi pakai **`/play`** — atau tekan **Putar lagi** di panel terakhir.'
    )
    .setFooter({ text: 'Hexa Sounddeck' });
}

export function buildMusicButtons({ paused, loop }) {
  const pauseLabel = paused ? '▶️ Lanjut' : '⏸ Jeda';
  const loopStyle =
    loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Primary;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('hexa:music:vol_down')
      .setLabel('Vol −')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔉'),
    new ButtonBuilder()
      .setCustomId('hexa:music:pause')
      .setLabel(pauseLabel)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('hexa:music:skip')
      .setLabel('Skip')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⏭️'),
    new ButtonBuilder()
      .setCustomId('hexa:music:vol_up')
      .setLabel('Vol +')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔊'),
    new ButtonBuilder()
      .setCustomId('hexa:music:queue')
      .setLabel('Antrian')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📜')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('hexa:music:shuffle')
      .setLabel('Acak')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔀'),
    new ButtonBuilder()
      .setCustomId('hexa:music:loop')
      .setLabel('Loop')
      .setStyle(loopStyle)
      .setEmoji('🔁'),
    new ButtonBuilder()
      .setCustomId('hexa:music:stop')
      .setLabel('Stop')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⏹️'),
    new ButtonBuilder()
      .setCustomId('hexa:music:replay')
      .setLabel('Putar lagi')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎵')
  );

  return [row1, row2];
}

function clip(s, max) {
  const v = String(s ?? '').trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1)}…`;
}

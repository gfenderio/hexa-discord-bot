import { resolveTrack } from './youtube.js';
import { enqueueAndPlay, buildAddedEmbed } from './engine.js';

export async function handlePlayCommand({ client, interaction }) {
  const query = interaction.options.getString('lagu', true).trim();
  if (!query) {
    await interaction.reply({ content: 'Isi judul atau link YouTube.', ephemeral: true });
    return;
  }

  const member = interaction.member;
  if (!member?.voice?.channel) {
    await interaction.reply({
      content: 'Join **voice channel** dulu, baru `/play`.',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply();

  try {
    const track = await resolveTrack(query, interaction.user.id);
    const result = await enqueueAndPlay({ client, interaction, track });

    if (result.started) {
      await interaction.editReply({
        content: `▶️ Memutar: **${track.title.slice(0, 120)}**`,
        embeds: []
      });
    } else {
      await interaction.editReply({
        embeds: [buildAddedEmbed({ track, position: result.position })]
      });
    }
  } catch (err) {
    console.error(err);
    const extra =
      err.message?.includes('FFmpeg') || err.message?.includes('ffmpeg')
        ? '\n\nInstall **FFmpeg** dan pastikan ada di PATH.'
        : '';
    await interaction.editReply({
      content: `Gagal putar: ${err.message ?? 'unknown'}${extra}`
    });
  }
}

export { handleMusicButton } from './engine.js';

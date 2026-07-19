import play from 'play-dl';
import { StreamType } from '@discordjs/voice';

let scInitialized = false;

async function initSC() {
  if (scInitialized) return;
  try {
    const id = await play.getFreeClientID();
    await play.setToken({ soundcloud: { client_id: id } });
    scInitialized = true;
  } catch (e) {
    console.error('Failed to init SC:', e);
  }
}

function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Resolve track natively using play-dl (SoundCloud source).
 * Extremely fast and bypasses YouTube blocks completely.
 */
export async function resolveTrack(query, requestedById) {
  let target = query.trim();

  if (isValidUrl(target) && (target.includes('youtube') || target.includes('youtu.be'))) {
    throw new Error('Sistem YouTube sedang ditutup sementara (diblokir anti-bot). Silakan putar menggunakan teks/judul lagu saja (contoh: /play green day).');
  }

  await initSC();

  let trackData = null;

  if (isValidUrl(target) && target.includes('soundcloud')) {
    try {
      const info = await play.soundcloud(target);
      trackData = info;
    } catch(e) {}
  }

  // Jika berupa teks atau bukan URL soundcloud yang valid, search di SoundCloud
  if (!trackData) {
    const results = await play.search(target, { source: { soundcloud: 'tracks' }, limit: 1 });
    if (!results || results.length === 0) {
      throw new Error('Lagu tidak ditemukan di database.');
    }
    trackData = results[0];
  }

  return {
    title: trackData.name || trackData.title || 'Unknown',
    url: trackData.url,
    streamUrl: trackData.url,
    durationSec: trackData.durationInSec || 0,
    channel: trackData.user?.name || trackData.channel?.name || 'SoundCloud',
    thumbnail: trackData.thumbnail || trackData.thumbnails?.[0]?.url || null,
    requestedBy: requestedById
  };
}

export async function createStreamResource(trackUrl, streamUrl) {
  try {
    const stream = await play.stream(trackUrl);
    return {
      src: {
        stream: stream.stream,
        type: stream.type
      }
    };
  } catch (e) {
    throw new Error('Gagal mengekstrak audio: ' + e.message);
  }
}

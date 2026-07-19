import { videoInfo, search } from 'youtube-ext';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { StreamType } from '@discordjs/voice';

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be');
  } catch (e) {
    return false;
  }
}

/**
 * Search YouTube and resolve to a track object.
 * Uses youtube-ext to bypass bot blocks.
 */
export async function resolveTrack(query, requestedById) {
  let url = query.trim();

  // If it's not a valid YouTube URL, search for it
  if (!isValidUrl(url)) {
    const res = await search(url, { filterType: 'video' });
    if (!res || !res.videos || res.videos.length === 0) {
      throw new Error('Lagu tidak ketemu di YouTube.');
    }
    url = res.videos[0].url;
  }

  const info = await videoInfo(url);

  if (!info || !info.stream) {
    throw new Error('Gagal memuat stream. Mungkin diblokir oleh YouTube atau video age-restricted.');
  }

  const adaptiveFormats = info.stream.adaptiveFormats || [];
  const audioFormats = adaptiveFormats.filter(f => f.mimeType && f.mimeType.includes('audio'));
  let streamUrl = null;
  if (audioFormats.length > 0) {
    streamUrl = audioFormats[0].url;
  } else if (info.stream.formats && info.stream.formats.length > 0) {
    streamUrl = info.stream.formats[0].url;
  } else {
    throw new Error('Tidak ada stream audio yang valid dari YouTube.');
  }

  // Parse duration
  let durationSec = 0;
  if (info.duration && info.duration.lengthSeconds) {
    durationSec = parseInt(info.duration.lengthSeconds, 10);
  }

  return {
    title: info.title ?? 'Unknown',
    url: info.url ?? url,
    streamUrl,
    durationSec,
    channel: info.channel?.name ?? 'YouTube',
    thumbnail: info.thumbnails?.[info.thumbnails.length - 1]?.url ?? null,
    requestedBy: requestedById
  };
}

export async function createStreamResource(trackUrl, streamUrl) {
  if (!streamUrl) throw new Error('Stream URL missing');

  // Pass URL directly to FFmpeg instead of piping via Node.js
  const ffmpeg = spawn(ffmpegPath, [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', streamUrl,
    '-analyzeduration', '0',
    '-loglevel', 'error',
    '-f', 's16le',
    '-ar', '48000',
    '-ac', '2',
    'pipe:1'
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  // Handle errors gracefully
  ffmpeg.stderr.on('data', (d) => {
    console.error('[FFMPEG STDERR]', d.toString().trim());
  });

  ffmpeg.on('error', (err) => {
    console.error('ffmpeg process error:', err.message);
  });

  return {
    src: {
      stream: ffmpeg.stdout,
      type: StreamType.Raw
    }
  };
}

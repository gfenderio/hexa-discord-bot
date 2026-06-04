import ytdl from 'ytdl-core-enhanced';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { StreamType } from '@discordjs/voice';

/**
 * Search YouTube and resolve to a track object.
 * Uses ytdl-core's getInfo + basic search via scraping.
 */
export async function resolveTrack(query, requestedById) {
  let url = query.trim();

  // If it's not a valid YouTube URL, search for it
  if (!ytdl.validateURL(url)) {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(url)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (!match) throw new Error('Lagu tidak ketemu di YouTube.');
    url = `https://www.youtube.com/watch?v=${match[1]}`;
  }

  const info = await ytdl.getInfo(url);
  const v = info.videoDetails;

  const audioFormats = info.formats.filter(f => f.mimeType && f.mimeType.includes('audio'));
  let streamUrl = null;
  if (audioFormats.length > 0) {
    streamUrl = audioFormats[0].url;
  } else if (info.formats.length > 0) {
    streamUrl = info.formats[0].url;
  } else {
    throw new Error('Tidak ada stream audio yang valid dari YouTube.');
  }

  return {
    title: v.title ?? 'Unknown',
    url: v.video_url ?? url,
    streamUrl,
    durationSec: parseInt(v.lengthSeconds, 10) || 0,
    channel: v.ownerChannelName ?? v.author?.name ?? 'YouTube',
    thumbnail: v.thumbnails?.[v.thumbnails.length - 1]?.url ?? null,
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

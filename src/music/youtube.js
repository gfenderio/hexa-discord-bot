import youtubedl from 'youtube-dl-exec';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { StreamType } from '@discordjs/voice';
import fs from 'node:fs';
import path from 'node:path';

function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Search YouTube and resolve to a track object using yt-dlp.
 */
export async function resolveTrack(query, requestedById) {
  let target = query.trim();

  if (!isValidUrl(target)) {
    target = `ytsearch1:${target}`;
  }

  const dlOptions = {
    dumpJson: true,
    noWarnings: true,
    noCheckCertificate: true,
    preferFreeFormats: true,
    referer: 'https://www.youtube.com/'
  };

  // Plan B: Use cookies.txt if exists
  const cookiePath = path.join(process.cwd(), 'cookies.txt');
  if (fs.existsSync(cookiePath)) {
    dlOptions.cookies = cookiePath;
  }

  let info;
  try {
    info = await youtubedl(target, dlOptions);
  } catch (err) {
    // Plan C: Fallback to SoundCloud if YouTube asks for Sign In
    if (err.message && err.message.includes('Sign in to confirm')) {
      if (target.startsWith('ytsearch1:')) {
        console.log('[MUSIC] YouTube blocked, falling back to SoundCloud for query:', target);
        const scTarget = target.replace('ytsearch1:', 'scsearch1:');
        info = await youtubedl(scTarget, dlOptions);
      } else {
        throw new Error('Video diblokir YouTube (Membutuhkan Sign in). Tambahkan cookies.txt di root folder server.');
      }
    } else {
      throw err;
    }
  }

  const videoData = info.entries ? info.entries[0] : info;

  if (!videoData) {
    throw new Error('Lagu tidak ketemu atau diblokir.');
  }

  const formats = videoData.formats || [];
  const audioFormats = formats.filter(f => f.acodec !== 'none' && f.vcodec === 'none');
  
  let streamUrl = null;
  if (audioFormats.length > 0) {
    // Sort by audio bitrate descending
    audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0));
    streamUrl = audioFormats[0].url;
  } else if (formats.length > 0) {
    streamUrl = formats[0].url;
  } else {
    streamUrl = videoData.url;
  }

  if (!streamUrl) {
    throw new Error('Tidak ada stream audio yang valid dari sumber ini.');
  }

  return {
    title: videoData.title ?? 'Unknown',
    url: videoData.webpage_url ?? videoData.url ?? query,
    streamUrl,
    durationSec: videoData.duration || 0,
    channel: videoData.uploader ?? videoData.channel ?? 'Unknown',
    thumbnail: videoData.thumbnail ?? null,
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

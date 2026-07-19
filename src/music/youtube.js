import play from 'play-dl';
import fs from 'node:fs';
import path from 'node:path';
import { StreamType } from '@discordjs/voice';

// Set up cookies once
const cookiePath = path.join(process.cwd(), 'cookies.txt');
if (fs.existsSync(cookiePath)) {
  try {
    const cookies = fs.readFileSync(cookiePath, 'utf8');
    const cookieParts = cookies.split('\n').filter(line => !line.startsWith('#') && line.trim() !== '' && line.includes('youtube.com'));
    const cookieStr = cookieParts.map(line => {
      const parts = line.split('\t');
      if (parts.length >= 7) {
        return `${parts[5]}=${parts[6]}`;
      }
      return '';
    }).filter(Boolean).join('; ');

    if (cookieStr) {
      play.setToken({
        youtube: {
          cookie: cookieStr
        }
      });
      console.log('[play-dl] Cookies berhasil dimuat dari cookies.txt');
    }
  } catch (e) {
    console.error('[play-dl] Gagal memuat cookies.txt:', e.message);
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

export async function resolveTrack(query, requestedById) {
  let target = query.trim();

  let videoData;
  try {
    if (!isValidUrl(target)) {
      const searchResults = await play.search(target, { limit: 1 });
      if (!searchResults || searchResults.length === 0) {
        throw new Error('Lagu tidak ketemu.');
      }
      videoData = searchResults[0];
    } else {
      const info = await play.video_info(target);
      videoData = info.video_details;
    }
  } catch (err) {
    console.error('[PLAY-DL ERROR]', err);
    throw new Error(`Gagal memproses lagu dari YouTube: ${err.message}`);
  }

  if (!videoData) {
    throw new Error('Lagu tidak ketemu atau diblokir.');
  }

  return {
    title: videoData.title ?? 'Unknown',
    url: videoData.url ?? query,
    durationSec: videoData.durationInSec || 0,
    channel: videoData.channel?.name ?? 'Unknown',
    thumbnail: videoData.thumbnails?.[0]?.url ?? null,
    requestedBy: requestedById
  };
}

export async function createStreamResource(trackUrl, _streamUrlIgnored) {
  if (!trackUrl) throw new Error('Track URL missing');

  try {
    const stream = await play.stream(trackUrl, { discordPlayerCompatibility: true });
    
    // Instead of using the raw stream which might fail inlineVolume due to WebmOpus,
    // we pipe it into FFmpeg to get a reliable Raw PCM stream for Discord.
    const { spawn } = await import('node:child_process');
    const ffmpegPath = (await import('ffmpeg-static')).default;

    const ffmpeg = spawn(ffmpegPath, [
      '-i', 'pipe:0',
      '-analyzeduration', '0',
      '-loglevel', 'error',
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1'
    ], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore']
    });

    stream.stream.pipe(ffmpeg.stdin);
    ffmpeg.stdin.on('error', () => {}); // Handle EPIPE when Discord stops reading early

    ffmpeg.on('error', (err) => {
      console.error('ffmpeg process error:', err.message);
    });

    return {
      src: {
        stream: ffmpeg.stdout,
        type: StreamType.Raw
      }
    };
  } catch (err) {
    console.error('play-dl stream error:', err.message);
    throw new Error(`Gagal membuat audio stream: ${err.message}`);
  }
}

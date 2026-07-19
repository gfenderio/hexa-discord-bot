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

// Inisialisasi SoundCloud Token
play.getFreeClientID().then((clientID) => {
    play.setToken({
      soundcloud : {
          client_id : clientID
      }
    });
    console.log('[play-dl] SoundCloud ClientID berhasil didapatkan');
}).catch(err => {
    console.error('[play-dl] Gagal mendapatkan SoundCloud ClientID:', err);
});

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
  let searchTitle = target;
  let fallbackThumbnail = null;

  console.log(`[Music] Memproses query: ${target}`);
  
  // Deteksi jika query adalah URL YouTube
  if (isValidUrl(target) && (target.includes('youtube.com') || target.includes('youtu.be'))) {
    try {
      // Ambil metadata dari YouTube untuk fallback pencarian di SoundCloud
      const info = await play.video_basic_info(target);
      searchTitle = info.video_details.title;
      fallbackThumbnail = info.video_details.thumbnails?.[0]?.url;
      console.log(`[Music] URL YouTube dideteksi. Judul asli: ${searchTitle}`);
    } catch (err) {
      console.log(`[Music] Gagal membaca metadata YouTube, menggunakan URL sebagai query.`);
    }
  }

  try {
    // Karena YouTube memblokir IP Datacenter/VPS (SABR / PO Token 403 Forbidden),
    // kita gunakan SoundCloud sebagai mesin pencari dan streaming utama agar bot tetap bersuara.
    console.log(`[Music] Mencari di SoundCloud: ${searchTitle}`);
    const searchResults = await play.search(searchTitle, { source: { soundcloud: 'tracks' }, limit: 5 });
    
    if (!searchResults || searchResults.length === 0) {
      throw new Error('Lagu tidak ditemukan di database.');
    }
    
    // Filter track yang merupakan preview (biasanya <= 30 detik untuk track premium)
    const fullTracks = searchResults.filter(t => t.durationInSec > 35);
    const scData = fullTracks.length > 0 ? fullTracks[0] : searchResults[0];
    
    console.log(`[Music] Lagu ditemukan di SoundCloud: ${scData.name} (${scData.url})`);

    return {
      title: scData.name ?? searchTitle ?? 'Unknown',
      url: scData.url, // URL track SoundCloud
      durationSec: scData.durationInSec || 0,
      channel: scData.publisher?.artist ?? 'SoundCloud',
      thumbnail: scData.thumbnail || fallbackThumbnail || null,
      requestedBy: requestedById
    };
  } catch (error) {
    console.error(`[Music] Error resolving track:`, error.message);
    throw new Error(`Gagal memproses lagu: ${error.message}`);
  }
}

export async function createStreamResource(trackUrl, _streamUrlIgnored) {
  if (!trackUrl) throw new Error('Track URL missing');

  try {
    // Kita mendapatkan stream dari play-dl (bekerja mulus untuk SoundCloud)
    const playStream = await play.stream(trackUrl);

    const { spawn } = await import('node:child_process');
    const ffmpegPath = (await import('ffmpeg-static')).default;

    // Kita jalankan FFmpeg manual agar output-nya raw PCM (s16le).
    // Hal ini memungkinkan Discord menangani inlineVolume: true dengan sempurna tanpa crash.
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

    // Pipe stream dari play-dl ke input FFmpeg
    playStream.stream.pipe(ffmpeg.stdin);

    ffmpeg.stdin.on('error', (err) => {
      if (err.code !== 'EPIPE') console.error('[FFmpeg stdin error]', err);
    });
    
    ffmpeg.on('error', (err) => {
      console.error('[FFmpeg Process Error]', err);
    });

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
      inlineVolume: true
    });

    // Set default volume
    if (resource.volume) {
      resource.volume.setVolume(1.0);
    }

    return resource;
  } catch (error) {
    console.error(`[Music] Stream Resource Error:`, error);
    throw new Error(`Gagal memuat stream audio: ${error.message}`);
  }
}

import ytdl from 'ytdl-core-enhanced';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

async function run() {
  console.log('Fetching info...');
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const info = await ytdl.getInfo(url);
  const audioFormats = info.formats.filter(f => f.mimeType && f.mimeType.includes('audio'));
  const streamUrl = audioFormats.length > 0 ? audioFormats[0].url : info.formats[0].url;

  console.log('Spawning ffmpeg...');
  const start = Date.now();
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

  ffmpeg.stderr.on('data', d => console.error(d.toString()));

  ffmpeg.stdout.once('data', () => {
    console.log(`First byte received after ${Date.now() - start}ms`);
    ffmpeg.kill();
  });
}

run().catch(console.error);

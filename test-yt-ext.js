import { videoInfo } from 'youtube-ext';

async function main() {
  try {
    const info = await videoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    const audioFormat = info.stream.adaptiveFormats.find(f => f.mimeType.startsWith('audio/webm'));
    console.log(audioFormat.url);
  } catch(err) {
    console.error(err);
  }
}
main();

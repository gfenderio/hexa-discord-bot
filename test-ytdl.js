import ytdl from '@distube/ytdl-core';

async function main() {
  try {
    const info = await ytdl.getInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log(info.videoDetails.title);
  } catch (err) {
    console.error('Error fetching youtube info:', err);
  }
}

main();

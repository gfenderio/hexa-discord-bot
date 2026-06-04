import ytdl from 'ytdl-core-enhanced';

async function main() {
  try {
    const info = await ytdl.getInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log('Title:', info.videoDetails.title);
    
    // Log the first format's URL
    if (info.formats.length > 0) {
      console.log('URL:', info.formats[0].url);
      console.log('URL available:', !!info.formats[0].url);
    }
  } catch(err) {
    console.error('Info error:', err);
  }
}
main();

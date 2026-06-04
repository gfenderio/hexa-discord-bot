import play from 'play-dl';

async function main() {
  try {
    const stream = await play.stream('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log('Stream Type:', stream.type);
    console.log('Stream URL available:', !!stream.stream);
    
    const info = await play.video_info('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    console.log('Title:', info.video_details.title);
  } catch(err) {
    console.error(err);
  }
}
main();

import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { openai } from './mb01.js';
import { executeTool } from './discord-tools.js';

let cronTask = null;

async function checkSchedule(client) {
  const channelId = '1513124311710302291';
  try {
    const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId);
    if (!channel) return;

    const todayDate = new Date().toISOString().split('T')[0];
    
    const prompt = `Anda adalah asisten olahraga cerdas. Tugas Anda mencari jadwal HARI INI (${todayDate}) untuk 4 entitas berikut:
1. Moto3
2. F1 (Formula 1)
3. Tim sepak bola Liverpool FC
4. Tim Nasional (Timnas) Sepak Bola Indonesia

Gunakan tool 'search_web' beberapa kali dengan berbagai kata kunci jika perlu. Cari jadwal terbaru HARI INI saja.
Setelah selesai mencari, kembalikan HANYA array JSON mentah tanpa blok markdown (\`\`\`json).
Format obyek JSON di dalam array:
{ "sport": "Kategori (contoh: F1/Liverpool)", "event": "Nama Event", "time": "Waktu mulai dalam format ISO 8601 dengan timezone (contoh: 2026-06-07T14:00:00+07:00 untuk WIB)" }

Jika hari ini tidak ada jadwal untuk suatu entitas, jangan masukkan ke array. Jika tidak ada jadwal sama sekali hari ini, kembalikan [].`;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'search_web',
          description: 'Lakukan pencarian web Google.',
          parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
        }
      }
    ];

    let messages = [{ role: 'user', content: prompt }];
    let jsonOutput = null;

    for (let i = 0; i < 7; i++) {
      const res = await openai.chat.completions.create({
        model: 'gemini/gemini-2.5-pro',
        messages,
        tools,
        temperature: 0.1
      });

      const msg = res.choices[0].message;
      messages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const call of msg.tool_calls) {
          if (call.function.name === 'search_web') {
            const args = JSON.parse(call.function.arguments);
            const toolRes = await executeTool('search_web', args, null, null);
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(toolRes) });
          }
        }
      } else if (msg.content) {
        jsonOutput = msg.content;
        break;
      }
    }

    if (jsonOutput) {
      const cleanedJson = jsonOutput.replace(/```json/i, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanedJson);
      const now = Date.now();
      
      const f1Cheers = [
        '\n\n🏎️ **Ayo dukung jagoan kita: Max Verstappen! Semongko!** 🏆',
        '\n\n🏎️ **Max Verstappen siap gaspol ninggalin yang lain!** 🏁',
        '\n\n🏎️ **Waktunya nonton Max Verstappen nge-drift di tikungan!** 🔥'
      ];
      const moto3Cheers = [
        '\n\n🏍️ **Gaspol terus Veda Pratama! Bawa harum nama bangsa!** 🇮🇩',
        '\n\n🏍️ **Veda Pratama siap melesat kencang! Jangan kasih kendor!** 🚀',
        '\n\n🏍️ **Ayo Veda! Tunjukkan nyali khas pebalap Indonesia!** 🇮🇩🔥'
      ];
      const liverpoolCheers = [
        '\n\n⚽ **YNWA! Ayo Liverpool bantai lawan malam ini!** 🔴',
        '\n\n⚽ **Anfield siap bergemuruh! Ayo The Reds!** 🔴🔥',
        '\n\n⚽ **Waktunya Liverpool panen gol! YNWA!** 🏆'
      ];
      const timnasCheers = [
        '\n\n🇮🇩 **GARUDA DI DADAKU! Wajib menang!** 🔥',
        '\n\n🇮🇩 **Ayo Timnas! Bikin bangga seluruh rakyat Indonesia!** 🦅',
        '\n\n🇮🇩 **Hantam lawanmu! Garuda siap terbang tinggi!** 🇮🇩⚽'
      ];

      for (const item of data) {
        const eventTime = new Date(item.time).getTime();
        if (isNaN(eventTime)) continue;

        // Calculate 15 minutes before
        const targetTime = eventTime - (15 * 60 * 1000);
        const waitMs = targetTime - now;

        const sportLower = item.sport.toLowerCase();
        let customCheer = '';
        if (sportLower.includes('f1') || sportLower.includes('formula')) customCheer = f1Cheers[Math.floor(Math.random() * f1Cheers.length)];
        if (sportLower.includes('moto3')) customCheer = moto3Cheers[Math.floor(Math.random() * moto3Cheers.length)];
        if (sportLower.includes('liverpool')) customCheer = liverpoolCheers[Math.floor(Math.random() * liverpoolCheers.length)];
        if (sportLower.includes('timnas') || sportLower.includes('indonesia')) customCheer = timnasCheers[Math.floor(Math.random() * timnasCheers.length)];

        const userPing = '<@419213146209779713>';
        const embedDescription = `Halo ${userPing}!\n**${item.event}** akan dimulai dalam **15 menit**! Bersiap-siap!${customCheer}`;
        const embedDescriptionImmediate = `Halo ${userPing}!\n**${item.event}** akan SEGERA DIMULAI! Bersiap-siap!${customCheer}`;

        // Only schedule if the reminder time is in the future, and within the next 24 hours
        if (waitMs > 0 && waitMs < 24 * 60 * 60 * 1000) {
          console.log(`[SportsReminder] Scheduled reminder for ${item.event} in ${waitMs} ms.`);
          setTimeout(() => {
            const embed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle(`🚨 PENGINGAT OLAHRAGA: ${item.sport}`)
              .setDescription(embedDescription)
              .setTimestamp(eventTime);
            channel.send({ content: userPing, embeds: [embed] }).catch(console.error);
          }, waitMs);
        } else if (waitMs <= 0 && eventTime > now) {
            // If it's already less than 15 minutes to start, send it immediately!
            const embed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle(`🚨 PENGINGAT OLAHRAGA: ${item.sport}`)
              .setDescription(embedDescriptionImmediate)
              .setTimestamp(eventTime);
            channel.send({ content: userPing, embeds: [embed] }).catch(console.error);
        }
      }
    }
  } catch (e) {
    console.error('[SportsReminder] Error:', e.message);
  }
}

export function startSportsReminder(client) {
  // Check every day at 00:15 server time
  cronTask = cron.schedule('15 0 * * *', () => {
    console.log('[SportsReminder] Running daily schedule check...');
    checkSchedule(client);
  });
  
  // Run once on startup just to be sure we don't miss today's events if bot restarts
  console.log('[SportsReminder] Running startup schedule check...');
  checkSchedule(client);
}

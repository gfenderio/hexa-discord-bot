import { EmbedBuilder } from 'discord.js';
import { ENV } from './env.js';
import { getGenAI, rotateKey, updateKeyUsage, getKeySignature, getCurrentKeyIndex } from './mb01.js';

// Map in-memory untuk menyimpan sesi obrolan Gemini per thread
const activeChats = new Map();

export function buildNugasWelcomeEmbed({ user, avatarUrl }) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 Sesi Tanya Jawab Hexa AI')
    .setColor(0x5865F2) // Sleek Discord Blue
    .setDescription(
      [
        `Halo **${user.username}**! Selamat datang di sesi obrolan pribadi dengan **Hexa AI** (didukung oleh *Gemini 1.5 Flash*).`,
        '',
        '💬 **Tanyakan apa saja di sini!**',
        '• Penjelasan materi kuliah / pelajaran',
        '• Pemecahan soal & perhitungan step-by-step',
        '• Pembuatan draft tulisan, esai, atau ringkasan',
        '• Penulisan & debugging kode pemrograman',
        '',
        '✨ *Sesi chat ini bersifat interaktif dan mengingat obrolan sebelumnya.*',
        '📝 *Ketik **`stop`** kapan saja untuk menutup sesi chat.*'
      ].join('\n')
    )
    .setAuthor(
      avatarUrl ? { name: user.username, iconURL: avatarUrl } : { name: user.username }
    )
    .setFooter({ text: 'Hexa AI — Study Assistant' })
    .setTimestamp();
  return embed;
}

export async function handleNugasMessage({ thread, messageText, topic }) {
  await thread.sendTyping();
  
  const maxAttempts = Math.max(ENV.GEMINI_API_KEYS.length, 3);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const key = ENV.GEMINI_API_KEYS[getCurrentKeyIndex()];
    const signature = getKeySignature(key);
    
    let chat = activeChats.get(thread.id);
    if (!chat) {
      chat = await initChatSession({ thread, topic });
      activeChats.set(thread.id, chat);
    }
    
    updateKeyUsage(signature, { used: true });
    
    try {
      const result = await chat.sendMessage(messageText);
      updateKeyUsage(signature, { success: true });
      const aiResponse = result.response.text();
      await sendLongMessage(thread, aiResponse);
      return;
    } catch (error) {
      const isRateLimit = error.message?.includes('429') || error.message?.includes('quota') || error.status === 429;
      updateKeyUsage(signature, { error: true, isRateLimit });
      
      if (isRateLimit) {
        console.warn(`[Nugas] Rate limit hit on key index ${getCurrentKeyIndex()}.`);
        
        if (rotateKey()) {
          await thread.send(`🔄 *Limit kuota terlampaui. Mengalihkan ke API Key cadangan...*`);
          activeChats.delete(thread.id); // Clear cache to recreate session with next key
          continue;
        } else {
          if (attempt < maxAttempts - 1) {
            console.warn(`[Nugas] No backup keys available. Waiting 60s...`);
            await thread.send(`⏳ *Kuota API habis. Menunggu 60 detik sebelum mencoba lagi...*`);
            await new Promise(resolve => setTimeout(resolve, 60000));
            continue;
          }
        }
      }
      
      throw error;
    }
  }
}

async function initChatSession({ thread, topic }) {
  const history = [];
  try {
    // Ambil riwayat chat maksimal 40 pesan terakhir
    const messages = await thread.messages.fetch({ limit: 40 });

    // Hapus pesan paling baru (karena itu pesan yang sedang kita proses/jawab saat ini)
    if (messages.size > 0) {
      messages.delete(messages.firstKey());
    }

    const sorted = [...messages.values()].reverse();

    for (const msg of sorted) {
      if (msg.system) continue;
      
      const text = msg.content?.trim();
      if (!text) continue;

      // Lewati pesan slash command atau system embed
      if (text.startsWith('/') || text.startsWith('!')) continue;

      const role = msg.author.bot ? 'model' : 'user';

      // Pastikan urutan berselingan user-model-user-model
      if (history.length > 0 && history[history.length - 1].role === role) {
        history[history.length - 1].parts[0].text += '\n' + text;
      } else {
        history.push({
          role,
          parts: [{ text }]
        });
      }
    }
  } catch (err) {
    console.error('⚠️ Gagal mengambil riwayat thread:', err);
  }

  // Saring history agar dimulai dengan pesan dari 'user' (Gemini API constraint)
  while (history.length > 0 && history[0].role !== 'user') {
    history.shift();
  }

  // Gemini mengharuskan urutan berselingan dan tidak boleh diakhiri oleh pesan 'user' sebelum chat dimulai
  if (history.length > 0 && history[history.length - 1].role === 'user') {
    history.pop();
  }

  const systemInstructionText = `Kamu adalah "Hexa AI", asisten belajar cerdas untuk kelompok studi UT Hexa.
Topik diskusi thread ini adalah: "${topic || 'Umum'}".
Tugasmu adalah menjawab pertanyaan mahasiswa secara interaktif, ramah, terstruktur, dan mudah dimengerti.
Gunakan emoji yang relevan untuk mempercantik tampilan jawaban.
Jika ditanya rumus atau soal perhitungan/koding, berikan langkah-langkah penyelesaian secara detail.
Gunakan Bahasa Indonesia yang sopan dan santai khas mahasiswa.
Batasi panjang jawaban agar tidak melebihi 1800 karakter supaya pas di Discord.`;

  const model = getGenAI().getGenerativeModel({ model: 'gemini-flash-latest' });
  return model.startChat({
    history,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
    systemInstruction: {
      parts: [{ text: systemInstructionText }]
    },
  });
}

async function sendLongMessage(channel, text) {
  const MAX_LENGTH = 2000;

  if (text.length <= MAX_LENGTH) {
    await channel.send(text);
    return;
  }

  const chunks = [];
  let currentChunk = '';

  for (const line of text.split('\n')) {
    if ((currentChunk + '\n' + line).length > MAX_LENGTH) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n' + line : line;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  for (const chunk of chunks) {
    await channel.send(chunk);
  }
}

function escapeInline(s) {
  return String(s).replaceAll('*', '\\*').replaceAll('_', '\\_').replaceAll('`', '\\`');
}

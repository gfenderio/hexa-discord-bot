import { EmbedBuilder } from 'discord.js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HISTORY_FETCH_LIMIT = 40;

const openai = new OpenAI({
  apiKey: "sk-router-dummy",
  baseURL: "http://localhost:20128/v1"
});

export function buildNugasWelcomeEmbed({ user, avatarUrl }) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 Sesi Tanya Jawab Hexa AI')
    .setColor(0x5865F2)
    .setDescription(
      [
        `Halo **${user.username}**! Selamat datang di sesi obrolan pribadi dengan **Hexa AI** (didukung oleh *Gemini Flash* via n9router).`,
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

async function sendLongMessage(thread, text) {
  const chunks = text.match(/[\s\S]{1,1900}/g) || [];
  for (const chunk of chunks) {
    await thread.send(chunk);
  }
}

export async function handleNugasMessage({ thread, messageText, topic }) {
  try {
    await thread.sendTyping();

    const messages = await thread.messages.fetch({ limit: HISTORY_FETCH_LIMIT });
    if (messages.size > 0) messages.delete(messages.firstKey()); // skip welcome
    const sorted = [...messages.values()].reverse();

    const history = [];

    let additionalSkills = '';
    try {
      additionalSkills = fs.readFileSync(path.join(__dirname, '..', 'skills', 'skills.md'), 'utf-8');
    } catch (e) {
      console.error('Failed to load skills:', e.message);
    }

    history.push({
      role: 'system',
      content: `Kamu adalah "Hexa AI", asisten belajar cerdas untuk kelompok studi UT Hexa.
Topik diskusi thread ini adalah: "${topic || 'Umum'}".
Tugasmu adalah menjawab pertanyaan mahasiswa secara interaktif, ramah, terstruktur, dan mudah dimengerti.
Gunakan emoji yang relevan untuk mempercantik tampilan jawaban.
Jika ditanya rumus atau soal perhitungan/koding, berikan langkah-langkah penyelesaian secara detail.

${additionalSkills}

Gunakan Bahasa Indonesia yang sopan dan santai khas mahasiswa.
Batasi panjang jawaban agar tidak melebihi 1800 karakter supaya pas di Discord.`
    });

    for (const msg of sorted) {
      if (msg.system) continue;
      const text = msg.content?.trim();
      if (!text) continue;
      if (text.startsWith('/') || text.startsWith('!')) continue;
      if (msg.author.bot && /^[🔄⏳❌]/.test(text)) continue;

      const role = msg.author.bot ? 'assistant' : 'user';
      history.push({ role, content: text });
    }

    history.push({ role: 'user', content: messageText });

    const response = await openai.chat.completions.create({
      model: 'gemini/gemini-2.5-flash',
      messages: history,
      temperature: 0.7
    });

    const aiResponse = response.choices[0].message.content;
    if (aiResponse) {
      if (aiResponse.length <= 2000) {
        await thread.send(aiResponse);
      } else {
        await sendLongMessage(thread, aiResponse);
      }
    }

  } catch (error) {
    console.error('❌ Error Nugas AI:', error);
    const msg = error.message || '';
    if (msg.includes('429') || msg.includes('quota')) {
      await thread.send(`⏳ *Semua API Key sedang sibuk atau kuota habis. Coba lagi sebentar.*`).catch(() => {});
    } else {
      await thread.send(`❌ *Gagal menghubungi AI (n9router).*`).catch(() => {});
    }
  }
}

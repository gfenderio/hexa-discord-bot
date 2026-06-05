import fs from 'fs';
import path from 'path';
import { EmbedBuilder } from 'discord.js';
import OpenAI from 'openai';
import { MB01_TOOLS_DECLARATION, executeMB01Tool } from './discord-tools.js';

const HISTORY_FETCH_LIMIT = 80;
const MAX_TOOL_ITERATIONS = 8;

// Create OpenAI client pointing to n9router
const openai = new OpenAI({
  apiKey: "sk-router-dummy", // n9router defaults don't require an API key for localhost
  baseURL: "http://localhost:20128/v1"
});

export function buildMB01WelcomeEmbed({ user, avatarUrl }) {
  return new EmbedBuilder()
    .setTitle('🤖 AI Assistant (Basecamp)')
    .setColor(0x2B2D31)
    .setDescription([
      `***User:** <@${user.id}>*`,
      '',
      'Halo! Saya adalah AI Assistant pribadi Anda. Saya siap membantu:',
      '• Menjawab berbagai pertanyaan umum & teknis',
      '• Merencanakan ide & strategi (termasuk merombak channel/Discord)',
      '• Menulis draft dokumen, pesan, atau kode pemrograman',
      '',
      '✨ *Saya mengingat semua percakapan di thread ini.*',
      '📝 *Ketik **`stop`** jika tugas sudah selesai dan Anda ingin menutup sesi.*'
    ].join('\n'))
    .setAuthor(avatarUrl ? { name: user.username, iconURL: avatarUrl } : { name: user.username })
    .setFooter({ text: 'AI Assistant via n9router' })
    .setTimestamp();
}

function discordizeMarkdown(text) {
  if (!text) return text;
  return text
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, '**$1**')
    .replace(/^~~~(\w*)?$/gm, '```$1')
    .replace(/^~~~$/gm, '```');
}

function diagnoseError(error) {
  const msg = error?.message ?? '';
  if (msg.includes('SAFETY') || msg.includes('safety')) return '⚠️ *Permintaan ditolak oleh safety filter.*';
  if (msg.includes('429') || msg.includes('quota')) return '⏳ *Semua API key di router kena rate-limit atau kuota harian. Coba lagi nanti.*';
  if (msg.includes('ECONNREFUSED')) return '🌐 *n9router sedang mati atau tidak bisa dihubungi di port 20128.*';
  const short = msg.slice(0, 200);
  return `❌ *Error: ${short || 'unknown'}*`;
}

async function sendLongMessage(thread, text) {
  const chunks = text.match(/[\s\S]{1,1900}/g) || [];
  for (const chunk of chunks) {
    await thread.send(chunk);
  }
}

export async function handleMB01Message({ thread, messageText, aiModel = 'lite', topic = 'mb01' }) {
  try {
    await thread.sendTyping();

    // Fetch history dynamically
    const messages = await thread.messages.fetch({ limit: HISTORY_FETCH_LIMIT });
    if (messages.size > 0) messages.delete(messages.firstKey()); // skip welcome embed
    const sorted = [...messages.values()].reverse();

    const history = [];
    
    // System Instruction
    let additionalSkills = '';
    try {
      additionalSkills = fs.readFileSync(path.join(process.cwd(), 'skills', 'skills.md'), 'utf-8');
    } catch { /* optional */ }

    history.push({
      role: 'system',
      content: `Kamu adalah Asisten AI profesional untuk basecamp startup/komunitas ini. Tugas utamamu adalah melayani pengguna dengan efisien, cerdas, dan sopan.
Karakteristikmu:
- Sangat profesional, berwawasan luas, dan langsung ke poin permasalahan (to-the-point).
- Bisa membantu hal teknis seperti programming, mengatur server Discord via fungsi, atau sekadar menjawab pertanyaan.
- Gunakan bahasa Indonesia baku namun tetap santai (tidak kaku).
Batasi panjang jawaban agar tidak melebihi 1800 karakter supaya pas di Discord.

${additionalSkills}`
    });

    for (const msg of sorted) {
      if (msg.system) continue;
      const text = msg.content?.trim();
      if (!text) continue;
      if (text.startsWith('/') || text.startsWith('!')) continue;
      if (msg.author.bot && /^[🔧⏳⚠️🌐🔑❌🔄🛑]/.test(text)) continue;

      const role = msg.author.bot ? 'assistant' : 'user';
      history.push({ role, content: text });
    }

    history.push({ role: 'user', content: messageText });

    // Map `aiModel` string to n9router supported models (using Vertex AI syntax from n9router docs)
    const modelToUse = aiModel === 'pro' ? 'vertex/gemini-1.5-pro-preview' : 'vertex/gemini-2.5-flash';

    let iterations = 0;
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      
      let typingInterval = null;
      try {
        await thread.sendTyping();
        typingInterval = setInterval(() => { thread.sendTyping().catch(() => {}); }, 7000);
      } catch { /* ignore */ }

      let response;
      try {
        response = await openai.chat.completions.create({
          model: modelToUse,
          messages: history,
          tools: MB01_TOOLS_DECLARATION,
          tool_choice: "auto",
          temperature: 0.8
        });
      } finally {
        if (typingInterval) clearInterval(typingInterval);
      }

      const message = response.choices[0].message;
      history.push(message);

      if (message.content) {
        const text = discordizeMarkdown(message.content);
        if (text.length <= 2000) await thread.send(text);
        else await sendLongMessage(thread, text);
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolNames = message.tool_calls.map(c => `\`${c.function.name}\``).join(', ');
        try { await thread.send(`🔧 *Menjalankan tool: ${toolNames}*`); } catch { /* ignore */ }

        for (const toolCall of message.tool_calls) {
          console.log(`[MB01] Executing tool: ${toolCall.function.name}`);
          const args = JSON.parse(toolCall.function.arguments);
          const toolResult = await executeMB01Tool(toolCall.function.name, args, { guild: thread.guild });
          
          history.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
      } else {
        break; // No more tool calls, exit loop
      }
    }
    
    if (iterations >= MAX_TOOL_ITERATIONS) {
      await thread.send(`⚠️ *Batas iterasi tool (${MAX_TOOL_ITERATIONS}) tercapai.*`);
    }

  } catch (error) {
    console.error('❌ Error Moody Blues AI:', error);
    await thread.send(diagnoseError(error)).catch(() => {});
  }
}

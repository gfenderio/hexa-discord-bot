import fs from 'fs';
import path from 'path';
import { EmbedBuilder } from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from './env.js';
import { MB01_TOOLS_DECLARATION, executeMB01Tool } from './discord-tools.js';
import { withDb, readDb } from './storage.js';

// ─── Constants ─────────────────────────────────────────────
const MAX_TOOL_ITERATIONS = 8;
const HISTORY_FETCH_LIMIT = 80;
const RATE_LIMIT_COOLDOWN_MS = 60_000;

export const STAND_NAMES = [
  'Highway Star',
  'Metallica',
  'Diver Down',
  'Weather Report',
  'Catch the Rainbow',
  'Paisley Park',
  'White Album',
  'Enigma',
  'Wonder of U',
  'Born This Way'
];

// ─── Round-robin pointer (display-only for /keys "Next up") ──
let currentKeyIndex = 0;
export function getCurrentKeyIndex() {
  return currentKeyIndex;
}
export function setCurrentKeyIndex(index) {
  currentKeyIndex = index;
}

// ─── Key utilities ─────────────────────────────────────────
export function getKeySignature(key) {
  if (!key || key.length <= 15) return key || 'unknown';
  return `${key.slice(0, 12)}...${key.slice(-6)}`;
}

export function isKeyRateLimited(key) {
  const signature = getKeySignature(key);
  try {
    const db = readDb();
    const until = db.apiKeyStats?.[signature]?.rateLimitedUntil;
    if (until && new Date(until) > new Date()) return true;
  } catch { /* ignore */ }
  return false;
}

export function isKeyQuotaExceeded(key, modelType) {
  const signature = getKeySignature(key);
  try {
    const db = readDb();
    const stats = db.apiKeyStats?.[signature];
    if (!stats) return false;
    const todayUTC = new Date().toISOString().slice(0, 10);
    if (stats.lastResetDate !== todayUTC) return false; // will reset on next write
    if (modelType === 'pro') return (stats.dailyProCalls || 0) >= 50;
    return (stats.dailyFlashCalls || 0) >= 1500;
  } catch { /* ignore */ }
  return false;
}

/**
 * Atomic key picker — returns key bundle for a specific request.
 * Tries from currentKeyIndex, advances pointer on success.
 * Returns null if no key available for given modelType.
 */
function pickKey(modelType) {
  const n = ENV.GEMINI_API_KEYS.length;
  for (let i = 0; i < n; i++) {
    const idx = (currentKeyIndex + i) % n;
    const key = ENV.GEMINI_API_KEYS[idx];
    if (key && !isKeyRateLimited(key) && !isKeyQuotaExceeded(key, modelType)) {
      currentKeyIndex = (idx + 1) % n; // advance for next request
      return { key, index: idx, signature: getKeySignature(key), modelType };
    }
  }
  return null;
}

/**
 * Pick key with auto-degrade: Pro → Flash if no Pro keys available.
 * Returns { bundle, degradedFrom } — degradedFrom is null if no degrade happened.
 */
function pickKeyWithDegrade(requestedModel) {
  let bundle = pickKey(requestedModel);
  if (bundle) return { bundle, degradedFrom: null };

  // Auto-degrade Pro → Flash
  if (requestedModel === 'pro') {
    bundle = pickKey('lite');
    if (bundle) return { bundle, degradedFrom: 'pro' };
  }
  return { bundle: null, degradedFrom: null };
}

// Backward-compat export (used elsewhere)
export function getGenAI(modelType = 'lite') {
  const { bundle } = pickKeyWithDegrade(modelType);
  if (!bundle) {
    const fallback = ENV.GEMINI_API_KEYS[currentKeyIndex];
    if (!fallback) throw new Error('No Gemini API Key configured.');
    return new GoogleGenerativeAI(fallback);
  }
  return new GoogleGenerativeAI(bundle.key);
}

// ─── Stats tracking ────────────────────────────────────────
export function updateKeyUsage(signature, { used, success, error, isRateLimit, latency, modelType }) {
  try {
    withDb((db) => {
      db.apiKeyStats ??= {};
      db.apiKeyHistory ??= {};
      if (!db.apiKeyStats[signature]) {
        db.apiKeyStats[signature] = {
          successCount: 0,
          errorCount: 0,
          useCount: 0,
          rateLimitedUntil: null,
          lastUsed: null,
          totalLatency: 0,
          avgLatency: 0,
          dailyFlashCalls: 0,
          dailyProCalls: 0,
          lastResetDate: new Date().toISOString().slice(0, 10)
        };
      }
      const stats = db.apiKeyStats[signature];
      const todayUTC = new Date().toISOString().slice(0, 10);

      // Snapshot previous day before reset (for weekly report)
      if (stats.lastResetDate && stats.lastResetDate !== todayUTC) {
        db.apiKeyHistory[signature] ??= {};
        db.apiKeyHistory[signature][stats.lastResetDate] = {
          flash: stats.dailyFlashCalls || 0,
          pro: stats.dailyProCalls || 0
        };
        stats.dailyFlashCalls = 0;
        stats.dailyProCalls = 0;
        stats.lastResetDate = todayUTC;
      }

      if (used) {
        stats.useCount = (stats.useCount || 0) + 1;
        stats.lastUsed = new Date().toISOString();
        if (modelType === 'pro') stats.dailyProCalls = (stats.dailyProCalls || 0) + 1;
        else stats.dailyFlashCalls = (stats.dailyFlashCalls || 0) + 1;
      }
      if (success) {
        stats.successCount = (stats.successCount || 0) + 1;
        if (latency !== undefined) {
          stats.totalLatency = (stats.totalLatency || 0) + latency;
          stats.avgLatency = Math.round(stats.totalLatency / stats.successCount);
        }
      }
      if (error) {
        stats.errorCount = (stats.errorCount || 0) + 1;
        if (isRateLimit) {
          stats.rateLimitedUntil = new Date(Date.now() + RATE_LIMIT_COOLDOWN_MS).toISOString();
        }
      }
      return db;
    });
  } catch (err) {
    console.error('⚠️ Gagal memperbarui stats API key di DB:', err);
  }
}

// ─── Chat session cache ────────────────────────────────────
// Map<threadId, { chat, signature, modelType }>
const activeChats = new Map();

// ─── Embed builder ─────────────────────────────────────────
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
    .setFooter({ text: 'AI Assistant' })
    .setTimestamp();
}

// ─── Markdown post-processing (Gemini → Discord) ───────────
function discordizeMarkdown(text) {
  if (!text) return text;
  return text
    // ATX headers (# Title, ## Title, etc.) → bold
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, '**$1**')
    // ~~~lang fences → ```lang
    .replace(/^~~~(\w*)?$/gm, '```$1')
    .replace(/^~~~$/gm, '```');
}

// ─── Error diagnosis ───────────────────────────────────────
function diagnoseError(error) {
  const msg = error?.message ?? '';
  const status = error?.status ?? error?.code;
  if (msg.includes('SAFETY') || msg.includes('safety')) {
    return '⚠️ *Permintaan ditolak oleh safety filter Gemini.*';
  }
  if (status === 429 || msg.includes('429') || msg.includes('quota')) {
    return '⏳ *Semua API key kena rate-limit atau kuota harian. Coba lagi nanti.*';
  }
  if (status === 'ENOTFOUND' || status === 'ETIMEDOUT' || msg.includes('fetch failed')) {
    return '🌐 *Network error saat menghubungi Google AI. Cek koneksi.*';
  }
  if (msg.includes('API key not valid')) {
    return '🔑 *API key tidak valid. Cek konfigurasi `GEMINI_API_KEY` di `.env`.*';
  }
  const short = msg.slice(0, 200);
  return `❌ *Error: ${short || 'unknown'}*`;
}

// ─── Session init ──────────────────────────────────────────
async function initChatSession({ thread, modelType, signature }) {
  // Fetch thread history
  const history = [];
  try {
    const messages = await thread.messages.fetch({ limit: HISTORY_FETCH_LIMIT });
    if (messages.size > 0) messages.delete(messages.firstKey()); // skip welcome
    const sorted = [...messages.values()].reverse();

    for (const msg of sorted) {
      if (msg.system) continue;
      const text = msg.content?.trim();
      if (!text) continue;
      if (text.startsWith('/') || text.startsWith('!')) continue;
      // Skip our own status messages (tool indicators, errors, etc.)
      if (msg.author.bot && /^[🔧⏳⚠️🌐🔑❌🔄🛑]/.test(text)) continue;

      const role = msg.author.bot ? 'model' : 'user';
      if (history.length > 0 && history[history.length - 1].role === role) {
        history[history.length - 1].parts[0].text += '\n' + text;
      } else {
        history.push({ role, parts: [{ text }] });
      }
    }
  } catch (err) {
    console.error('⚠️ Gagal mengambil riwayat thread MB01:', err);
  }

  while (history.length > 0 && history[0].role !== 'user') history.shift();
  if (history.length > 0 && history[history.length - 1].role === 'user') history.pop();

  // System instruction (basecamp persona only — arcade removed)
  let additionalSkills = '';
  try {
    additionalSkills = fs.readFileSync(path.join(process.cwd(), 'skills.md'), 'utf-8');
  } catch { /* optional */ }

  const systemInstructionText =
    `Kamu adalah Asisten AI profesional untuk basecamp startup/komunitas ini. Tugas utamamu adalah melayani pengguna dengan efisien, cerdas, dan sopan.
Karakteristikmu:
- Sangat profesional, berwawasan luas, dan langsung ke poin permasalahan (to-the-point).
- Bisa membantu hal teknis seperti programming, mengatur server Discord via fungsi, atau sekadar menjawab pertanyaan.
- Gunakan bahasa Indonesia baku namun tetap santai (tidak kaku).
Batasi panjang jawaban agar tidak melebihi 1800 karakter supaya pas di Discord.

${additionalSkills}`;

  const modelName = modelType === 'pro' ? 'gemini-2.5-pro' : 'gemini-flash-latest';
  const maxOutputTokens = modelType === 'pro' ? 8192 : 2048;

  // Build GenAI client bound to the specific key we picked
  const keyForSession = ENV.GEMINI_API_KEYS.find(k => getKeySignature(k) === signature);
  const genAI = new GoogleGenerativeAI(keyForSession);
  const model = genAI.getGenerativeModel({
    model: modelName,
    tools: [{ functionDeclarations: MB01_TOOLS_DECLARATION }]
  });

  return model.startChat({
    history,
    generationConfig: { maxOutputTokens, temperature: 0.8 },
    systemInstruction: { parts: [{ text: systemInstructionText }] }
  });
}

// ─── Non-streaming send + display ──────────────────────────
/**
 * Sends content to Gemini, displays the response in the thread.
 * Returns the Gemini response object (so caller can check functionCalls).
 *
 * Note: Uses non-streaming `sendMessage` instead of `sendMessageStream`.
 * The SDK's streaming variant has a race condition with function-calling
 * (chat history not properly recorded → next turn errors with
 * "function response turn comes immediately after a function call turn").
 */
async function sendGeminiResponse({ thread, chat, content }) {
  // Keep typing indicator alive during the request
  let typingInterval = null;
  try {
    await thread.sendTyping();
    typingInterval = setInterval(() => {
      thread.sendTyping().catch(() => {});
    }, 7000);
  } catch { /* ignore */ }

  let result;
  try {
    result = await chat.sendMessage(content);
  } finally {
    if (typingInterval) clearInterval(typingInterval);
  }

  const response = result.response;
  let text = '';
  try { text = response.text?.() ?? ''; } catch { text = ''; }
  text = discordizeMarkdown(text);

  if (text) {
    if (text.length <= 2000) await thread.send(text);
    else await sendLongMessage(thread, text);
  }
  // (If empty, it was a function-call-only turn — no message to display.)

  return response;
}

// ─── Main message handler ──────────────────────────────────
export async function handleMB01Message({ thread, messageText, aiModel = 'lite', topic = 'mb01' }) {
  try {
    await thread.sendTyping();

    // Ensure we have an active chat session
    let session = activeChats.get(thread.id);
    if (!session) {
      const { bundle, degradedFrom } = pickKeyWithDegrade(aiModel);
      if (!bundle) {
        await thread.send('⏳ *Semua API key kena rate-limit atau habis kuota. Tunggu sebentar...*');
        return;
      }
      if (degradedFrom) {
        await thread.send(`🔄 *Kuota **${degradedFrom.toUpperCase()}** habis di semua Stand. Auto-degrade ke **${bundle.modelType.toUpperCase()}**.*`);
      }
      const chat = await initChatSession({
        thread,
        modelType: bundle.modelType,
        signature: bundle.signature
      });
      session = { chat, signature: bundle.signature, modelType: bundle.modelType };
      activeChats.set(thread.id, session);
    }

    let result = await sendWithRotation({ thread, session, content: messageText });
    if (!result) return; // rotation gave up

    // Function-call loop (capped)
    let calls;
    try { calls = result.functionCalls?.(); } catch { calls = undefined; }

    let iterations = 0;
    while (calls && calls.length > 0) {
      if (iterations >= MAX_TOOL_ITERATIONS) {
        await thread.send(`⚠️ *Batas iterasi tool (${MAX_TOOL_ITERATIONS}) tercapai. Menghentikan eksekusi otomatis untuk mencegah loop.*`);
        break;
      }
      iterations++;

      // Show what tools are being executed (transparency)
      const toolNames = calls.map(c => `\`${c.name}\``).join(', ');
      try { await thread.send(`🔧 *Menjalankan tool: ${toolNames}*`); } catch { /* ignore */ }

      const functionResponses = [];
      for (const call of calls) {
        console.log(`[MB01] Executing tool: ${call.name}`, call.args);
        const response = await executeMB01Tool(call.name, call.args, { guild: thread.guild });
        functionResponses.push({
          functionResponse: { name: call.name, response }
        });
      }

      await thread.sendTyping();
      result = await sendWithRotation({ thread, session: activeChats.get(thread.id), content: functionResponses });
      if (!result) return;
      try { calls = result.functionCalls?.(); } catch { calls = undefined; }
    }
  } catch (error) {
    console.error('❌ Error Moody Blues AI:', error);
    await thread.send(diagnoseError(error)).catch(() => {});
  }
}

/**
 * Sends content via session with rate-limit rotation + degrade.
 * Mutates activeChats if rotation/degrade occurs.
 * Returns Gemini response, or null if exhausted.
 */
async function sendWithRotation({ thread, session, content }) {
  const maxAttempts = Math.max(ENV.GEMINI_API_KEYS.length + 1, 3);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const sig = session.signature;
    const modelType = session.modelType;

    updateKeyUsage(sig, { used: true, modelType });
    const start = Date.now();

    try {
      const response = await sendGeminiResponse({ thread, chat: session.chat, content });
      const latency = Date.now() - start;
      updateKeyUsage(sig, { success: true, latency, modelType });
      return response;
    } catch (error) {
      const latency = Date.now() - start;
      const msg = error?.message ?? '';
      const status = error?.status;
      const isRateLimit = status === 429 || msg.includes('429') || msg.includes('quota');
      updateKeyUsage(sig, { error: true, isRateLimit, latency, modelType });

      if (!isRateLimit) throw error;

      console.warn(`[MB01] Rate limit on key ${sig} (${modelType}). Attempt ${attempt + 1}/${maxAttempts}`);

      // Try to pick a fresh key (with auto-degrade)
      const { bundle, degradedFrom } = pickKeyWithDegrade(modelType);
      if (!bundle) {
        await thread.send('⏳ *Semua Stand kena rate-limit. Menyerah untuk request ini — coba lagi 60 detik lagi.*').catch(() => {});
        return null;
      }

      if (degradedFrom) {
        await thread.send(`🔄 *Rotate + auto-degrade: **${degradedFrom.toUpperCase()}** → **${bundle.modelType.toUpperCase()}**.*`).catch(() => {});
      } else {
        await thread.send(`🔄 *Limit kuota terlampaui. Rotate ke Stand cadangan...*`).catch(() => {});
      }

      // Rebuild session with new key
      const newChat = await initChatSession({
        thread,
        modelType: bundle.modelType,
        signature: bundle.signature
      });
      session = { chat: newChat, signature: bundle.signature, modelType: bundle.modelType };
      activeChats.set(thread.id, session);
    }
  }

  return null;
}

// ─── Utility: long message splitter ────────────────────────
async function sendLongMessage(channel, text) {
  const MAX = 2000;
  if (text.length <= MAX) {
    await channel.send(text);
    return;
  }
  const chunks = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if ((cur + '\n' + line).length > MAX) {
      if (cur) chunks.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + '\n' + line : line;
    }
  }
  if (cur) chunks.push(cur);
  for (const chunk of chunks) await channel.send(chunk);
}

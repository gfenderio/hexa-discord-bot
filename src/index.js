// Import ffmpeg-static first — sets process.env.FFMPEG_PATH so @discordjs/voice finds it
import ffmpegPath from 'ffmpeg-static';
process.env.FFMPEG_PATH = ffmpegPath;

import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');


import {
  ActionRowBuilder,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sodium = require('libsodium-wrappers');
import { ENV } from './env.js';
import { startStandupScheduler } from './schedulers/standup.js';
import { withDb } from './storage.js';
import { buildMB01WelcomeEmbed, handleMB01Message } from './mb01.js';
import { handleMusicButton, handlePlayCommand } from './music/handlers.js';
import { addNotionTask, getPendingTasks } from './notion.js';

const enableMessageContent = String(process.env.ENABLE_MESSAGE_CONTENT ?? '')
  .trim()
  .toLowerCase() === '1';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    ...(enableMessageContent ? [GatewayIntentBits.MessageContent] : [])
  ]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  startStandupScheduler(readyClient);
  
  import('./webhook.js').then(module => {
    module.startWebhookServer(readyClient);
  }).catch(err => console.error('Failed to load webhook server:', err));
});

client.on(Events.InteractionCreate, async (interaction) => {
  const OWNER_ID = '419213146209779713';
  if (interaction.user.id !== OWNER_ID) {
    try {
      const msg = '❌ **Access Denied.** Bot ini dikonfigurasi secara eksklusif untuk Owner Basecamp (<@419213146209779713>).';
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: msg });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    } catch {
      /* ignore */
    }
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('hexa:music:')) {
    try {
      await handleMusicButton({ client, interaction });
    } catch (err) {
      console.error(err);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Error kontrol musik.', ephemeral: true });
        }
      } catch {
        /* ignore */
      }
    }
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('regen_img:')) {
    try {
      await interaction.deferReply();
      const base64Prompt = interaction.customId.split(':')[1];
      const prompt = Buffer.from(base64Prompt, 'base64').toString('utf8');
      
      const seed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&nologo=true`;
      
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      const embed = new EmbedBuilder()
        .setTitle('🎨 Hasil Generate Gambar (Ulang)')
        .setImage(imageUrl)
        .setFooter({ text: `Prompt: ${prompt}` })
        .setColor(0x5865F2);
        
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`regen_img:${base64Prompt}`)
          .setLabel('🔄 Buat Ulang')
          .setStyle(ButtonStyle.Primary)
      );
      
      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (e) {
      console.error(e);
      await interaction.editReply({ content: 'Gagal meregenerate gambar.' });
    }
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('task_done:')) {
    try {
      await interaction.deferReply();
      const taskId = interaction.customId.split(':')[1];
      const { updateNotionTaskStatus } = await import('./notion.js');
      await updateNotionTaskStatus(taskId, 'Done');
      await interaction.editReply({ content: `✅ Task berhasil ditandai selesai!` });
      // Remove the button from the original message if possible
      try {
        await interaction.message.edit({ components: [] });
      } catch (err) {}
    } catch (e) {
      console.error(e);
      await interaction.editReply({ content: 'Gagal menyelesaikan task.' });
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId !== 'standup_modal_v1') return;

    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId ?? 'dm';
    const done = interaction.fields.getTextInputValue('done').trim();
    const doing = interaction.fields.getTextInputValue('doing').trim();
    const blocker = interaction.fields.getTextInputValue('blocker').trim();
    const eta = interaction.fields.getTextInputValue('eta').trim();

    const createdAt = new Date().toISOString();
    const createdBy = interaction.user.id;

    let channelId = null;
    let standupId = null;
    withDb((db) => {
      db.config ??= {};
      db.config[guildId] ??= {};
      channelId = db.config[guildId].standupChannelId ?? interaction.channelId;

      db.standups ??= {};
      db.standups[guildId] ??= [];
      const nextId =
        db.standups[guildId].reduce((m, s) => Math.max(m, s.id), 0) + 1;
      standupId = nextId;
      db.standups[guildId].push({
        id: nextId,
        done,
        doing,
        blocker,
        eta,
        createdAt,
        createdBy
      });
      return db;
    });

    const embed = new EmbedBuilder()
      .setTitle('🌅 Daily Standup')
      .setColor(0x57F287)
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL()
      })
      .addFields(
        { name: '✅ Done', value: done ? `> ${done.replace(/\n/g, '\n> ')}` : '> -', inline: false },
        { name: '🚀 Doing', value: doing ? `> ${doing.replace(/\n/g, '\n> ')}` : '> -', inline: false },
        { name: '🛑 Blocker', value: blocker ? `> ${blocker.replace(/\n/g, '\n> ')}` : '> -', inline: false },
        { name: '⏱️ ETA', value: eta ? `\`${eta}\`` : '`Tidak ada`', inline: true }
      )
      .setFooter({ text: `Standup ID #${standupId}` })
      .setTimestamp(new Date(createdAt));

    try {
      const channel = await client.channels.fetch(channelId);
      if (channel && 'send' in channel) {
        await channel.send({ embeds: [embed] });
      }
    } catch (e) {
      console.error(e);
    }

    await interaction.editReply({ content: 'Standup terkirim.' });
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'ping') {
      const pingEmbed = new EmbedBuilder()
        .setTitle('🏓 Pong!')
        .setDescription(`**Latency:** \`${Date.now() - interaction.createdTimestamp}ms\`\n**API:** \`${Math.round(client.ws.ping)}ms\``)
        .setColor(0x5865F2);
      await interaction.reply({ embeds: [pingEmbed], ephemeral: true });
      return;
    }

    if (interaction.commandName === 'keys') {
      const embed = new EmbedBuilder()
        .setTitle('🛰️ n9router Gateway Dashboard')
        .setColor(0x0F172A)
        .setDescription(
          [
            `Manajemen 5 API Key Gemini (Stand) sekarang sudah dipindahkan ke sistem **n9router** terpusat yang berjalan non-stop.`,
            ``,
            `🔗 **Buka Dashboard Admin:**`,
            `[http://68.183.176.67:20128](http://68.183.176.67:20128)`,
            ``,
            `Di dashboard tersebut, kamu bisa:`,
            `• Menambahkan/mengubah API Key baru`,
            `• Melihat statistik penggunaan dan kuota per kunci`,
            `• Mengubah strategi rotasi (Round-robin / Failover)`
          ].join('\n')
        )
        .setFooter({ text: 'n9router Pool Monitor • Moody Blues' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'standup') {
      const modal = new ModalBuilder()
        .setCustomId('standup_modal_v1')
        .setTitle('🌅 Daily Standup');

      const done = new TextInputBuilder()
        .setCustomId('done')
        .setLabel('✅ Done (Kemarin/Baru selesai)')
        .setPlaceholder('Contoh: Selesai setup VPS')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);

      const doing = new TextInputBuilder()
        .setCustomId('doing')
        .setLabel('🚀 Doing (Fokus hari ini)')
        .setPlaceholder('Contoh: Bikin fitur router')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      const blocker = new TextInputBuilder()
        .setCustomId('blocker')
        .setLabel('🛑 Blocker (Hambatan)')
        .setPlaceholder('Contoh: Belum ngerti auth')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);

      const eta = new TextInputBuilder()
        .setCustomId('eta')
        .setLabel('⏱️ ETA (Perkiraan Selesai)')
        .setPlaceholder('Contoh: Nanti malam')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(200);

      modal.addComponents(
        new ActionRowBuilder().addComponents(done),
        new ActionRowBuilder().addComponents(doing),
        new ActionRowBuilder().addComponents(blocker),
        new ActionRowBuilder().addComponents(eta)
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.commandName === 'play') {
      await handlePlayCommand({ client, interaction });
      return;
    }

    if (interaction.commandName === 'task') {
      await interaction.deferReply();
      const sub = interaction.options.getSubcommand();
      
      if (sub === 'add') {
        const name = interaction.options.getString('nama');
        const urgency = interaction.options.getString('urgency') || 'Medium';
        await addNotionTask(name, urgency);
        await interaction.editReply(`✅ Tugas **${name}** [${urgency}] ditambahkan ke Notion Tracker!`);
      } else if (sub === 'list') {
        const tasks = await getPendingTasks();
        if (!tasks.length) {
          await interaction.editReply('🎉 Tidak ada tugas yang tertunda. Kerja bagus!');
        } else {
          const list = tasks.map(t => {
            const title = t.properties['Task Name'].title[0]?.plain_text || 'Untitled';
            const urgency = t.properties['Urgency'].select?.name || 'Low';
            const status = t.properties['Status'].status?.name || 'To-Do';
            const emoji = urgency === 'High' ? '🔴' : (urgency === 'Medium' ? '🟡' : '🟢');
            return `${emoji} **${title}** (${status})`;
          }).join('\n');
          
          const components = [];
          if (tasks.length > 0) {
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
            const row = new ActionRowBuilder();
            for (let i = 0; i < Math.min(tasks.length, 5); i++) {
              const t = tasks[i];
              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`task_done:${t.id}`)
                  .setLabel(`✅ Selesai #${i+1}`)
                  .setStyle(ButtonStyle.Success)
              );
            }
            components.push(row);
          }
          await interaction.editReply({ content: `📋 **Daftar Tugas Hexa:**\n${list}`, components });
        }
      }
      return;
    }

    if (interaction.commandName === 'record') {
      await interaction.deferReply();
      const action = interaction.options.getString('action');
      if (action === 'start') {
        const member = interaction.member;
        if (!member.voice.channel) {
          await interaction.editReply('❌ Anda harus berada di dalam Voice Channel terlebih dahulu!');
          return;
        }
        await interaction.editReply(`🎙️ **Merekam Meeting dimulai** di <#${member.voice.channelId}>.\n*(Catatan: Fitur Voice-to-Text membutuhkan dependensi Audio Mixer (PCM Muxing) yang berat untuk RAM VPS 1GB. Saat ini fitur berjalan dalam mode Experimental/Mock).*`);
      } else {
        await interaction.editReply(`✅ **Rekaman Selesai.**\nSedang memproses notulensi... (Mocking AI Transcript)\n\n📝 **Notulensi Meeting (Simulasi):**\n- Tim sepakat untuk menggunakan struktur DB baru di Notion.\n- Deployment fitur Webhook akan dilakukan malam ini.\n- Tidak ada blocker utama sejauh ini.`);
      }
      return;
    }

    if (interaction.commandName === 'mb01') {
      if (!interaction.inGuild()) {
        await interaction.reply({
          content: 'Command ini hanya bisa dipakai di server (bukan DM).',
          ephemeral: true
        });
        return;
      }

      let baseChannel = interaction.channel;
      if (baseChannel?.isThread?.()) {
        baseChannel = baseChannel.parent;
      }
      if (!baseChannel || !baseChannel.isTextBased?.() || !('threads' in baseChannel)) {
        await interaction.reply({
          content:
            'Jalankan command di **channel teks** (bukan voice/category). Channel harus bisa bikin thread.',
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const safeUser = (interaction.user.username || 'user')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 20);
      const threadName = `🤖│ai-${safeUser}`.slice(0, 100);

      const thread = await baseChannel.threads.create({
        name: threadName,
        autoArchiveDuration: 1440,
        reason: `AI Chatbox for ${interaction.user.tag}`
      });

      const selectedModel = interaction.options.getString('model') || 'lite';
      
      withDb((db) => {
        db.mb01Threads ??= {};
        db.mb01Threads[thread.id] = {
          guildId: interaction.guildId,
          channelId: baseChannel.id,
          ownerUserId: interaction.user.id,
          topic: 'mb01',
          model: selectedModel,
          createdAt: new Date().toISOString()
        };
        return db;
      });

      const avatarUrl = interaction.user.displayAvatarURL({ size: 128 });
      const welcomeEmbed = buildMB01WelcomeEmbed({ user: interaction.user, avatarUrl });
        
      await thread.send({
        content: `<@${interaction.user.id}>`,
        embeds: [welcomeEmbed]
      });

      if (!enableMessageContent) {
        await thread.send(
          'Catatan: untuk mode chat tanpa command, enable **Message Content Intent** di Developer Portal lalu set env `ENABLE_MESSAGE_CONTENT=1`.'
        );
      }

      await interaction.editReply({
        content: `🤖 AI Assistant siap: <#${thread.id}>`
      });
      return;
    }

    await interaction.reply({
      content: 'Command belum didukung.',
      ephemeral: true
    });
  } catch (err) {
    console.error(err);
    const hint =
      err?.code === 50013
        ? '\n\nBot butuh permission: **Create Public Threads**, **Send Messages in Threads**, **Send Messages**.'
        : '';
    const msg = `Ada error: ${err?.message ?? 'unknown'}${hint}`;
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: msg.slice(0, 1900) });
      } else {
        await interaction.reply({ content: msg.slice(0, 1900), ephemeral: true });
      }
    } catch {
      // ignore double-reply
    }
  }
});

await sodium.ready;
client.login(ENV.DISCORD_TOKEN);

client.on(Events.MessageCreate, async (message) => {
  try {
    if (!enableMessageContent) return;
    if (!message.guildId) return;
    if (!message.channel?.isThread?.()) return;
    if (message.author.bot) return;
    if (message.author.id !== '419213146209779713') return;

    let metaMb01 = null;
    withDb((db) => {
      metaMb01 = db.mb01Threads?.[message.channelId] ?? null;
      return db;
    });
    
    if (!metaMb01) return;

    const text = message.content?.trim() ?? '';
    const hasAttachments = message.attachments.size > 0;
    if (!text && !hasAttachments) return;

    if (text.toLowerCase() === 'stop') {
      await message.reply('🛑 **Menutup sesi...** Thread ini akan dihapus otomatis dalam 5 detik agar server tetap bersih dan rapi.');
      setTimeout(async () => {
        try {
          await message.channel.delete('Sesi ditutup oleh user mengetik stop');
        } catch (err) {
          console.error('⚠️ Gagal menghapus thread:', err);
        }
      }, 5000);
      return;
    }

    if (metaMb01) {
      await handleMB01Message({
        thread: message.channel,
        messageText: text,
        messageAttachments: message.attachments,
        aiModel: metaMb01.model || 'lite',
        topic: metaMb01.topic
      });
    }
  } catch (e) {
    console.error(e);
  }
});

client.on(Events.ThreadDelete, async (thread) => {
  try {
    withDb((db) => {
      if (db.mb01Threads && db.mb01Threads[thread.id]) {
        delete db.mb01Threads[thread.id];
        console.log(`🗑️ Thread ${thread.id} dihapus dari Discord. Membersihkan database metadata.`);
      }
      return db;
    });
  } catch (err) {
    console.error('⚠️ Gagal membersihkan thread metadata saat dihapus:', err);
  }
});

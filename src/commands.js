import { SlashCommandBuilder } from 'discord.js';

export const COMMANDS = [
  new SlashCommandBuilder().setName('ping').setDescription('Check bot status & latency'),

  new SlashCommandBuilder()
    .setName('keys')
    .setDescription('Melihat status dan performa dari API Key Gemini')
    .addStringOption((o) =>
      o
        .setName('view')
        .setDescription('Pilih tampilan (Default: Today)')
        .addChoices(
          { name: 'Today (Status real-time)', value: 'today' },
          { name: 'Week (Rekap 7 hari terakhir)', value: 'week' }
        )
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('standup')
    .setDescription('Daily standup: done/doing/blocker/eta')
    .addSubcommand((s) =>
      s.setName('post').setDescription('Isi standup via form (modal)')
    ),

  new SlashCommandBuilder()
    .setName('mb01')
    .setDescription('Panggil AI Chatbox Assistant untuk basecamp')
    .addStringOption((o) =>
      o
        .setName('model')
        .setDescription('Pilih model kecerdasan Stand (Default: Lite)')
        .addChoices(
          { name: 'Lite (Lebih Cepat)', value: 'lite' },
          { name: 'Pro (Lebih Cerdas)', value: 'pro' }
        )
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Putar lagu dari YouTube (Hexa Sounddeck)')
    .addStringOption((o) =>
      o
        .setName('lagu')
        .setDescription('Judul lagu atau link YouTube')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('task')
    .setDescription('Kelola tugas di Notion Tracker')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Tambah tugas baru')
        .addStringOption(option => option.setName('nama').setDescription('Nama tugas').setRequired(true))
        .addStringOption(option => 
          option.setName('urgency')
            .setDescription('Tingkat urgensi')
            .setRequired(false)
            .addChoices(
              { name: 'High', value: 'High' },
              { name: 'Medium', value: 'Medium' },
              { name: 'Low', value: 'Low' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Lihat daftar tugas yang belum selesai')
    )
];

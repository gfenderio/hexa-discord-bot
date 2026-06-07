import { SlashCommandBuilder } from 'discord.js';

export const COMMANDS = [
  new SlashCommandBuilder().setName('ping').setDescription('Check bot status & latency'),

  new SlashCommandBuilder()
    .setName('keys')
    .setDescription('Buka dashboard n9router (manajemen & kuota API key)'),

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
    ),

  new SlashCommandBuilder()
    .setName('model')
    .setDescription('Pilih model AI global yang ingin digunakan via 9router')
    .addStringOption((o) =>
      o
        .setName('nama')
        .setDescription('Pilih model')
        .setRequired(true)
        .addChoices(
          { name: 'Gemini 2.5 Flash', value: 'gemini/gemini-2.5-flash' },
          { name: 'Gemini 2.5 Pro', value: 'gemini/gemini-2.5-pro' },
          { name: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet' },
          { name: 'GPT-4o', value: 'gpt-4o' }
        )
    )
];

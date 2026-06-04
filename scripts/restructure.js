import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Mapping channel names to aesthetic, premium descriptions tailored specifically for fenderio.com
const TOPIC_MAPPING = {
  // Core Community
  'welcome-announcement': '👋・Selamat datang di Discord resmi fenderio.com! Silakan baca rules dan berkenalan.',
  'pengumuman': '📢・Update resmi, rilis produk, event penting, dan milestones dari startup fenderio.com.',
  'general-chat': '💬・Obrolan umum seputar startup, teknologi, bisnis, dan dunia profesional.',
  'lounge': '🍻・Tempat santai, ngobrol bebas, dan kenalan antar tim Fenderio. Keep it chill!',
  
  // Startup Planning & Operations
  'plan-discussion': '💡・Ruang diskusi ide, feedback, dan perencanaan fitur baru fenderio.com.',
  'plan': '📌・Roadmap utama, timeline proyek, dan planning besar untuk fenderio.com.',
  'ide-produk': '🧠・Braindump ide-ide produk kreatif, solusi tech baru, dan inovasi masa depan.',
  'order-tracking': '📦・Sistem pelacakan order, update status client, dan operasional fenderio.com.',
  
  // Tech & Coding
  'bantu-aing-bikin-program': '💻・Ruang kolaborasi coding, peer-programming, dan pemecahan bug teknis.',
  'bantuan-nugas': '🤖・Fenderio AI Assistant. Gunakan `!nugas <pertanyaan>` untuk diskusi coding, tech, dan startup.',
  'bantuin-aing-nugas': '🤖・Fenderio AI Assistant. Gunakan `!nugas <pertanyaan>` untuk diskusi coding, tech, dan startup.',
  'codex-learning': '📚・Resource sharing seputar software development, best practices, dan teknologi terbaru.',
  
  // Fun & Culture
  'meme-tersegar': '🤣・Koleksi meme lucu seputar dunia programming, startup, dan kehidupan developer.',
  'yang-seger-seger-aja': '🍹・Tempat berbagi konten segar, inspirasi desain, UI/UX, dan hal menarik lainnya.',
  'puskas-award': '🏆・Penghargaan untuk pencapaian terbaik, coding terbersih, atau ide tergokil di tim.',
  'karius-award': '🤡・Penghargaan humoris untuk blunder coding paling epic atau bug terlucu minggu ini.',
  'philosophy': '💭・Diskusi mendalam tentang filosofi tech, etika bisnis, dan pemikiran out-of-the-box.',
  
  // Systems & Bots
  'spam-bot': '🤖・Kamar khusus untuk menggunakan command bot agar tidak mengganggu channel obrolan utama.',
  'bot-dump': '🤖・Workspace testing bot, sandbox command, dan integrasi API.',
  'bot-logs': '📄・Log otomatis performa bot, error reporting, dan deployment status.',
  'moderation-log': '🛡️・Log tindakan moderasi server demi kenyamanan dan keamanan komunitas.'
};

client.once('ready', async () => {
  try {
    console.log(`🤖 Logged in as ${client.user.tag}`);
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    console.log(` Guild Name: ${guild.name}`);
    
    // --- 1. RENAME ROLES (100% fenderio.com Focus) ---
    console.log('\n🔄 Sedang memproses Perbaikan Nama Role...');
    const roles = await guild.roles.fetch();
    
    for (const role of roles.values()) {
      if (role.name === '@everyone') continue;
      
      const roleNameLower = role.name.toLowerCase();
      let targetName = null;
      
      // Match rules
      if (roleNameLower.includes('admin') || roleNameLower.includes('founder') || roleNameLower.includes('owner')) {
        targetName = '👑・Founder / Admin';
      } else if (roleNameLower.includes('captain') || roleNameLower.includes('staff') || roleNameLower.includes('moderator') || roleNameLower.includes('mod')) {
        targetName = '🛠️・Staff / Captain';
      } else if (roleNameLower.includes('mahasiswa') || roleNameLower.includes('akademik') || roleNameLower.includes('scholar') || roleNameLower.includes('hexa') || roleNameLower.includes('dev') || roleNameLower.includes('developer')) {
        // Pivot: Change academic role to a Developer / Contributor role
        targetName = '🚀・Developer / Contributor';
      } else if (roleNameLower.includes('member') || roleNameLower.includes('anggota') || roleNameLower.includes('biasa')) {
        targetName = '👥・Member';
      }
      
      if (targetName && role.name !== targetName) {
        console.log(`   └─ Mengubah role "${role.name}" menjadi "${targetName}"...`);
        try {
          await role.setName(targetName);
          console.log(`      ✅ Sukses!`);
        } catch (e) {
          console.error(`      ❌ Gagal mengubah role "${role.name}": ${e.message}`);
        }
      }
    }
    
    // --- 2. UPDATE CHANNEL TOPICS ---
    console.log('\n🔄 Sedang mempercantik Deskripsi Channel (Topics)...');
    const channels = await guild.channels.fetch();
    
    for (const channel of channels.values()) {
      if (channel.type !== 0) continue; // Only text channels
      
      const channelName = channel.name.toLowerCase();
      let selectedTopic = null;
      
      // Cari kecocokan di mapping
      for (const [key, value] of Object.entries(TOPIC_MAPPING)) {
        if (channelName.includes(key)) {
          selectedTopic = value;
          break;
        }
      }
      
      // Fallback topic jika tidak ketemu
      if (!selectedTopic) {
        selectedTopic = `✨・Channel #${channel.name} yang rapi dan profesional untuk komunitas fenderio.com.`;
      }
      
      // Cek apakah deskripsi saat ini berbeda dengan deskripsi baru
      if (channel.topic !== selectedTopic) {
        console.log(`   └─ Menghias deskripsi channel #${channel.name}...`);
        try {
          await channel.setTopic(selectedTopic);
          console.log(`      ✅ Sukses! Topic: "${selectedTopic}"`);
        } catch (e) {
          console.error(`      ❌ Gagal menghias channel #${channel.name}: ${e.message}`);
        }
      } else {
        console.log(`   └─ Channel #${channel.name} sudah menggunakan deskripsi estetik.`);
      }
    }
    
    console.log('\n🎉 Semua langkah restrukturisasi server fenderio.com selesai dengan sukses!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Terjadi kesalahan fatal:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);

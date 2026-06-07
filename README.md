## Hexa Discord Bot (Moody Blues)

Bot Discord internal untuk produktivitas tim & "markas" startup di server Discord. Akses dikunci ke Owner.

### Slash commands
- `/ping` — cek status & latency bot
- `/keys` — buka dashboard n9router (manajemen & kuota API key)
- `/standup post` — isi daily standup via form (modal + embed)
- `/mb01 [model]` — panggil AI Assistant (membuat thread; `lite`/`pro`)
- `/play lagu:"judul atau link"` — putar musik YouTube (panel Hexa Sounddeck)
- `/task add nama:"..." [urgency]` — tambah tugas ke Notion Tracker
- `/task list` — lihat tugas yang belum selesai (urut prioritas High → Medium → Low)

### Fitur lain
- **AI Assistant (mb01):** chat di dalam thread, mengingat percakapan, bisa kelola server Discord & file via tool. Routing AI lewat **n9router** (`http://localhost:20128`). Ketik `stop` untuk menutup sesi. Butuh **Message Content Intent** + `ENABLE_MESSAGE_CONTENT=1` untuk mode chat tanpa command.
- **Auto standup:** rekap tugas Notion otomatis tiap hari kerja jam 09:00 (Asia/Jakarta).
- **Musik:** join voice lalu `/play`. Butuh **FFmpeg** (sudah via `ffmpeg-static`).

### Setup lokal
1. Buat `.env` (lihat `.env.example`):

```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
GUILD_ID=...
ENABLE_MESSAGE_CONTENT=0
NOTION_TOKEN=ntn_...
NOTION_DATABASE_ID=...
NOTION_STANDUP_CHANNEL_ID=...   # opsional
```

2. Install & jalankan:

```bash
npm install
npm run doctor              # cek env
npm run register:commands  # daftar slash command ke guild
npm run dev                # jalankan (watch mode)
```

### Deploy (VPS)
Bot dijalankan di VPS via **PM2** (proses `stzn-bot`), berdampingan dengan `n9router`.

Deploy **otomatis**: cron di VPS mengecek `origin/main` tiap menit; jika ada update, otomatis `git pull` → `pm2 restart` → register ulang command bila `src/commands.js` berubah. Cukup `git push` ke `main`, perubahan terdeploy dalam ~1 menit. Log: `/root/hexa-deploy.log`.

Manual (kalau perlu):

```bash
cd /root/hexa-discord-bot && git pull --ff-only origin main && pm2 restart stzn-bot
```

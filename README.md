## Hexa Discord Bot (MVP)

Bot Discord internal untuk bantu produktivitas (nugas) dan jadi “markas” startup di server Discord.

### Fitur MVP
- Slash command: `/ping`
- Todo sederhana: `/todo add`, `/todo list`, `/todo done`
- Catatan cepat: `/note add`, `/note list`
- Standup harian: `/standup post` (modal + embed)
- Bantuin nugas (thread): `/bantuin-nugas`
- Musik YouTube: `/play` + panel **Hexa Sounddeck** (embed + tombol kontrol)

### Musik (Hexa Sounddeck)
- Join voice channel, lalu `/play lagu:"judul atau link youtube"`
- Panel embed muncul dengan tombol: jeda, skip, volume, loop, acak, stop
- Butuh **FFmpeg** terinstall di PC/VPS (`ffmpeg` ada di PATH)

### Prasyarat
- Node.js LTS
- Discord bot token (Developer Portal)

### Setup lokal
1. Masuk folder project ini.
2. Buat file `.env`:

```env
DISCORD_TOKEN=your_token_here
DISCORD_CLIENT_ID=your_client_id_here
GUILD_ID=your_dev_guild_id_here
```

3. (Opsional) Generate link invite bot:

```bash
npm run invite
```

4. Install dan jalankan:

```bash
npm install
npm run doctor
npm run register:commands
npm run dev
```


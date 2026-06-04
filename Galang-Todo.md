## Galang — Todo Besok (Simplified)

Target: bot Discord **on 24/7** di VPS + ada service **9router** (agent hub) minimal hidup + kerangka **OAuth** siap.

---

### A) Deploy bot 24/7 (wajib)
- Sewa VPS murah (cukup: **1 vCPU / 1GB RAM**).
- Install kebutuhan:
  - `git`, `node` (Node LTS)
  - `pm2` (paling simpel untuk 24/7)
- Deploy bot:
  - clone repo bot
  - isi `.env` di VPS (jangan commit)
  - `npm install`
  - `npm run register:commands`
  - jalanin pakai pm2:
    - `pm2 start src/index.js --name hexa-bot`
    - `pm2 save`
    - `pm2 startup`
- Tes:
  - pastikan ada log `Ready as ...`
  - test `/ping` di Discord

---

### B) Setup 9router service (agent hub) — minimal dulu (wajib)
Bikin service terpisah (folder/repo baru) mis. `hexa-9router` (Node + web framework apa aja).

Minimal endpoint:
- `GET /health` → `ok`
- `GET /agents` → list agent
- `POST /agents` → tambah agent (name, description, prompt, provider)
- `POST /runs` → jalanin agent (**boleh stub dulu**: echo input + agent info)

Output minimal: service jalan di port (mis. 3001) dan bisa diakses dari bot nanti.

---

### C) OAuth plumbing untuk 9router — tahap 1 (wajib)
Belum harus integrasi provider beneran besok, yang penting kerangka callback ready.

Routes minimal:
- `GET /oauth/:provider/start` → redirect ke provider OAuth
- `GET /oauth/:provider/callback` → terima `code`, tukar jadi token, simpan token (sementara file/db lokal)

Catatan:
- token OAuth jangan ditaruh di repo
- idealnya 9router jalan via HTTPS (butuh domain/reverse proxy) supaya callback URL valid

---

### D) Yang harus Galang kirim ke YUGI setelah selesai
- IP/domain VPS
- Cara restart (pm2/coolify) + perintah pentingnya
- Status bot (jalan 24/7) + hasil test `/ping`
- URL 9router (mis. `https://.../health`)
- Env var yang dibutuhkan bot untuk integrasi 9router (mis. `ROUTER_BASE_URL`, `ROUTER_API_KEY` kalau dipakai)


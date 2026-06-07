import express from 'express';
import bodyParser from 'body-parser';
import { EmbedBuilder } from 'discord.js';
import OpenAI from 'openai';
import { ENV } from './env.js';

const app = express();
app.use(bodyParser.json());

const openai = new OpenAI({
  baseURL: 'http://68.183.176.67:20128/v1',
  apiKey: 'N9ROUTER-AI-KEY-sk-12345'
});

export function startWebhookServer(discordClient) {
  app.post('/github-webhook', async (req, res) => {
    const event = req.headers['x-github-event'];
    if (event === 'push') {
      const payload = req.body;
      const repository = payload.repository?.full_name || 'unknown/repo';
      const commits = payload.commits || [];
      const pusher = payload.pusher?.name || 'unknown';

      if (commits.length === 0) {
        return res.status(200).send('No commits');
      }

      // Cari channel umum untuk report, misalnya yang id-nya disimpan di DB atau cari channel pertama yang bisa di text
      const guild = discordClient.guilds.cache.first();
      if (!guild) return res.status(200).send('No guild found');
      
      const channel = guild.channels.cache.find(c => c.isTextBased() && c.name.includes('general')) || 
                      guild.channels.cache.find(c => c.isTextBased());
                      
      if (!channel) return res.status(200).send('No channel found');

      let combinedPatch = '';
      for (const commit of commits.slice(0, 3)) { // Max 3 commits for context
        try {
          const patchUrl = `${commit.url}.patch`;
          const patchRes = await fetch(patchUrl);
          if (patchRes.ok) {
            combinedPatch += await patchRes.text() + '\n\n';
          }
        } catch (e) {
          console.error('Failed to fetch patch:', e);
        }
      }

      if (combinedPatch.length > 0) {
        // AI Review
        try {
          const prompt = `Anda adalah seorang Senior Full-Stack Developer. Tolong berikan Auto Code Review dari perubahan git berikut.
Fokus pada:
1. Potensi bug (memory leak, unhandled promise, dll)
2. Praktik keamanan yang buruk
3. Saran optimasi ringan

Jangan berikan penjelasan yang terlalu panjang, langsung ke intinya dengan poin-poin. Jika kode terlihat aman, katakan saja "✅ Kode terlihat aman dan rapi."

\`\`\`diff
${combinedPatch.slice(0, 15000)}
\`\`\`
`;
          const response = await openai.chat.completions.create({
            model: 'gemini/gemini-1.5-pro',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          });

          const aiReview = response.choices[0].message.content;

          const embed = new EmbedBuilder()
            .setTitle(`🐙 GitHub Push: ${repository}`)
            .setDescription(`**Pusher:** ${pusher}\n**Commits:** ${commits.length}\n\n**🤖 Auto Code Review:**\n${aiReview.slice(0, 4000)}`)
            .setColor(0x000000)
            .setURL(payload.compare);

          await channel.send({ embeds: [embed] });
        } catch (error) {
          console.error('AI Code Review Failed:', error);
        }
      }
    }
    
    res.status(200).send('OK');
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[Webhook] Server is listening on port ${PORT}`);
  });
}

import cron from 'node-cron';
import { getPendingTasks } from '../notion.js';
import { ENV } from '../env.js';

export function startStandupScheduler(client) {
  // Run at 09:00 AM on weekdays (Monday to Friday) in Jakarta time
  cron.schedule('0 9 * * 1-5', async () => {
    try {
      console.log('Running Hexa Standup Scheduler...');
      const channel = await client.channels.fetch(ENV.NOTION_STANDUP_CHANNEL_ID);
      if (!channel?.isTextBased()) {
        console.error('Standup channel is not text based or not found.');
        return;
      }

      const tasks = await getPendingTasks();
      if (tasks.length === 0) {
        await channel.send('🎉 **Daily Standup:** Tidak ada tugas Hexa yang tertunda hari ini. Kerja bagus!');
        return;
      }

      const list = tasks.map(t => {
        const title = t.properties['Task Name']?.title[0]?.plain_text || 'Untitled';
        const urgency = t.properties['Urgency']?.select?.name || 'Low';
        const status = t.properties['Status']?.status?.name || 'To-Do';
        const emoji = urgency === 'High' ? '🔴' : (urgency === 'Medium' ? '🟡' : '🟢');
        return `${emoji} **${title}** (${status})`;
      }).join('\n');

      const message = `Halo Tuan! Selamat Pagi ☕\nBerikut adalah rekap tugas **Hexa Tracker** Anda yang belum selesai:\n\n${list}`;
      await channel.send(message);

    } catch (error) {
      console.error('Error in Standup Scheduler:', error);
    }
  }, {
    timezone: "Asia/Jakarta"
  });

  console.log(`Standup scheduler aktif untuk channel ${ENV.NOTION_STANDUP_CHANNEL_ID}.`);
}

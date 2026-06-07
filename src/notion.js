import { Client } from '@notionhq/client';
import { ENV } from './env.js';

const notion = new Client({ auth: ENV.NOTION_TOKEN });
const databaseId = ENV.NOTION_DATABASE_ID;

export async function addNotionTask(taskName, urgency = 'Medium') {
  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        'Task Name': {
          title: [
            {
              text: { content: taskName }
            }
          ]
        },
        'Status': {
          status: { name: 'To-Do' }
        },
        'Urgency': {
          select: { name: urgency }
        }
      }
    });
    return response;
  } catch (error) {
    console.error('Error adding task to Notion:', error);
    throw error;
  }
}

const URGENCY_RANK = { High: 0, Medium: 1, Low: 2 };

export async function getPendingTasks() {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Status',
        status: { does_not_equal: 'Done' }
      }
    });
    // Notion sort pada tipe select hanya alfabetis (High, Low, Medium),
    // jadi urutkan berdasarkan prioritas sebenarnya di sini: High > Medium > Low.
    return response.results.sort((a, b) => {
      const ua = URGENCY_RANK[a.properties['Urgency']?.select?.name] ?? 3;
      const ub = URGENCY_RANK[b.properties['Urgency']?.select?.name] ?? 3;
      return ua - ub;
    });
  } catch (error) {
    console.error('Error getting tasks from Notion:', error);
    throw error;
  }
}

export async function updateNotionTaskStatus(taskId, status = 'Done') {
  try {
    const response = await notion.pages.update({
      page_id: taskId,
      properties: {
        'Status': {
          status: { name: status }
        }
      }
    });
    return response;
  } catch (error) {
    console.error('Error updating task in Notion:', error);
    throw error;
  }
}

export async function createNotionPage(title, contentMarkdown) {
  try {
    const blocks = [];
    // Pisahkan konten dengan baris kosong untuk membuat blok paragraf/kode terpisah
    const paragraphs = contentMarkdown.split('\n\n').filter(p => p.trim() !== '');
    for (const p of paragraphs.slice(0, 50)) { // limit 50 blocks
      if (p.startsWith('```')) {
        const lines = p.split('\n');
        const lang = lines[0].replace('```', '').trim() || 'plain text';
        const code = lines.slice(1, -1).join('\n');
        blocks.push({
          object: 'block',
          type: 'code',
          code: {
            rich_text: [{ type: 'text', text: { content: code.slice(0, 2000) } }],
            language: lang === 'js' ? 'javascript' : (lang === 'ts' ? 'typescript' : 'plain text')
          }
        });
      } else {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: p.slice(0, 2000) } }]
          }
        });
      }
    }

    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        'Task Name': {
          title: [{ text: { content: title } }]
        },
        'Status': {
          status: { name: 'To-Do' }
        },
        'Urgency': {
          select: { name: 'Medium' }
        }
      },
      children: blocks
    });
    return response;
  } catch (error) {
    console.error('Error creating Notion page:', error);
    throw error;
  }
}

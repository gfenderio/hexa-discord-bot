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

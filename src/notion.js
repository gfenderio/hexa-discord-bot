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

export async function getPendingTasks() {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Status',
        status: { does_not_equal: 'Done' }
      },
      sorts: [
        {
          property: 'Urgency',
          direction: 'descending'
        }
      ]
    });
    return response.results;
  } catch (error) {
    console.error('Error getting tasks from Notion:', error);
    throw error;
  }
}

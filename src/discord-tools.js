import { ChannelType, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import * as cheerio from 'cheerio';
import { withDb } from './storage.js';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const WORKSPACE_DIR = '/root/workspaces/la-stazione';
export const MB01_TOOLS_DECLARATION = [
  {
    type: 'function',
    function: {
      name: 'get_server_info',
      description: 'Ambil info server (nama, roles) dan daftar channel/kategori saat ini agar AI tahu apa yang ada di server sebelum merombak.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'rename_server',
      description: 'Ubah nama server Discord.',
      parameters: {
        type: 'object',
        properties: {
          newName: { type: 'string', description: 'Nama baru untuk server' }
        },
        required: ['newName'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_category',
      description: 'Buat kategori channel baru.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nama kategori baru' }
        },
        required: ['name'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_text_channel',
      description: 'Buat text channel baru di bawah kategori tertentu.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nama channel (huruf kecil, tanpa spasi)' },
          categoryId: { type: 'string', description: 'ID Kategori (opsional)' }
        },
        required: ['name'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'archive_channel',
      description: 'Arsipkan channel lama: sembunyikan dari publik (hanya bisa dilihat role captain/admin kamboja/admin), dan pindahkan ke kategori arsip.',
      parameters: {
        type: 'object',
        properties: {
          channelId: { type: 'string', description: 'ID channel yang akan diarsipkan' },
          archiveCategoryId: { type: 'string', description: 'ID kategori arsip tempat channel ini akan dipindah (opsional)' }
        },
        required: ['channelId'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_role',
      description: 'Buat role (peran) baru di server dengan nama dan warna tertentu.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nama role baru' },
          color: { type: 'string', description: 'Kode warna HEX (misal: "#FF0000" atau "0xFF0000", opsional)' }
        },
        required: ['name'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'rename_role',
      description: 'Ubah nama role (peran) yang sudah ada di server.',
      parameters: {
        type: 'object',
        properties: {
          roleId: { type: 'string', description: 'ID role yang akan diubah namanya' },
          newName: { type: 'string', description: 'Nama baru untuk role tersebut' }
        },
        required: ['roleId', 'newName'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_role',
      description: 'Hapus role (peran) yang tidak terpakai dari server.',
      parameters: {
        type: 'object',
        properties: {
          roleId: { type: 'string', description: 'ID role yang akan dihapus' }
        },
        required: ['roleId'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_api_pool_status',
      description: 'Dapatkan info status bahwa manajemen kuota sekarang diurus oleh n9router.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Membaca isi file dari dalam repositori (workspace). Parameter path harus merupakan path relatif dari root proyek.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path relatif file, misal: src/index.js' }
        },
        required: ['filePath'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Menulis konten ke dalam file (akan menimpa file jika sudah ada) di workspace.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path relatif file' },
          content: { type: 'string', description: 'Isi kode atau teks lengkap' }
        },
        required: ['filePath', 'content'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_bash_sandbox',
      description: 'Menjalankan perintah bash/terminal di dalam Docker Sandbox (termasuk perintah Git, npm, dsb). Workspace di-mount di /workspace.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Perintah terminal yang akan dijalankan' }
        },
        required: ['command'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate sebuah gambar berdasarkan prompt teks dan kirimkan langsung ke chat.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Deskripsi gambar yang ingin digenerate dalam bahasa Inggris' }
        },
        required: ['prompt'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_9router_models',
      description: 'Dapatkan daftar model AI yang tersedia di sistem 9router.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_9router_model',
      description: 'Ubah model AI yang aktif untuk thread percakapan ini via 9router.',
      parameters: {
        type: 'object',
        properties: {
          model_name: { type: 'string', description: 'Nama model (misal: gemini/gemini-2.5-pro)' }
        },
        required: ['model_name'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Lakukan pencarian Google/Web untuk mendapatkan informasi real-time.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Kata kunci pencarian' }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_url',
      description: 'Membaca dan mengekstrak teks utama dari sebuah URL artikel atau dokumentasi.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL lengkap (http/https)' }
        },
        required: ['url'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_notion_page',
      description: 'Membuat halaman Notion baru dengan konten terstruktur (Markdown ringan didukung).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Judul halaman' },
          content: { type: 'string', description: 'Isi teks halaman (gunakan double newline untuk paragraf baru, dan ``` bahasa untuk kode)' }
        },
        required: ['title', 'content'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_notion_task',
      description: 'Mengubah status dari sebuah task di Notion.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'ID unik task' },
          status: { type: 'string', description: 'Status baru (To-Do, Doing, Done)' }
        },
        required: ['taskId', 'status'],
        additionalProperties: false
      }
    }
  }
];

export async function executeMB01Tool(name, args, { guild, thread }) {
  try {
    switch (name) {
      case 'get_server_info': {
        const channels = await guild.channels.fetch();
        const roles = await guild.roles.fetch();
        
        const channelList = channels.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type === ChannelType.GuildCategory ? 'category' : (c.type === ChannelType.GuildVoice ? 'voice' : 'text'),
          parentId: c.parentId
        }));

        const roleList = roles.map(r => ({
          id: r.id,
          name: r.name
        }));

        return {
          serverName: guild.name,
          channels: channelList,
          roles: roleList
        };
      }

      case 'rename_server': {
        await guild.setName(args.newName);
        return { success: true, message: `Server name changed to ${args.newName}` };
      }

      case 'create_category': {
        const cat = await guild.channels.create({
          name: args.name,
          type: ChannelType.GuildCategory
        });
        return { success: true, categoryId: cat.id, name: cat.name };
      }

      case 'create_text_channel': {
        const chan = await guild.channels.create({
          name: args.name,
          type: ChannelType.GuildText,
          parent: args.categoryId || undefined
        });
        return { success: true, channelId: chan.id, name: chan.name };
      }

      case 'archive_channel': {
        const channelToArchive = await guild.channels.fetch(args.channelId);
        if (!channelToArchive) throw new Error('Channel not found');

        const roles = await guild.roles.fetch();
        const allowedRoleIds = [];
        for (const role of roles.values()) {
          const rName = role.name.toLowerCase();
          if (rName.includes('captain') || rName.includes('admin kamboja')) {
            allowedRoleIds.push(role.id);
          }
        }

        const permissionOverwrites = [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          }
        ];

        for (const rId of allowedRoleIds) {
          permissionOverwrites.push({
            id: rId,
            allow: [PermissionFlagsBits.ViewChannel]
          });
        }

        await channelToArchive.edit({
          parent: args.archiveCategoryId || undefined,
          permissionOverwrites,
          reason: 'Archived by MB01 Stand'
        });

        return { success: true, message: `Channel ${channelToArchive.name} archived.` };
      }

      case 'create_role': {
        const newRole = await guild.roles.create({
          name: args.name,
          color: args.color || undefined,
          reason: 'Created by MB01 AI'
        });
        return { success: true, roleId: newRole.id, name: newRole.name };
      }

      case 'rename_role': {
        const role = await guild.roles.fetch(args.roleId);
        if (!role) throw new Error('Role not found');
        const oldName = role.name;
        await role.setName(args.newName);
        return { success: true, roleId: role.id, oldName, newName: args.newName };
      }

      case 'delete_role': {
        const role = await guild.roles.fetch(args.roleId);
        if (!role) throw new Error('Role not found');
        const roleName = role.name;
        await role.delete('Deleted by MB01 AI');
        return { success: true, message: `Role ${roleName} deleted.` };
      }

      case 'get_api_pool_status': {
        return 'Sistem rotasi dan limitasi API Key sekarang sepenuhnya ditangani oleh n9router secara transparan. Server aman dari limit 429.';
      }
      case 'read_file': {
        const fullPath = path.join(WORKSPACE_DIR, args.filePath);
        if (!fullPath.startsWith(WORKSPACE_DIR)) throw new Error('Path traversal detected');
        if (!fs.existsSync(fullPath)) throw new Error('File not found');
        const content = await fs.promises.readFile(fullPath, 'utf8');
        return `Isi file ${args.filePath}:\n\n${content}`;
      }
      case 'write_file': {
        const fullPath = path.join(WORKSPACE_DIR, args.filePath);
        if (!fullPath.startsWith(WORKSPACE_DIR)) throw new Error('Path traversal detected');
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, args.content, 'utf8');
        return `File ${args.filePath} berhasil ditulis.`;
      }
      case 'run_bash_sandbox': {
        const gitconfigMount = fs.existsSync('/root/.gitconfig') ? '-v /root/.gitconfig:/root/.gitconfig:ro' : '';
        const sshMount = fs.existsSync('/root/.ssh') ? '-v /root/.ssh:/root/.ssh:ro' : '';
        const dockerCmd = `docker run --rm -v ${WORKSPACE_DIR}:/workspace ${sshMount} ${gitconfigMount} -e GIT_SSH_COMMAND="ssh -i /root/.ssh/stzn_bot_rsa -o IdentitiesOnly=yes" -w /workspace node:20 /bin/bash -c ${JSON.stringify(args.command)}`;
        try {
          const { stdout, stderr } = await execPromise(dockerCmd, { timeout: 30000 });
          return `STDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
        } catch (e) {
          return `ERROR:\n${e.message}\nSTDOUT:\n${e.stdout}\nSTDERR:\n${e.stderr}`;
        }
      }
      
      case 'generate_image': {
        const { ENV } = await import('./env.js');
        if (!ENV.GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY belum di-set di .env. Silakan tambahkan kunci dari Google AI Studio.");
        }
        
        // Parse comma-separated keys and pick a random one to avoid rate limits
        const keys = ENV.GEMINI_API_KEY.split(',').map(k => k.trim()).filter(k => k.length > 0);
        const apiKey = keys[Math.floor(Math.random() * keys.length)];

        if (thread) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;
            const body = {
              instances: [{ prompt: args.prompt }],
              parameters: { sampleCount: 1, aspectRatio: "1:1" }
            };

            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Google API Error: ${errText}`);
            }

            const data = await res.json();
            if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
              throw new Error("Invalid response format dari Google API.");
            }

            const base64Data = data.predictions[0].bytesBase64Encoded;
            const buffer = Buffer.from(base64Data, 'base64');

            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = await import('discord.js');
            const attachment = new AttachmentBuilder(buffer, { name: 'google_imagen.png' });
            
            const embed = new EmbedBuilder()
              .setTitle('✨ Hasil Generate Gambar (Google Imagen 3)')
              .setImage('attachment://google_imagen.png')
              .setFooter({ text: `Prompt: ${args.prompt}` })
              .setColor(0x0F9D58); // Google Green
            
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`regen_img:${Buffer.from(args.prompt.slice(0, 50)).toString('base64')}`)
                .setLabel('🔄 Buat Ulang')
                .setStyle(ButtonStyle.Primary)
            );
            await thread.send({ embeds: [embed], files: [attachment], components: [row] });
          } catch (e) {
            console.error('Failed to generate image via Google:', e);
            return { error: `Gagal membuat gambar via Google Imagen: ${e.message}` };
          }
        }
        
        return { success: true, message: "Gambar berhasil digenerate via Google Imagen dan diunggah ke chat." };
      }
      
      case 'get_9router_models': {
        try {
          // You can also fetch from http://localhost:20128/v1/models if 9router supports it
          // For now, return a static/common list supported by 9router standard config
          return {
            models: [
              "gemini/gemini-2.5-flash",
              "gemini/gemini-2.5-pro",
              "claude-3-5-sonnet",
              "gpt-4o",
              "gpt-4o-mini"
            ],
            message: "Gunakan set_9router_model dengan salah satu nama model di atas."
          };
        } catch (e) {
          return { error: e.message };
        }
      }
      
      case 'set_9router_model': {
        if (!thread) {
          return { error: 'Tool ini hanya dapat dijalankan di dalam thread AI (mb01).' };
        }
        let updated = false;
        withDb((db) => {
          if (db.mb01Threads && db.mb01Threads[thread.id]) {
            db.mb01Threads[thread.id].model = args.model_name;
            updated = true;
          }
          return db;
        });
        if (updated) {
          return { success: true, message: `Model untuk thread ini berhasil diubah menjadi ${args.model_name}.` };
        } else {
          return { error: 'Gagal mengubah model. Thread ini mungkin tidak tercatat dalam database.' };
        }
      }
      
      case 'search_web': {
        try {
          const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const html = await res.text();
          const $ = cheerio.load(html);
          const results = [];
          $('.result').each((i, el) => {
            if (i >= 5) return;
            const title = $(el).find('.result__title').text().trim();
            const url = $(el).find('.result__url').attr('href');
            let actualUrl = url;
            if (url && url.startsWith('//duckduckgo.com/l/?uddg=')) {
              actualUrl = decodeURIComponent(url.split('uddg=')[1].split('&')[0]);
            }
            const snippet = $(el).find('.result__snippet').text().trim();
            if (title && snippet) results.push({ title, url: actualUrl, snippet });
          });
          return { success: true, results: results.length ? results : 'Tidak ada hasil.' };
        } catch (e) {
          return { error: e.message };
        }
      }

      case 'read_url': {
        try {
          const res = await fetch(args.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const html = await res.text();
          const $ = cheerio.load(html);
          // Remove scripts, styles, navs
          $('script, style, nav, footer, header, aside, noscript, svg').remove();
          const text = $('body').text().replace(/\s+/g, ' ').trim();
          return { success: true, text: text.slice(0, 8000) + (text.length > 8000 ? '...(terpotong)' : '') };
        } catch (e) {
          return { error: e.message };
        }
      }

      case 'create_notion_page': {
        try {
          const { createNotionPage } = await import('./notion.js');
          const res = await createNotionPage(args.title, args.content);
          return { success: true, url: res.url };
        } catch (e) {
          return { error: e.message };
        }
      }

      case 'update_notion_task': {
        try {
          const { updateNotionTaskStatus } = await import('./notion.js');
          const res = await updateNotionTaskStatus(args.taskId, args.status);
          return { success: true, message: `Task diubah ke status ${args.status}` };
        } catch (e) {
          return { error: e.message };
        }
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return { error: error.message };
  }
}

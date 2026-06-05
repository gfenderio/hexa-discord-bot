import { ChannelType, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
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
  }
];

export async function executeMB01Tool(name, args, { guild }) {
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
        const dockerCmd = `docker run --rm -v ${WORKSPACE_DIR}:/workspace -v /root/.ssh:/root/.ssh:ro -v /root/.gitconfig:/root/.gitconfig:ro -e GIT_SSH_COMMAND="ssh -i /root/.ssh/stzn_bot_rsa -o IdentitiesOnly=yes" -w /workspace node:20 /bin/bash -c ${JSON.stringify(args.command)}`;
        try {
          const { stdout, stderr } = await execPromise(dockerCmd, { timeout: 30000 });
          return `STDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
        } catch (e) {
          return `ERROR:\n${e.message}\nSTDOUT:\n${e.stdout}\nSTDERR:\n${e.stderr}`;
        }
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return { error: error.message };
  }
}

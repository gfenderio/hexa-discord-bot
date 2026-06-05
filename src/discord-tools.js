import { ChannelType, PermissionFlagsBits } from 'discord.js';

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
        return {
          status: 'Manajemen kuota dan API Key sekarang diambil alih oleh n9router secara terpusat.',
          dashboardUrl: 'http://68.183.176.67:20128',
          message: 'Silakan buka dashboard n9router di browser untuk melihat sisa kuota dan status Stand.'
        };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return { error: error.message };
  }
}

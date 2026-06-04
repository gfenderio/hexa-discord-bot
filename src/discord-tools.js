import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { readDb } from './storage.js';
import { ENV } from './env.js';

const STAND_NAMES = [
  'Highway Star',
  'Metallica',
  'Diver Down',
  'Weather Report',
  'Catch the Rainbow',
  'Paisley Park',
  'White Album',
  'Enigma',
  'Wonder of U',
  'Born This Way'
];

function getKeySignature(key) {
  if (!key || key.length <= 15) return key || 'unknown';
  return `${key.slice(0, 12)}...${key.slice(-6)}`;
}

export const MB01_TOOLS_DECLARATION = [
  {
    name: 'get_server_info',
    description: 'Ambil info server (nama, roles) dan daftar channel/kategori saat ini agar AI tahu apa yang ada di server sebelum merombak.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'rename_server',
    description: 'Ubah nama server Discord.',
    parameters: {
      type: 'OBJECT',
      properties: {
        newName: { type: 'STRING', description: 'Nama baru untuk server' }
      },
      required: ['newName']
    }
  },
  {
    name: 'create_category',
    description: 'Buat kategori channel baru.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Nama kategori baru' }
      },
      required: ['name']
    }
  },
  {
    name: 'create_text_channel',
    description: 'Buat text channel baru di bawah kategori tertentu.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Nama channel (huruf kecil, tanpa spasi)' },
        categoryId: { type: 'STRING', description: 'ID Kategori (opsional)' }
      },
      required: ['name']
    }
  },
  {
    name: 'archive_channel',
    description: 'Arsipkan channel lama: sembunyikan dari publik (hanya bisa dilihat role captain/admin kamboja/admin), dan pindahkan ke kategori arsip.',
    parameters: {
      type: 'OBJECT',
      properties: {
        channelId: { type: 'STRING', description: 'ID channel yang akan diarsipkan' },
        archiveCategoryId: { type: 'STRING', description: 'ID kategori arsip tempat channel ini akan dipindah (opsional)' }
      },
      required: ['channelId']
    }
  },
  {
    name: 'create_role',
    description: 'Buat role (peran) baru di server dengan nama dan warna tertentu.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Nama role baru' },
        color: { type: 'STRING', description: 'Kode warna HEX (misal: "#FF0000" atau "0xFF0000", opsional)' }
      },
      required: ['name']
    }
  },
  {
    name: 'rename_role',
    description: 'Ubah nama role (peran) yang sudah ada di server.',
    parameters: {
      type: 'OBJECT',
      properties: {
        roleId: { type: 'STRING', description: 'ID role yang akan diubah namanya' },
        newName: { type: 'STRING', description: 'Nama baru untuk role tersebut' }
      },
      required: ['roleId', 'newName']
    }
  },
  {
    name: 'delete_role',
    description: 'Hapus role (peran) yang tidak terpakai dari server.',
    parameters: {
      type: 'OBJECT',
      properties: {
        roleId: { type: 'STRING', description: 'ID role yang akan dihapus' }
      },
      required: ['roleId']
    }
  },
  {
    name: 'get_api_pool_status',
    description: 'Dapatkan status kuota harian (Flash & Pro), tingkat keberhasilan, sisa waktu cooldown, dan kecepatan respon rata-rata dari ke-5 Stand API Key Gemini saat ini.',
    parameters: {
      type: 'OBJECT',
      properties: {}
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

        // Cari role captain dan admin kamboja (case insensitive)
        const roles = await guild.roles.fetch();
        const allowedRoleIds = [];
        for (const role of roles.values()) {
          const rName = role.name.toLowerCase();
          if (rName.includes('captain') || rName.includes('admin kamboja')) {
            allowedRoleIds.push(role.id);
          }
        }

        // Setup permissions
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
        const db = readDb();
        const stats = db.apiKeyStats || {};
        const todayUTC = new Date().toISOString().slice(0, 10);
        
        const poolInfo = ENV.GEMINI_API_KEYS.map((key, i) => {
          const sig = getKeySignature(key);
          const name = STAND_NAMES[i] || `Stand #${i + 1}`;
          const keyStats = stats[sig] || {};
          
          let rateLimited = false;
          let cooldownRemainingSecs = 0;
          if (keyStats.rateLimitedUntil && new Date(keyStats.rateLimitedUntil) > new Date()) {
            rateLimited = true;
            cooldownRemainingSecs = Math.max(0, Math.round((new Date(keyStats.rateLimitedUntil) - new Date()) / 1000));
          }
          
          let dailyFlash = keyStats.dailyFlashCalls || 0;
          let dailyPro = keyStats.dailyProCalls || 0;
          if (keyStats.lastResetDate !== todayUTC) {
            dailyFlash = 0;
            dailyPro = 0;
          }

          const successCount = keyStats.successCount || 0;
          const errorCount = keyStats.errorCount || 0;
          const total = successCount + errorCount;
          const accuracy = total > 0 ? `${((successCount / total) * 100).toFixed(1)}%` : '100%';

          return {
            standName: name,
            status: rateLimited ? `Rate Limited (Cooldown: ${cooldownRemainingSecs}s)` : 'Active (Ready)',
            dailyFlashQuotaUsed: `${dailyFlash} / 1500`,
            dailyProQuotaUsed: `${dailyPro} / 50`,
            successRate: accuracy,
            avgResponseSpeedSecs: keyStats.avgLatency ? `${(keyStats.avgLatency / 1000).toFixed(2)}s` : 'N/A'
          };
        });

        return {
          status: 'success',
          gatewayStatus: 'ONLINE',
          timezone: 'UTC',
          currentDateUTC: todayUTC,
          keyPool: poolInfo
        };
      }

      default:
        return { error: `Tool ${name} not implemented` };
    }
  } catch (error) {
    return { error: error.message };
  }
}

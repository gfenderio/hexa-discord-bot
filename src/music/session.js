/** @typedef {{ title: string, url: string, durationSec: number, channel: string, thumbnail: string | null, requestedBy: string }} Track */

const sessions = new Map();

export function getSession(guildId) {
  if (!sessions.has(guildId)) {
    sessions.set(guildId, {
      queue: /** @type {Track[]} */ ([]),
      current: /** @type {Track | null} */ (null),
      loop: /** @type {'off' | 'track' | 'queue'} */ ('off'),
      shuffle: false,
      volume: 0.75,
      paused: false,
      connection: null,
      player: null,
      panel: { channelId: null, messageId: null },
      textChannelId: null
    });
  }
  return sessions.get(guildId);
}

export function clearSession(guildId) {
  sessions.delete(guildId);
}

export function formatDuration(seconds) {
  if (!seconds || !Number.isFinite(seconds)) return '—';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}j ${m}m ${sec}d`;
  return `${m}m ${sec}d`;
}

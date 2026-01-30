import { FRAME_GROUP_COLORS, FRAME_TO_GROUP } from './store.js';

export function displayTime(ms) {
  if (!Number.isFinite(ms)) return { label: '—', scaleSeconds: NaN };
  const safeMs = Math.max(0, ms);
  const seconds = safeMs / 1000;
  if (seconds >= 1) {
    const roundedSeconds = Math.max(1, Math.round(seconds));
    return { label: `${roundedSeconds}s`, scaleSeconds: seconds };
  }
  if (safeMs < 1) {
    return { label: '<1 ms', scaleSeconds: 0.001 };
  }
  const msLabel = safeMs < 10
    ? safeMs.toFixed(2)
    : safeMs < 100
      ? safeMs.toFixed(1)
      : String(Math.round(safeMs));
  return { label: `${msLabel} ms`, scaleSeconds: seconds };
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export function prettyName(id) {
  if (!id) return '';
  return id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function frameColor(frame) {
  const group = FRAME_TO_GROUP.get(frame);
  return FRAME_GROUP_COLORS.get(group) ?? '#7b8dff';
}

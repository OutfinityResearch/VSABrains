import { dom } from '../store.js';

const { activityLog } = dom;

export function addActivity(message, tone = 'info') {
  if (!activityLog) return;
  const time = new Date().toLocaleTimeString().slice(0, 8);
  const entry = document.createElement('div');
  entry.className = `activity-entry ${tone}`;
  entry.innerHTML = `<span class="activity-time">${time}</span><span class="activity-message">${message}</span>`;
  activityLog.prepend(entry);
  const items = activityLog.querySelectorAll('.activity-entry');
  if (items.length > 40) items[items.length - 1].remove();
}


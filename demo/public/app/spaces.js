import { dom, FRAME_GROUP_COLORS, SPACE_GROUPS, runtime } from './store.js';
import { prettyName } from './format.js';

const { spacesContainer, spacesMeta, spacesGroup, spacesFilter } = dom;

function renderSparkline(series) {
  if (!Array.isArray(series) || series.length < 2) return '';
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const points = series.map((value, idx) => {
    const x = (idx / (series.length - 1)) * 100;
    const y = 100 - ((value - min) / span) * 100;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `
    <svg class="space-spark" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points="${points}" fill="none" stroke="rgba(123,141,255,0.9)" stroke-width="2" />
    </svg>
  `;
}

export function renderSpaces(summary) {
  if (!spacesContainer) return;
  spacesContainer.innerHTML = '';

  if (!summary) {
    spacesContainer.textContent = 'No semantic facts yet.';
    return;
  }

  const groupFilter = spacesGroup?.value ?? 'all';
  const textFilter = (spacesFilter?.value ?? '').trim().toLowerCase();

  const matchesText = (space) => {
    if (!textFilter) return true;
    return space.toLowerCase().includes(textFilter) || prettyName(space).toLowerCase().includes(textFilter);
  };

  let totalShown = 0;
  SPACE_GROUPS.forEach((group) => {
    if (groupFilter !== 'all' && group.label !== groupFilter) return;
    const items = group.spaces.filter(matchesText).map((space) => {
      const top = summary.top?.[space];
      const last = summary.last?.[space];
      const series = summary.series?.[space];
      const relation = summary.relations?.[space]?.[0];
      return { space, top, last, series, relation };
    }).filter((item) => item.top || item.last || item.series || item.relation);

    if (!items.length) return;
    totalShown += items.length;

    const groupCard = document.createElement('div');
    groupCard.className = 'space-group';
    const groupTitle = document.createElement('div');
    groupTitle.className = 'space-group-title';
    const swatch = document.createElement('span');
    swatch.className = 'space-group-swatch';
    swatch.style.background = FRAME_GROUP_COLORS.get(group.label) ?? '#7b8dff';
    const label = document.createElement('span');
    label.textContent = group.label;
    groupTitle.appendChild(swatch);
    groupTitle.appendChild(label);
    groupCard.appendChild(groupTitle);

    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'space-row';
      const label = document.createElement('div');
      label.className = 'space-name';
      label.textContent = prettyName(item.space);
      const value = document.createElement('div');
      value.className = 'space-value';
      const pieces = [];
      if (item.top) pieces.push(`${item.top.value} (${item.top.count})`);
      if (item.last != null && item.last !== item.top?.value) pieces.push(`last: ${item.last}`);
      if (item.relation) pieces.push(`${item.relation.pair}: ${item.relation.value}`);
      value.textContent = pieces.join(' · ') || '—';
      const spark = document.createElement('div');
      spark.className = 'space-spark-wrap';
      spark.innerHTML = item.series ? renderSparkline(item.series) : '';
      row.appendChild(label);
      row.appendChild(value);
      row.appendChild(spark);
      groupCard.appendChild(row);
    });

    spacesContainer.appendChild(groupCard);
  });

  if (spacesMeta) {
    spacesMeta.textContent = totalShown ? `${totalShown} spaces shown` : 'No matching spaces';
  }
}

export function wireSpacesFilters() {
  spacesGroup?.addEventListener('change', () => renderSpaces(runtime.state?.semanticSummary ?? null));
  spacesFilter?.addEventListener('input', () => renderSpaces(runtime.state?.semanticSummary ?? null));
}

import { dom, config, runtime } from '../store.js';
import { drawGrid } from './grid.js';

const {
  columnsCheckboxes,
  columnsAllBtn,
  columnsNoneBtn
} = dom;

export function ensureVisibleColumns(count) {
  if (!runtime.columnsInitialized) {
    runtime.visibleColumns = new Set(Array.from({ length: count }, (_, i) => i));
    runtime.columnsInitialized = true;
    runtime.lastColumnsCount = count;
    renderColumnFilters(count);
    return;
  }
  const hadAll = runtime.visibleColumns.size === runtime.lastColumnsCount && runtime.lastColumnsCount > 0;
  const next = new Set([...runtime.visibleColumns].filter((idx) => idx < count));
  if (hadAll) {
    for (let i = 0; i < count; i += 1) {
      next.add(i);
    }
  }
  runtime.visibleColumns = next;
  runtime.lastColumnsCount = count;
  renderColumnFilters(count);
}

export function renderColumnFilters(count) {
  if (!columnsCheckboxes) return;
  columnsCheckboxes.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const id = `col_${i}`;
    const label = document.createElement('label');
    label.className = 'column-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = runtime.visibleColumns.has(i);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) runtime.visibleColumns.add(i);
      else runtime.visibleColumns.delete(i);
      drawGrid();
    });
    const swatch = document.createElement('span');
    swatch.className = 'column-swatch';
    swatch.style.background = config.columnColors[i % config.columnColors.length];
    const text = document.createElement('span');
    text.textContent = `C${i + 1}`;
    label.appendChild(checkbox);
    label.appendChild(swatch);
    label.appendChild(text);
    columnsCheckboxes.appendChild(label);
  }
}

export function setAllColumns(checked) {
  const count = runtime.state?.columns?.length ?? runtime.state?.numColumns ?? 0;
  runtime.visibleColumns = new Set(Array.from({ length: count }, (_, i) => (checked ? i : null)).filter((v) => v != null));
  runtime.columnsInitialized = true;
  runtime.lastColumnsCount = count;
  renderColumnFilters(count);
  drawGrid();
}

export function wireColumnControls() {
  columnsAllBtn?.addEventListener('click', () => setAllColumns(true));
  columnsNoneBtn?.addEventListener('click', () => setAllColumns(false));
}


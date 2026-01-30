/**
 * Scene renderer: Grid
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Grid Scene - Where Memory Lives
 */
export function renderGridScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const highlightedCells = [
    { x: 12, y: 12, tokens: [42, 17] },
    { x: 14, y: 13, tokens: [89, 23, 56] },
    { x: 15, y: 15, tokens: [78] },
    { x: 13, y: 16, tokens: [34, 91, 45, 12] }
  ];

  const activeIdx = Math.floor(phase * 4) % highlightedCells.length;
  const activeCell = highlightedCells[activeIdx];

  drawGrid(ctx, highlightedCells, activeCell, true);
  drawInfoBox(ctx, baseWidth - 200, 50, 'Grid Cell', [
    'Stores top-K tokens',
    'Each write adds to cell',
    'Location = address'
  ]);

  const { x, y } = gridToPixel(activeCell.x, activeCell.y);
  const pulse = Math.sin(phase * Math.PI * 6) * 0.5 + 0.5;

  ctx.strokeStyle = `rgba(232, 121, 249, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 22 + pulse * 5, 0, Math.PI * 2);
  ctx.stroke();

  drawLabel(ctx, x, y - 35, 'Writing token...', 'highlight');
}

/**
 * Render Displacement Scene
 */

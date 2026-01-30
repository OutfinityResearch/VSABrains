/**
 * Scene renderer: Path
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Path Scene
 */
export function renderPathScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const path = PATHS[0];
  const visibleCells = path.slice(0, Math.floor(phase * path.length)).map(p => ({ x: p.x, y: p.y, tokens: [p.token] }));

  drawGrid(ctx, visibleCells, null, true);
  drawPath(ctx, path, COLORS.path1, phase, false);

  const stepCount = Math.floor(phase * path.length);
  drawInfoBox(ctx, baseWidth - 200, 50, 'Path Progress', [
    `Step: ${stepCount} / ${path.length}`,
    `Tokens written: ${stepCount}`,
    `Cells visited: ${new Set(path.slice(0, stepCount).map(p => `${p.x},${p.y}`)).size}`
  ]);

}

/**
 * Render Multi-Column Scene
 */

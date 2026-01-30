/**
 * Scene renderer: MultiColumn
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Multi-Column Scene
 */
export function renderMultiColumnScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);
  drawGrid(ctx, [], null, false);

  const colors = [COLORS.path1, COLORS.path2, COLORS.path3];

  PATHS.forEach((path, idx) => {
    drawPath(ctx, path, colors[idx], phase, false);
  });

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 12px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';

  colors.forEach((color, idx) => {
    const ly = 60 + idx * 25;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(baseWidth - 180, ly, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.text;
    ctx.fillText(`Column ${idx + 1} (offset: ${[15, 18, 13][idx]}, ${[14, 16, 18][idx]})`, baseWidth - 165, ly + 4);
  });

}

/**
 * Render Alignment Scene - Mapping different column frames into a shared frame
 */

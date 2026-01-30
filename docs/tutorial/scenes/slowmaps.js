/**
 * Scene renderer: SlowMaps
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Slow Maps Scene
 */
export function renderSlowMapsScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const fastGridOffset = { x: 40, y: 80 };
  const slowGridOffset = { x: 480, y: 80 };
  const miniCellSize = 28;
  const miniGridSize = 8;

  // Labels
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Fast Map (every step)', fastGridOffset.x + miniGridSize * miniCellSize / 2, fastGridOffset.y - 20);
  ctx.fillText('Slow Map (every 5 steps)', slowGridOffset.x + miniGridSize * miniCellSize / 2, slowGridOffset.y - 20);

  function drawMiniGrid(offset, color, pathProgress) {
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let i = 0; i <= miniGridSize; i++) {
      ctx.beginPath();
      ctx.moveTo(offset.x + i * miniCellSize, offset.y);
      ctx.lineTo(offset.x + i * miniCellSize, offset.y + miniGridSize * miniCellSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(offset.x, offset.y + i * miniCellSize);
      ctx.lineTo(offset.x + miniGridSize * miniCellSize, offset.y + i * miniCellSize);
      ctx.stroke();
    }

    const pathSteps = Math.floor(pathProgress * 15);
    let x = 2, y = 2;
    const visited = [];

    ctx.strokeStyle = color + 'aa';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < pathSteps; i++) {
      const px = offset.x + (x + 0.5) * miniCellSize;
      const py = offset.y + (y + 0.5) * miniCellSize;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);

      visited.push({ x, y });

      const dx = ((i * 7) % 3) - 1;
      const dy = ((i * 11) % 3) - 1;
      x = ((x + dx) % miniGridSize + miniGridSize) % miniGridSize;
      y = ((y + dy) % miniGridSize + miniGridSize) % miniGridSize;
    }
    ctx.stroke();

    if (pathSteps > 0) {
      const last = visited[visited.length - 1];
      const px = offset.x + (last.x + 0.5) * miniCellSize;
      const py = offset.y + (last.y + 0.5) * miniCellSize;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    return pathSteps;
  }

  const fastSteps = drawMiniGrid(fastGridOffset, COLORS.path1, phase);
  const slowPhase = Math.floor(phase * 15 / 5) * 5 / 15;
  drawMiniGrid(slowGridOffset, COLORS.path2, slowPhase);

  if (phase > 0.3) {
    const windowNum = Math.floor(phase * 3);
    ctx.fillStyle = COLORS.vote;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Window ${windowNum + 1} summary`, slowGridOffset.x + miniGridSize * miniCellSize / 2, slowGridOffset.y + miniGridSize * miniCellSize + 20);
  }

  // Arrow between grids
  const arrowY = fastGridOffset.y + miniGridSize * miniCellSize / 2;
  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(fastGridOffset.x + miniGridSize * miniCellSize + 20, arrowY);
  ctx.lineTo(slowGridOffset.x - 20, arrowY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(slowGridOffset.x - 20, arrowY);
  ctx.lineTo(slowGridOffset.x - 30, arrowY - 6);
  ctx.lineTo(slowGridOffset.x - 30, arrowY + 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.muted;
  ctx.font = '9px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Summary', (fastGridOffset.x + miniGridSize * miniCellSize + slowGridOffset.x) / 2, arrowY - 10);
  ctx.fillText('every N steps', (fastGridOffset.x + miniGridSize * miniCellSize + slowGridOffset.x) / 2, arrowY + 15);

  drawInfoBox(ctx, 40, 360, 'Fast Map', [
    `Steps written: ${fastSteps}`,
    'Writes every step',
    'Detailed trajectory'
  ]);

  drawInfoBox(ctx, 480, 360, 'Slow Map', [
    `Windows written: ${Math.floor(slowPhase * 3) + 1}`,
    'Writes every 5 steps',
    'Abstract summaries'
  ]);

}

/**
 * Render Reasoning Scene
 */

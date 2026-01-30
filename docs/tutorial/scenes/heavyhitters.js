/**
 * Scene renderer: HeavyHitters
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Heavy-Hitters Scene
 */
export function renderHeavyHittersScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const cellX = 14;
  const cellY = 14;
  const px = GRID_OFFSET.x + (cellX - GRID_VIEW.startX) * CELL_SIZE;
  const py = GRID_OFFSET.y + (cellY - GRID_VIEW.startY) * CELL_SIZE;

  drawGrid(ctx, [{ x: cellX, y: cellY, tokens: [] }], { x: cellX, y: cellY }, false);

  const K = 4;
  const tokensArriving = [42, 17, 89, 23, 56];
  const numArrived = Math.min(Math.floor(phase * 6), tokensArriving.length);

  const cellContents = tokensArriving.slice(0, Math.min(numArrived, K));
  const evicted = numArrived > K ? tokensArriving[0] : null;

  const positions = [
    { dx: 8, dy: 10 },
    { dx: 22, dy: 10 },
    { dx: 8, dy: 24 },
    { dx: 22, dy: 24 }
  ];

  cellContents.forEach((token, i) => {
    const isEvicted = evicted && i === 0 && numArrived > K;
    ctx.fillStyle = isEvicted ? 'rgba(239, 68, 68, 0.5)' : COLORS.token;
    ctx.beginPath();
    ctx.arc(px + positions[i].dx, py + positions[i].dy, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isEvicted ? '#fca5a5' : '#fff';
    ctx.font = 'bold 8px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(token), px + positions[i].dx, py + positions[i].dy);
  });

  if (numArrived < tokensArriving.length) {
    const incomingToken = tokensArriving[numArrived];
    const arrowX = px + CELL_SIZE + 30;
    const arrowY = py + CELL_SIZE / 2;

    ctx.strokeStyle = COLORS.displacement;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(arrowX + 40, arrowY);
    ctx.lineTo(arrowX, arrowY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.displacement;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX + 8, arrowY - 5);
    ctx.lineTo(arrowX + 8, arrowY + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.token;
    ctx.beginPath();
    ctx.arc(arrowX + 55, arrowY, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px "Space Grotesk", sans-serif';
    ctx.fillText(String(incomingToken), arrowX + 55, arrowY + 3);
  }

  if (evicted && phase > 0.8) {
    ctx.fillStyle = '#ef4444';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Evicted: ${evicted} (least frequent)`, px - 10, py + CELL_SIZE + 20);
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Heavy-Hitters (K=4)', [
    `Tokens arrived: ${numArrived}`,
    `Cell capacity: ${K}`,
    numArrived > K ? 'Eviction triggered!' : 'Storing...',
    'Keeps top-K by frequency'
  ]);

  // Saturation meter
  const saturation = Math.min(numArrived / K, 1);
  const meterX = baseWidth - 200;
  const meterY = 180;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(meterX, meterY, 160, 40);
  ctx.strokeStyle = COLORS.muted;
  ctx.strokeRect(meterX, meterY, 160, 40);

  ctx.fillStyle = COLORS.muted;
  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Cell Saturation', meterX + 10, meterY + 15);

  ctx.fillStyle = saturation >= 1 ? '#ef4444' : COLORS.locMatch;
  ctx.fillRect(meterX + 10, meterY + 22, 140 * saturation, 10);

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 9px "Space Grotesk", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(saturation * 100)}%`, meterX + 150, meterY + 31);

}

/**
 * Render Replay Scene
 */

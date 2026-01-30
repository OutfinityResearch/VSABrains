/**
 * Scene renderer: Replay
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Replay Scene
 */
export function renderReplayScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);
  drawGrid(ctx, [], null, false);

  const path = PATHS[0];

  // Faded full path
  ctx.strokeStyle = COLORS.path1 + '33';
  ctx.lineWidth = 2;
  ctx.beginPath();
  path.forEach((point, idx) => {
    if (!isInView(point.x, point.y)) return;
    const { x, y } = gridToPixel(point.x, point.y);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Checkpoint marker
  const checkpointStep = 5;
  const checkpointPos = path[checkpointStep];
  if (checkpointPos && isInView(checkpointPos.x, checkpointPos.y)) {
    const { x, y } = gridToPixel(checkpointPos.x, checkpointPos.y);
    ctx.strokeStyle = COLORS.vote;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = COLORS.vote;
    ctx.font = 'bold 9px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Checkpoint', x, y - 28);
    ctx.fillText(`Step ${checkpointStep}`, x, y + 32);
  }

  const targetStep = Math.min(checkpointStep + Math.floor(phase * 10) + 1, path.length - 1);
  const targetPos = path[targetStep];

  // Replay progress
  if (phase > 0.2) {
    const replayProgress = Math.min((phase - 0.2) / 0.6, 1);
    const replayEnd = checkpointStep + Math.floor(replayProgress * (targetStep - checkpointStep));

    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = checkpointStep; i <= replayEnd && i < path.length; i++) {
      const point = path[i];
      if (!isInView(point.x, point.y)) continue;
      const { x, y } = gridToPixel(point.x, point.y);
      if (i === checkpointStep) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const replayPos = path[replayEnd];
    if (replayPos && isInView(replayPos.x, replayPos.y)) {
      const { x, y } = gridToPixel(replayPos.x, replayPos.y);
      ctx.fillStyle = COLORS.locMatch;
      ctx.shadowColor = COLORS.locMatch;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Target marker
  if (targetPos && isInView(targetPos.x, targetPos.y)) {
    const { x, y } = gridToPixel(targetPos.x, targetPos.y);
    ctx.strokeStyle = COLORS.displacement;
    ctx.setLineDash([4, 2]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.displacement;
    ctx.font = '9px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Query target', x, y - 22);
    ctx.fillText(`Step ${targetStep}`, x, y + 28);
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Replay from Checkpoint', [
    `Checkpoint: step ${checkpointStep}`,
    `Target: step ${targetStep}`,
    `Replay steps: ${targetStep - checkpointStep}`,
    phase > 0.8 ? 'State reconstructed!' : 'Replaying events...'
  ]);

}

/**
 * Render Slow Maps Scene
 */

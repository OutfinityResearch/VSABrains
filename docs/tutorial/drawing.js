/**
 * Tutorial Drawing Utilities
 * Low-level drawing functions for grid, paths, and UI elements
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET } from './config.js';

/**
 * Draw radial gradient background
 */
export function drawGridBackground(ctx, baseWidth, baseHeight) {
  const gradient = ctx.createRadialGradient(
    baseWidth / 2, baseHeight / 2, 0,
    baseWidth / 2, baseHeight / 2, baseWidth
  );
  gradient.addColorStop(0, '#1e293b');
  gradient.addColorStop(1, COLORS.bg);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, baseWidth, baseHeight);
}

/**
 * Draw the main grid with optional highlighted cells
 */
export function drawGrid(ctx, highlightCells = [], activeCell = null, showTokens = false) {
  const { startX, startY, size } = GRID_VIEW;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const gx = startX + col;
      const gy = startY + row;
      const px = GRID_OFFSET.x + col * CELL_SIZE;
      const py = GRID_OFFSET.y + row * CELL_SIZE;

      const isHighlighted = highlightCells.some(c => c.x === gx && c.y === gy);
      const isActive = activeCell && activeCell.x === gx && activeCell.y === gy;

      if (isActive) {
        ctx.fillStyle = COLORS.cellActive;
        ctx.shadowColor = COLORS.cellActive;
        ctx.shadowBlur = 15;
      } else if (isHighlighted) {
        ctx.fillStyle = COLORS.cellHighlight;
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = COLORS.cell;
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.roundRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2, 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (showTokens && isHighlighted) {
        const cellTokens = highlightCells.find(c => c.x === gx && c.y === gy)?.tokens || [];
        drawCellTokens(ctx, px, py, cellTokens);
      }
    }
  }

  // Grid lines
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 1;

  for (let i = 0; i <= size; i++) {
    ctx.beginPath();
    ctx.moveTo(GRID_OFFSET.x + i * CELL_SIZE, GRID_OFFSET.y);
    ctx.lineTo(GRID_OFFSET.x + i * CELL_SIZE, GRID_OFFSET.y + size * CELL_SIZE);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(GRID_OFFSET.x, GRID_OFFSET.y + i * CELL_SIZE);
    ctx.lineTo(GRID_OFFSET.x + size * CELL_SIZE, GRID_OFFSET.y + i * CELL_SIZE);
    ctx.stroke();
  }

  // Axis labels
  ctx.fillStyle = COLORS.muted;
  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';

  for (let i = 0; i < size; i += 2) {
    ctx.fillText(String(startX + i), GRID_OFFSET.x + i * CELL_SIZE + CELL_SIZE / 2, GRID_OFFSET.y - 8);
    ctx.textAlign = 'right';
    ctx.fillText(String(startY + i), GRID_OFFSET.x - 8, GRID_OFFSET.y + i * CELL_SIZE + CELL_SIZE / 2 + 3);
    ctx.textAlign = 'center';
  }
}

/**
 * Draw tokens inside a cell
 */
export function drawCellTokens(ctx, px, py, tokens) {
  const maxTokens = 4;
  const tokenSize = 6;
  const positions = [
    { dx: 8, dy: 10 },
    { dx: 22, dy: 10 },
    { dx: 8, dy: 24 },
    { dx: 22, dy: 24 }
  ];

  tokens.slice(0, maxTokens).forEach((token, i) => {
    ctx.fillStyle = COLORS.token;
    ctx.beginPath();
    ctx.arc(px + positions[i].dx, py + positions[i].dy, tokenSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.textDark;
    ctx.font = 'bold 7px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(token % 100), px + positions[i].dx, py + positions[i].dy);
  });
}

/**
 * Convert grid coordinates to pixel coordinates
 */
export function gridToPixel(gx, gy) {
  const { startX, startY } = GRID_VIEW;
  return {
    x: GRID_OFFSET.x + (gx - startX) * CELL_SIZE + CELL_SIZE / 2,
    y: GRID_OFFSET.y + (gy - startY) * CELL_SIZE + CELL_SIZE / 2
  };
}

/**
 * Check if grid coordinate is in view
 */
export function isInView(gx, gy) {
  const { startX, startY, size } = GRID_VIEW;
  return gx >= startX && gx < startX + size && gy >= startY && gy < startY + size;
}

/**
 * Draw a path through the grid
 */
export function drawPath(ctx, path, color, progress, showDisplacement = false) {
  const visibleSteps = Math.floor(progress * path.length);
  if (visibleSteps < 1) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  let started = false;

  for (let i = 0; i < visibleSteps && i < path.length; i++) {
    const point = path[i];
    if (!isInView(point.x, point.y)) continue;

    const { x, y } = gridToPixel(point.x, point.y);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Draw points on path
  for (let i = 0; i < visibleSteps && i < path.length; i++) {
    const point = path[i];
    if (!isInView(point.x, point.y)) continue;

    const { x, y } = gridToPixel(point.x, point.y);
    const isCurrent = i === visibleSteps - 1;

    ctx.beginPath();
    ctx.fillStyle = isCurrent ? '#fff' : color;
    ctx.shadowColor = isCurrent ? '#fff' : 'transparent';
    ctx.shadowBlur = isCurrent ? 12 : 0;
    ctx.arc(x, y, isCurrent ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (isCurrent || i === 0) {
      ctx.fillStyle = COLORS.textDark;
      ctx.font = 'bold 9px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), x, y);
    }

    if (showDisplacement && i > 0 && i === visibleSteps - 1 && point.dx !== undefined) {
      drawDisplacementArrow(ctx, x, y, point.dx, point.dy);
    }
  }
}

/**
 * Draw displacement arrow
 */
export function drawDisplacementArrow(ctx, x, y, dx, dy) {
  const arrowLen = 25;
  const angle = Math.atan2(dy, dx);
  const endX = x + Math.cos(angle) * arrowLen;
  const endY = y + Math.sin(angle) * arrowLen;

  ctx.strokeStyle = COLORS.displacement;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 2]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  const headLen = 8;
  ctx.fillStyle = COLORS.displacement;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
  ctx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.text;
  ctx.font = '11px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`(${dx >= 0 ? '+' : ''}${dx}, ${dy >= 0 ? '+' : ''}${dy})`, endX + 20, endY);
}

/**
 * Draw localization match markers
 */
export function drawLocalizationMatch(ctx, candidates, phase) {
  candidates.forEach((cand, idx) => {
    if (!isInView(cand.x, cand.y)) return;

    const { x, y } = gridToPixel(cand.x, cand.y);
    const pulse = 1 + Math.sin(phase * Math.PI * 4 + idx) * 0.2;

    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 18 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = COLORS.locMatch;
    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${(cand.score * 100).toFixed(0)}%`, x, y + 32);
  });
}

/**
 * Draw voting circle visualization
 */
export function drawVotingCircle(ctx, columns, votes, winnerIdx, phase, baseWidth, baseHeight) {
  const centerX = baseWidth - 150;
  const centerY = baseHeight / 2;
  const radius = 80;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  columns.forEach((col, idx) => {
    const angle = (idx / columns.length) * Math.PI * 2 - Math.PI / 2;
    const cx = centerX + Math.cos(angle) * radius;
    const cy = centerY + Math.sin(angle) * radius;
    const isWinner = idx === winnerIdx;

    ctx.fillStyle = isWinner ? COLORS.voteWin : col.color;
    ctx.shadowColor = isWinner ? COLORS.voteWin : 'transparent';
    ctx.shadowBlur = isWinner ? 15 : 0;
    ctx.beginPath();
    ctx.arc(cx, cy, isWinner ? 18 : 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(votes[idx]), cx, cy);

    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.fillText(`C${idx + 1}`, cx, cy + 28);
  });

  if (winnerIdx >= 0 && phase > 0.6) {
    ctx.fillStyle = COLORS.voteWin;
    ctx.shadowColor = COLORS.voteWin;
    ctx.shadowBlur = 20;
    ctx.font = 'bold 28px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', centerX, centerY);
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.text;
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.fillText('Consensus', centerX, centerY + 25);
  }
}

/**
 * Draw context window visualization
 */
export function drawContextWindow(ctx, tokens, idx, x, y) {
  const windowSize = 2;
  const start = Math.max(0, idx - windowSize + 1);
  const windowTokens = tokens.slice(start, idx + 1);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x - 50, y - 15, 100, 50, 8);
  ctx.fill();

  ctx.strokeStyle = COLORS.displacement;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.muted;
  ctx.font = '10px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Context Window', x, y);

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px "Space Grotesk", sans-serif';
  ctx.fillText(`[${windowTokens.join(', ')}]`, x, y + 20);
}

/**
 * Draw info box with title and lines
 */
export function drawInfoBox(ctx, x, y, title, lines) {
  const padding = 12;
  const lineHeight = 18;
  const width = 180;
  const height = padding * 2 + lineHeight * (lines.length + 1);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();

  ctx.strokeStyle = COLORS.muted;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 12px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + padding, y + padding + 12);

  ctx.fillStyle = COLORS.muted;
  ctx.font = '11px "Space Grotesk", sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + padding, y + padding + 12 + (i + 1) * lineHeight);
  });
}

/**
 * Draw text label
 */
export function drawLabel(ctx, x, y, text, style = 'normal', align = 'center') {
  ctx.fillStyle = style === 'highlight' ? COLORS.text : COLORS.muted;
  ctx.font = style === 'highlight' 
    ? 'bold 13px "Space Grotesk", sans-serif' 
    : '12px "Space Grotesk", sans-serif';
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

/**
 * Draw branching path visualization
 */
export function drawBranchingPath(ctx, paths, phase, baseWidth) {
  const mainPath = paths[0];
  const branchPoint = 8;

  ctx.strokeStyle = COLORS.path1;
  ctx.lineWidth = 3;
  ctx.beginPath();

  for (let i = 0; i < branchPoint && i < mainPath.length; i++) {
    const { x, y } = gridToPixel(mainPath[i].x, mainPath[i].y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  if (phase > 0.3) {
    const bp = mainPath[branchPoint];
    if (isInView(bp.x, bp.y)) {
      const { x, y } = gridToPixel(bp.x, bp.y);
      const pulse = 1 + Math.sin(phase * 8) * 0.15;

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 15 * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = COLORS.text;
      ctx.font = '10px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Branch', x, y - 25);
    }
  }

  if (phase > 0.5) {
    const branchPhase = (phase - 0.5) / 0.5;
    const visibleAfterBranch = Math.floor(branchPhase * (mainPath.length - branchPoint));

    ctx.strokeStyle = COLORS.path1;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    for (let i = branchPoint; i < branchPoint + visibleAfterBranch && i < mainPath.length; i++) {
      const { x, y } = gridToPixel(mainPath[i].x, mainPath[i].y);
      if (i === branchPoint) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (paths[1]) {
      ctx.strokeStyle = COLORS.path2;
      ctx.beginPath();
      for (let i = branchPoint; i < branchPoint + visibleAfterBranch && i < paths[1].length; i++) {
        const { x, y } = gridToPixel(paths[1][i].x, paths[1][i].y);
        if (i === branchPoint) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  if (phase > 0.7) {
    ctx.fillStyle = COLORS.path1;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Hypothesis A', baseWidth - 140, 80);

    ctx.fillStyle = COLORS.path2;
    ctx.fillText('Hypothesis B', baseWidth - 140, 100);
  }
}

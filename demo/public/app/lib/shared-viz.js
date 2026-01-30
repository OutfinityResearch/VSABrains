/**
 * Shared Visualization Module
 * Brings tutorial-style elegant graphics to the demo
 * 
 * This module exports drawing functions that match the tutorial's visual style
 * and can be used by both the demo and the tutorial.
 */

// Colors matching the tutorial style
export const TUTORIAL_COLORS = {
  bg: '#0f172a',
  bgGradientStart: '#1e293b',
  grid: 'rgba(99, 102, 241, 0.15)',
  gridLine: 'rgba(99, 102, 241, 0.25)',
  cell: 'rgba(99, 102, 241, 0.3)',
  cellActive: '#818cf8',
  cellHighlight: '#a5b4fc',

  // Paths for different columns
  path1: '#f472b6',
  path2: '#22d3ee',
  path3: '#4ade80',
  path4: '#fbbf24',

  token: '#e879f9',
  tokenFade: 'rgba(232, 121, 249, 0.3)',

  displacement: '#f97316',
  displacementArrow: '#fb923c',

  locMatch: '#22c55e',
  locMatchFade: 'rgba(34, 197, 94, 0.2)',

  vote: '#8b5cf6',
  voteWin: '#22c55e',

  text: '#e2e8f0',
  muted: 'rgba(226, 232, 240, 0.5)',
  textDark: 'rgba(0, 0, 0, 0.7)',

  // Info box
  infoBox: 'rgba(15, 23, 42, 0.92)',
  infoBorder: 'rgba(99, 102, 241, 0.4)'
};

/**
 * Visualization modes corresponding to tutorial phases
 */
export const VIZ_MODES = {
  GRID: 'grid',           // Basic grid view
  DISPLACEMENT: 'displacement',  // Show displacement vectors
  PATH: 'path',           // Path tracing
  MULTICOLUMN: 'multicolumn',   // Multiple columns
  LOCALIZATION: 'localization', // Localization candidates
  VOTING: 'voting',       // Voting visualization
  BRANCHING: 'branching', // Branching paths
  PREDICTION: 'prediction',    // Prediction loop
  HEAVYHITTERS: 'heavyhitters', // Cell saturation
  REPLAY: 'replay',       // Replay visualization
  SLOWMAPS: 'slowmaps',   // Multi-timescale
  REASONING: 'reasoning'  // Work signatures
};

/**
 * Draw elegant gradient background matching tutorial style
 */
export function drawElegantBackground(ctx, width, height) {
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, width
  );
  gradient.addColorStop(0, TUTORIAL_COLORS.bgGradientStart);
  gradient.addColorStop(1, TUTORIAL_COLORS.bg);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw grid with tutorial-style rounded cells
 */
export function drawElegantGrid(ctx, width, height, cellSize, options = {}) {
  const {
    highlightCells = [],
    activeCell = null,
    showTokens = false,
    gridWidth = 64,
    gridHeight = 64
  } = options;

  // Draw background
  drawElegantBackground(ctx, width, height);

  // Draw grid lines
  ctx.strokeStyle = TUTORIAL_COLORS.gridLine;
  ctx.lineWidth = 1;

  // Draw major grid lines every 4 cells
  for (let x = 0; x <= gridWidth; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, height);
    ctx.stroke();
  }
  for (let y = 0; y <= gridHeight; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(width, y * cellSize);
    ctx.stroke();
  }

  // Draw highlighted cells with rounded corners
  highlightCells.forEach(cell => {
    const px = cell.x * cellSize;
    const py = cell.y * cellSize;
    const isActive = activeCell && activeCell.x === cell.x && activeCell.y === cell.y;

    if (isActive) {
      ctx.fillStyle = TUTORIAL_COLORS.cellActive;
      ctx.shadowColor = TUTORIAL_COLORS.cellActive;
      ctx.shadowBlur = 15;
    } else {
      ctx.fillStyle = TUTORIAL_COLORS.cellHighlight;
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(px + 1, py + 1, cellSize - 2, cellSize - 2, 4);
    } else {
      ctx.rect(px + 1, py + 1, cellSize - 2, cellSize - 2);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

/**
 * Draw displacement vector with tutorial style
 */
export function drawDisplacementVector(ctx, fromX, fromY, toX, toY, dx, dy, cellSize) {
  if (dx === 0 && dy === 0) return;

  const fx = (fromX + 0.5) * cellSize;
  const fy = (fromY + 0.5) * cellSize;
  const tx = (toX + 0.5) * cellSize;
  const ty = (toY + 0.5) * cellSize;

  // Dashed line
  ctx.strokeStyle = TUTORIAL_COLORS.displacement;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrow head
  const angle = Math.atan2(ty - fy, tx - fx);
  const headLen = 10;
  ctx.fillStyle = TUTORIAL_COLORS.displacement;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - headLen * Math.cos(angle - 0.4), ty - headLen * Math.sin(angle - 0.4));
  ctx.lineTo(tx - headLen * Math.cos(angle + 0.4), ty - headLen * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();

  // Label
  const midX = (fx + tx) / 2;
  const midY = (fy + ty) / 2;
  const label = `(${dx >= 0 ? '+' : ''}${dx}, ${dy >= 0 ? '+' : ''}${dy})`;
  ctx.fillStyle = TUTORIAL_COLORS.text;
  ctx.font = '11px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, midX, midY - 8);
}

/**
 * Draw localization candidates with pulse animation
 */
export function drawLocalizationCandidates(ctx, candidates, cellSize, phase = 1) {
  if (!candidates?.length) return;

  candidates.slice(0, 5).forEach((cand, idx) => {
    const x = (cand.location.x + 0.5) * cellSize;
    const y = (cand.location.y + 0.5) * cellSize;
    const pulse = 1 + Math.sin(phase * Math.PI * 4 + idx) * 0.15;
    const radius = cellSize * 0.4 * pulse;

    // Outer glow
    ctx.strokeStyle = TUTORIAL_COLORS.locMatch;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Fill
    ctx.fillStyle = TUTORIAL_COLORS.locMatchFade;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Score label
    const score = cand.score ?? cand.matches ?? 0;
    const scoreText = typeof score === 'number' && score <= 1
      ? `${Math.round(score * 100)}%`
      : String(score);
    ctx.fillStyle = TUTORIAL_COLORS.locMatch;
    ctx.font = 'bold 10px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(scoreText, x, y + radius + 14);
  });
}

/**
 * Draw voting circle with column markers
 */
export function drawVotingCircle(ctx, columns, votes, winnerIdx, phase, centerX, centerY, radius = 50) {
  if (!columns?.length) return;

  const columnColors = [
    TUTORIAL_COLORS.path1,
    TUTORIAL_COLORS.path2,
    TUTORIAL_COLORS.path3,
    TUTORIAL_COLORS.path4
  ];

  // Background
  ctx.fillStyle = TUTORIAL_COLORS.infoBox;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 15, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = TUTORIAL_COLORS.infoBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Column positions
  columns.forEach((col, idx) => {
    const angle = (idx / columns.length) * Math.PI * 2 - Math.PI / 2;
    const cx = centerX + Math.cos(angle) * radius;
    const cy = centerY + Math.sin(angle) * radius;
    const isWinner = idx === winnerIdx;
    const color = columnColors[idx % columnColors.length];

    // Column circle
    ctx.fillStyle = isWinner ? TUTORIAL_COLORS.voteWin : color;
    if (isWinner) {
      ctx.shadowColor = TUTORIAL_COLORS.voteWin;
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.arc(cx, cy, isWinner ? 14 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Vote count
    if (votes?.[idx] != null) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(votes[idx]), cx, cy);
    }
  });

  // Center consensus indicator
  if (winnerIdx >= 0 && phase > 0.7) {
    ctx.fillStyle = TUTORIAL_COLORS.voteWin;
    ctx.shadowColor = TUTORIAL_COLORS.voteWin;
    ctx.shadowBlur = 15;
    ctx.font = 'bold 20px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', centerX, centerY);
    ctx.shadowBlur = 0;

    ctx.fillStyle = TUTORIAL_COLORS.muted;
    ctx.font = '9px "Space Grotesk", sans-serif';
    ctx.fillText('Consensus', centerX, centerY + 18);
  }
}

/**
 * Draw info box with rounded corners
 */
export function drawInfoBox(ctx, x, y, title, lines) {
  const padding = 12;
  const lineHeight = 16;
  const width = 170;
  const height = padding * 2 + lineHeight * (lines.length + 1);

  // Box
  ctx.fillStyle = TUTORIAL_COLORS.infoBox;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, 6);
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.fill();

  ctx.strokeStyle = TUTORIAL_COLORS.infoBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Title
  ctx.fillStyle = TUTORIAL_COLORS.text;
  ctx.font = 'bold 11px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + padding, y + padding + 10);

  // Lines
  ctx.fillStyle = TUTORIAL_COLORS.muted;
  ctx.font = '10px "Space Grotesk", sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + padding, y + padding + 10 + (i + 1) * lineHeight);
  });
}

/**
 * Draw saturation heatmap overlay
 */
export function drawSaturationHeatmap(ctx, diagnostics, cellSize, width, height) {
  if (!diagnostics?.cellData) return;

  for (const cell of diagnostics.cellData) {
    const { x, y, saturation } = cell;
    if (saturation <= 0) continue;

    // Color based on saturation: green → yellow → red
    let color;
    if (saturation < 0.5) {
      const t = saturation * 2;
      color = `rgba(${Math.round(255 * t)}, 200, 50, 0.4)`;
    } else {
      const t = (saturation - 0.5) * 2;
      color = `rgba(255, ${Math.round(200 * (1 - t))}, 50, 0.5)`;
    }

    ctx.fillStyle = color;
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  }
}

/**
 * Draw path with dots at each step
 */
export function drawPathWithDots(ctx, path, color, cellSize, progress = 1) {
  if (!path?.length) return;

  const visibleSteps = Math.floor(progress * path.length);
  if (visibleSteps < 1) return;

  // Draw path line
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  for (let i = 0; i < visibleSteps && i < path.length; i++) {
    const loc = path[i];
    const px = (loc.x + 0.5) * cellSize;
    const py = (loc.y + 0.5) * cellSize;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Draw dots
  for (let i = 0; i < visibleSteps && i < path.length; i++) {
    const loc = path[i];
    const px = (loc.x + 0.5) * cellSize;
    const py = (loc.y + 0.5) * cellSize;
    const isCurrent = i === visibleSteps - 1;

    ctx.fillStyle = isCurrent ? '#fff' : color;
    ctx.shadowColor = isCurrent ? '#fff' : 'transparent';
    ctx.shadowBlur = isCurrent ? 12 : 0;
    ctx.beginPath();
    ctx.arc(px, py, isCurrent ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/**
 * Draw column markers with glow effect
 */
export function drawColumnMarkers(ctx, columns, cellSize, columnColors) {
  if (!columns?.length) return;

  const offsets = [
    { x: -0.2, y: -0.15 },
    { x: 0.2, y: -0.1 },
    { x: -0.1, y: 0.2 },
    { x: 0.15, y: 0.2 }
  ];

  columns.forEach((loc, idx) => {
    const px = (loc.x + 0.5 + offsets[idx % offsets.length].x) * cellSize;
    const py = (loc.y + 0.5 + offsets[idx % offsets.length].y) * cellSize;
    const color = columnColors[idx % columnColors.length];

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(px, py, cellSize * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

/**
 * Draw footer label
 */
export function drawFooterLabel(ctx, text, width, height) {
  ctx.fillStyle = TUTORIAL_COLORS.text;
  ctx.font = 'bold 13px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, width / 2, height - 25);
}

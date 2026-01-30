/**
 * Scene renderer: Conflict
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Conflict Scene - When Facts Disagree
 */
export function renderConflictScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  // Two conflicting source boxes
  const source1X = 60;
  const source2X = 450;
  const sourceY = 80;
  const sourceW = 300;
  const sourceH = 120;

  // Source A
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(source1X, sourceY, sourceW, sourceH, 8);
  ctx.fill();
  ctx.strokeStyle = COLORS.path1;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.path1;
  ctx.font = 'bold 13px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Source A (news-2024-01)', source1X + 15, sourceY + 22);

  ctx.fillStyle = COLORS.text;
  ctx.font = '12px "Space Grotesk", monospace';
  ctx.fillText('company: "Acme Corp"', source1X + 20, sourceY + 50);
  ctx.fillText('ceo: "John Smith"', source1X + 20, sourceY + 70);
  ctx.fillText('timestamp: 2024-01-15', source1X + 20, sourceY + 90);

  // Source B
  if (phase > 0.2) {
    const alpha = Math.min(1, (phase - 0.2) / 0.15);
    ctx.globalAlpha = alpha;
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(source2X, sourceY, sourceW, sourceH, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.path2;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.path2;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('Source B (press-2024-03)', source2X + 15, sourceY + 22);

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillText('company: "Acme Corp"', source2X + 20, sourceY + 50);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('ceo: "Jane Doe"', source2X + 20, sourceY + 70);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('timestamp: 2024-03-20', source2X + 20, sourceY + 90);
    ctx.globalAlpha = 1;
  }

  // Conflict detection
  if (phase > 0.35) {
    const conflictY = 230;
    const alpha = Math.min(1, (phase - 0.35) / 0.15);

    ctx.globalAlpha = alpha;
    
    // Lightning bolt between sources
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(source1X + sourceW + 20, sourceY + sourceH / 2);
    ctx.lineTo(source1X + sourceW + 50, sourceY + sourceH / 2 - 15);
    ctx.lineTo(source1X + sourceW + 40, sourceY + sourceH / 2);
    ctx.lineTo(source1X + sourceW + 70, sourceY + sourceH / 2 + 15);
    ctx.stroke();

    // Conflict box
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.beginPath();
    ctx.roundRect(200, conflictY, 450, 80, 8);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 14px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('⚠ CONFLICT DETECTED', 220, conflictY + 25);

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px "Space Grotesk", sans-serif';
    ctx.fillText('Entity: Acme Corp | Predicate: ceo', 220, conflictY + 48);
    ctx.fillText('Source A says "John Smith" ≠ Source B says "Jane Doe"', 220, conflictY + 68);
    ctx.globalAlpha = 1;
  }

  // Resolution strategies
  if (phase > 0.55) {
    const resX = 100;
    const resY = 340;
    const alpha = Math.min(1, (phase - 0.55) / 0.2);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(resX, resY, 650, 100, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.vote;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.vote;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('Resolution Strategies', resX + 15, resY + 25);

    const strategies = [
      { label: 'Recency', value: 'Source B wins (newer)', color: COLORS.locMatch },
      { label: 'Credibility', value: 'Check source trust scores', color: COLORS.muted },
      { label: 'Voting', value: 'Other sources agree with...', color: COLORS.muted }
    ];

    strategies.forEach((strat, i) => {
      const stratX = resX + 20 + i * 210;
      ctx.fillStyle = strat.color;
      ctx.font = 'bold 11px "Space Grotesk", sans-serif';
      ctx.fillText(strat.label, stratX, resY + 50);
      ctx.fillStyle = COLORS.text;
      ctx.font = '10px "Space Grotesk", sans-serif';
      ctx.fillText(strat.value, stratX, resY + 68);
    });

    // Winner indication
    if (phase > 0.75) {
      ctx.fillStyle = COLORS.locMatch;
      ctx.font = 'bold 12px "Space Grotesk", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('→ Jane Doe (recency wins)', resX + 630, resY + 88);
    }
    ctx.globalAlpha = 1;
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Conflict Resolution', [
    'Detect via pattern match',
    'Surface contradictions',
    'Apply resolution rules',
    phase > 0.75 ? 'Emit with confidence' : 'Evaluating...'
  ]);

}

/**
 * Render Derivation Scene - Building Knowledge
 */

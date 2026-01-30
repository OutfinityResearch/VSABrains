/**
 * Scene renderer: Derivation
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Derivation Scene - Building Knowledge
 */
export function renderDerivationScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  // Premises at top
  const premiseY = 70;
  const premiseH = 65;
  
  // Premise 1
  const p1X = 80;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(p1X, premiseY, 280, premiseH, 6);
  ctx.fill();
  ctx.strokeStyle = COLORS.path1;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.path1;
  ctx.font = 'bold 11px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Premise 1 (fact)', p1X + 10, premiseY + 18);

  ctx.fillStyle = COLORS.text;
  ctx.font = '12px "Space Grotesk", monospace';
  ctx.fillText('parent(Alice, Bob)', p1X + 10, premiseY + 42);

  // Premise 2
  if (phase > 0.15) {
    const p2X = 400;
    const alpha = Math.min(1, (phase - 0.15) / 0.1);
    ctx.globalAlpha = alpha;
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(p2X, premiseY, 280, premiseH, 6);
    ctx.fill();
    ctx.strokeStyle = COLORS.path2;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.path2;
    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    ctx.fillText('Premise 2 (fact)', p2X + 10, premiseY + 18);

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillText('parent(Bob, Carol)', p2X + 10, premiseY + 42);
    ctx.globalAlpha = 1;
  }

  // Rule box
  if (phase > 0.3) {
    const ruleY = 170;
    const alpha = Math.min(1, (phase - 0.3) / 0.15);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
    ctx.beginPath();
    ctx.roundRect(180, ruleY, 500, 70, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.vote;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.vote;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('Rule: grandparent', 200, ruleY + 22);

    ctx.fillStyle = COLORS.text;
    ctx.font = '13px "Space Grotesk", monospace';
    ctx.fillText('IF parent(?X, ?Y) AND parent(?Y, ?Z)', 200, ruleY + 45);
    ctx.fillText('THEN grandparent(?X, ?Z)', 200, ruleY + 62);
    ctx.globalAlpha = 1;
  }

  // Unification arrows
  if (phase > 0.45) {
    const alpha = Math.min(1, (phase - 0.45) / 0.1);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = COLORS.displacement;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);

    // Arrow from premise 1 to rule
    ctx.beginPath();
    ctx.moveTo(220, premiseY + premiseH + 5);
    ctx.lineTo(300, 170);
    ctx.stroke();

    // Arrow from premise 2 to rule
    ctx.beginPath();
    ctx.moveTo(540, premiseY + premiseH + 5);
    ctx.lineTo(500, 170);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Bindings
  if (phase > 0.55) {
    const bindY = 265;
    const alpha = Math.min(1, (phase - 0.55) / 0.15);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(280, bindY, 300, 50, 6);
    ctx.fill();
    ctx.strokeStyle = COLORS.displacement;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.displacement;
    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    ctx.fillText('Bindings:', 295, bindY + 22);

    ctx.fillStyle = COLORS.text;
    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillText('?X=Alice, ?Y=Bob, ?Z=Carol', 375, bindY + 22);
    ctx.globalAlpha = 1;
  }

  // Derived fact
  if (phase > 0.7) {
    const derivedY = 340;
    const alpha = Math.min(1, (phase - 0.7) / 0.15);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.beginPath();
    ctx.roundRect(200, derivedY, 460, 80, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.locMatch;
    ctx.font = 'bold 14px "Space Grotesk", sans-serif';
    ctx.fillText('✓ Derived Fact', 220, derivedY + 25);

    ctx.fillStyle = COLORS.text;
    ctx.font = '14px "Space Grotesk", monospace';
    ctx.fillText('grandparent(Alice, Carol)', 220, derivedY + 50);

    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.fillText('Lineage: rule=grandparent, premises=[P1, P2], bindings={X→Alice, Y→Bob, Z→Carol}', 220, derivedY + 70);
    ctx.globalAlpha = 1;
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Derivation Chain', [
    'Premises = source facts',
    'Rules = inference templates',
    'Unification binds variables',
    phase > 0.7 ? 'Lineage is preserved' : 'Deriving...'
  ]);

}

/**
 * Render Entities Scene - Entity Resolution
 */

/**
 * Scene renderer: Reasoning
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render Reasoning Scene
 */
export function renderReasoningScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  const sigX = 100;
  const sigY = 100;
  const sigW = 300;
  const sigH = 120;

  // Fact signature box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(sigX, sigY, sigW, sigH, 8);
  ctx.fill();
  ctx.strokeStyle = COLORS.vote;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Fact (Work Signature)', sigX + 15, sigY + 25);

  const fact = { subject: 'Alice', predicate: 'enters', object: 'room_A' };

  ctx.font = '13px "Space Grotesk", monospace';
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('subject:', sigX + 20, sigY + 55);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`"${fact.subject}"`, sigX + 100, sigY + 55);

  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('predicate:', sigX + 20, sigY + 75);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`"${fact.predicate}"`, sigX + 100, sigY + 75);

  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('object:', sigX + 20, sigY + 95);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`"${fact.object}"`, sigX + 100, sigY + 95);

  // Pattern box
  const patX = 500;
  const patY = 100;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(patX, patY, sigW, sigH, 8);
  ctx.fill();
  ctx.strokeStyle = COLORS.displacement;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 14px "Space Grotesk", sans-serif';
  ctx.fillText('Pattern (with variable)', patX + 15, patY + 25);

  ctx.font = '13px "Space Grotesk", monospace';
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('subject:', patX + 20, patY + 55);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('?x', patX + 100, patY + 55);

  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('predicate:', patX + 20, patY + 75);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`"enters"`, patX + 100, patY + 75);

  ctx.fillStyle = '#a5b4fc';
  ctx.fillText('object:', patX + 20, patY + 95);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`"room_A"`, patX + 100, patY + 95);

  // Unification arrow
  if (phase > 0.3) {
    const arrowY = sigY + sigH + 50;
    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(sigX + sigW / 2, sigY + sigH + 10);
    ctx.quadraticCurveTo(baseWidth / 2, arrowY + 30, patX + sigW / 2, patY + sigH + 10);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS.locMatch;
    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Unification', baseWidth / 2, arrowY + 20);
  }

  // Bindings result
  if (phase > 0.5) {
    const bindX = baseWidth / 2 - 100;
    const bindY = 320;

    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.beginPath();
    ctx.roundRect(bindX, bindY, 200, 60, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.locMatch;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Bindings', bindX + 100, bindY + 22);

    ctx.font = '14px "Space Grotesk", monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('?x', bindX + 40, bindY + 45);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('→', bindX + 70, bindY + 45);
    ctx.fillText('"Alice"', bindX + 130, bindY + 45);
  }

  // Derivation chain
  if (phase > 0.7) {
    const chainX = 150;
    const chainY = 420;

    ctx.fillStyle = COLORS.muted;
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Derivation Chain:', chainX, chainY);

    const steps = [
      { label: 'Premise', text: 'Alice enters room_A' },
      { label: 'Rule', text: 'IF enters(X, Y) THEN location(X) = Y' },
      { label: 'Derived', text: 'location(Alice) = room_A' }
    ];

    steps.forEach((step, i) => {
      const stepY = chainY + 25 + i * 25;
      const alpha = Math.min(1, (phase - 0.7) / 0.1 * (i + 1));

      ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`;
      ctx.fillText(`${i + 1}. [${step.label}]`, chainX, stepY);

      ctx.fillStyle = `rgba(226, 232, 240, ${alpha})`;
      ctx.fillText(step.text, chainX + 120, stepY);
    });
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'Reasoning Primitives', [
    'Facts = structured bindings',
    'Patterns = templates with ?vars',
    'Unification = matching + binding',
    phase > 0.7 ? 'Chains = auditable derivations' : 'Building chain...'
  ]);

}

/**
 * Render VSA Index Scene - Semantic Addressing
 */

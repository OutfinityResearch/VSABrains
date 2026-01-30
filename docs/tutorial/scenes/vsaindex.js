/**
 * Scene renderer: VSAIndex
 */

import { COLORS, GRID_VIEW, CELL_SIZE, GRID_OFFSET, TOKENS, PATHS } from '../config.js';
import {
  drawGridBackground, drawGrid, drawPath, drawLabel, drawInfoBox,
  drawDisplacementArrow, drawLocalizationMatch, drawVotingCircle,
  drawContextWindow, drawBranchingPath, gridToPixel, isInView
} from '../drawing.js';

/**
 * Render VSA Index Scene - Semantic Addressing
 */
export function renderVSAIndexScene(ctx, phase, baseWidth, baseHeight) {
  drawGridBackground(ctx, baseWidth, baseHeight);

  // Draw hypervector visualization
  const hvX = 80;
  const hvY = 80;
  const hvW = 320;
  const hvH = 60;

  // Container for hypervector
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(hvX, hvY, hvW, hvH, 8);
  ctx.fill();
  ctx.strokeStyle = COLORS.token;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 12px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Hypervector (d=1024)', hvX + 10, hvY + 18);

  // Draw binary pattern
  const patternY = hvY + 35;
  const patternW = 300;
  const bitWidth = patternW / 64;
  
  for (let i = 0; i < 64; i++) {
    const bit = Math.sin(i * 0.5 + phase * 10) > 0 ? 1 : 0;
    ctx.fillStyle = bit ? COLORS.token : 'rgba(232, 121, 249, 0.2)';
    ctx.fillRect(hvX + 10 + i * bitWidth, patternY, bitWidth - 1, 15);
  }

  // Show bundling operation
  if (phase > 0.2) {
    const bundleX = 450;
    const bundleY = 80;
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(bundleX, bundleY, 280, 120, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.locMatch;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('Bundling Operation (+)', bundleX + 15, bundleY + 22);

    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillStyle = COLORS.path1;
    ctx.fillText('V(cat)', bundleX + 20, bundleY + 50);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('+', bundleX + 90, bundleY + 50);
    ctx.fillStyle = COLORS.path2;
    ctx.fillText('V(dog)', bundleX + 110, bundleY + 50);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('+', bundleX + 180, bundleY + 50);
    ctx.fillStyle = COLORS.path3;
    ctx.fillText('V(bird)', bundleX + 200, bundleY + 50);

    // Result
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('=', bundleX + 60, bundleY + 80);
    ctx.fillStyle = COLORS.locMatch;
    ctx.fillText('V(animals)', bundleX + 85, bundleY + 80);

    // Explanation
    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px "Space Grotesk", sans-serif';
    ctx.fillText('Similar to all three inputs', bundleX + 20, bundleY + 105);
  }

  // Show binding operation
  if (phase > 0.4) {
    const bindX = 450;
    const bindY = 220;
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(bindX, bindY, 280, 100, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.displacement;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('Binding Operation (⊗)', bindX + 15, bindY + 22);

    ctx.font = '12px "Space Grotesk", monospace';
    ctx.fillStyle = COLORS.vote;
    ctx.fillText('V(capital)', bindX + 20, bindY + 50);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('⊗', bindX + 105, bindY + 50);
    ctx.fillStyle = COLORS.path1;
    ctx.fillText('V(France)', bindX + 125, bindY + 50);

    ctx.fillStyle = COLORS.muted;
    ctx.fillText('=', bindX + 60, bindY + 75);
    ctx.fillStyle = COLORS.displacement;
    ctx.fillText('V(capital-France)', bindX + 85, bindY + 75);
  }

  // Show semantic clustering on grid
  if (phase > 0.5) {
    const clusterX = 100;
    const clusterY = 200;
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(clusterX, clusterY, 280, 220, 8);
    ctx.fill();
    ctx.strokeStyle = COLORS.cellActive;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Semantic Clustering on Grid', clusterX + 15, clusterY + 22);

    // Draw mini grid with semantic clusters
    const miniGridX = clusterX + 20;
    const miniGridY = clusterY + 40;
    const miniSize = 30;
    const gridCells = 7;

    // Grid lines
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridCells; i++) {
      ctx.beginPath();
      ctx.moveTo(miniGridX + i * miniSize, miniGridY);
      ctx.lineTo(miniGridX + i * miniSize, miniGridY + gridCells * miniSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(miniGridX, miniGridY + i * miniSize);
      ctx.lineTo(miniGridX + gridCells * miniSize, miniGridY + i * miniSize);
      ctx.stroke();
    }

    // Animal cluster (green)
    const animalCluster = [
      { x: 2, y: 1, label: 'cat' },
      { x: 3, y: 1, label: 'dog' },
      { x: 2, y: 2, label: 'bird' },
      { x: 3, y: 2, label: 'fish' }
    ];

    const cityCluster = [
      { x: 5, y: 4, label: 'Paris' },
      { x: 6, y: 4, label: 'London' },
      { x: 5, y: 5, label: 'Tokyo' }
    ];

    const clusterAlpha = Math.min(1, (phase - 0.5) / 0.2);

    // Draw animal cluster
    ctx.fillStyle = `rgba(34, 197, 94, ${0.3 * clusterAlpha})`;
    ctx.beginPath();
    ctx.arc(miniGridX + 2.5 * miniSize, miniGridY + 1.5 * miniSize, 45, 0, Math.PI * 2);
    ctx.fill();

    animalCluster.forEach(item => {
      const px = miniGridX + (item.x + 0.5) * miniSize;
      const py = miniGridY + (item.y + 0.5) * miniSize;
      ctx.fillStyle = `rgba(34, 197, 94, ${clusterAlpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${clusterAlpha})`;
      ctx.font = '8px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, px, py + 3);
    });

    // Draw city cluster
    ctx.fillStyle = `rgba(139, 92, 246, ${0.3 * clusterAlpha})`;
    ctx.beginPath();
    ctx.arc(miniGridX + 5.5 * miniSize, miniGridY + 4.5 * miniSize, 40, 0, Math.PI * 2);
    ctx.fill();

    cityCluster.forEach(item => {
      const px = miniGridX + (item.x + 0.5) * miniSize;
      const py = miniGridY + (item.y + 0.5) * miniSize;
      ctx.fillStyle = `rgba(139, 92, 246, ${clusterAlpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${clusterAlpha})`;
      ctx.font = '8px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, px, py + 3);
    });
  }

  drawInfoBox(ctx, baseWidth - 200, 50, 'VSA Properties', [
    'High-dimensional (~1024-10000)',
    'Similarity = dot product',
    'Bundling = superposition',
    phase > 0.5 ? 'Similar → nearby on grid' : 'Binding = association'
  ]);

}

/**
 * Render Retrieval Scene - Grounded RAG
 */

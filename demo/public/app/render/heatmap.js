import { dom, runtime } from '../store.js';

const { canvas } = dom;
const ctx = canvas?.getContext('2d');

/**
 * Draw a saturation heatmap overlay on the grid.
 * Colors cells based on how "full" they are (heavy-hitters capacity).
 */
export function drawSaturationHeatmap(diagnostics, canvasWidth, canvasHeight) {
  if (!ctx || !diagnostics?.cellData) return;

  const { width } = runtime.state?.mapConfig ?? { width: 64, height: 64 };
  const cellSize = canvasWidth / width;

  for (const cell of diagnostics.cellData) {
    const { x, y, saturation } = cell;
    if (saturation <= 0) continue;

    // Color based on saturation: green (0%) -> yellow (50%) -> red (100%)
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

  // Draw legend
  const legendX = 10;
  const legendY = canvasHeight - 60;
  const legendW = 120;
  const legendH = 50;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(legendX, legendY, legendW, legendH);
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
  ctx.strokeRect(legendX, legendY, legendW, legendH);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 10px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Cell Saturation', legendX + 5, legendY + 14);

  // Gradient bar
  const gradientX = legendX + 5;
  const gradientY = legendY + 22;
  const gradientW = legendW - 10;
  const gradientH = 12;

  const gradient = ctx.createLinearGradient(gradientX, 0, gradientX + gradientW, 0);
  gradient.addColorStop(0, 'rgba(50, 200, 50, 0.8)');
  gradient.addColorStop(0.5, 'rgba(255, 200, 50, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 50, 50, 0.8)');

  ctx.fillStyle = gradient;
  ctx.fillRect(gradientX, gradientY, gradientW, gradientH);

  ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
  ctx.font = '8px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('0%', gradientX, gradientY + gradientH + 10);
  ctx.textAlign = 'center';
  ctx.fillText('50%', gradientX + gradientW / 2, gradientY + gradientH + 10);
  ctx.textAlign = 'right';
  ctx.fillText('100%', gradientX + gradientW, gradientY + gradientH + 10);
}


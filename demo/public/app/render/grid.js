import { dom, config, runtime } from '../store.js';
import { frameColor, prettyName } from '../format.js';
import { TUTORIAL_COLORS, drawElegantBackground } from '../lib/shared-viz.js';

const { canvas } = dom;
const ctx = canvas?.getContext('2d');

const THEORY_COLORS = TUTORIAL_COLORS;

function drawDisplacementVector(fromLoc, toLoc, dx, dy, cellSize) {
  if (!ctx || dx === 0 && dy === 0) return;

  const fx = (fromLoc.x + 0.5) * cellSize;
  const fy = (fromLoc.y + 0.5) * cellSize;
  const tx = (toLoc.x + 0.5) * cellSize;
  const ty = (toLoc.y + 0.5) * cellSize;

  // Dashed line
  ctx.strokeStyle = THEORY_COLORS.displacement;
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
  ctx.fillStyle = THEORY_COLORS.displacement;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - headLen * Math.cos(angle - 0.4), ty - headLen * Math.sin(angle - 0.4));
  ctx.lineTo(tx - headLen * Math.cos(angle + 0.4), ty - headLen * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();

  // Displacement label
  const midX = (fx + tx) / 2;
  const midY = (fy + ty) / 2;
  const label = `(${dx >= 0 ? '+' : ''}${dx}, ${dy >= 0 ? '+' : ''}${dy})`;
  ctx.fillStyle = THEORY_COLORS.textPrimary;
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, midX, midY - 8);
}

function drawLocalizationCandidates(candidates, cellSize, phase = 1) {
  if (!ctx || !candidates?.length) return;

  candidates.slice(0, 5).forEach((cand, idx) => {
    const x = (cand.location.x + 0.5) * cellSize;
    const y = (cand.location.y + 0.5) * cellSize;
    const pulse = 1 + Math.sin(phase * Math.PI * 4 + idx) * 0.15;
    const radius = cellSize * 0.4 * pulse;

    // Outer glow
    ctx.strokeStyle = THEORY_COLORS.localization;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Fill
    ctx.fillStyle = THEORY_COLORS.localizationFade;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Score label
    const score = cand.score ?? cand.matches ?? 0;
    const scoreText = typeof score === 'number' && score <= 1
      ? `${Math.round(score * 100)}%`
      : String(score);
    ctx.fillStyle = THEORY_COLORS.localization;
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(scoreText, x, y + radius + 14);

    // Column label
    if (cand.columnId) {
      ctx.fillStyle = THEORY_COLORS.textMuted;
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText(cand.columnId, x, y + radius + 24);
    }
  });
}

function drawVotingCircle(columns, votes, winnerIdx, phase, canvasWidth, canvasHeight) {
  if (!ctx || !columns?.length) return;

  const centerX = canvasWidth - 80;
  const centerY = 80;
  const radius = 50;

  // Background
  ctx.fillStyle = THEORY_COLORS.infoBox;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 15, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = THEORY_COLORS.infoBorder;
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
    const color = config.columnColors[idx % config.columnColors.length];

    // Column circle
    ctx.fillStyle = isWinner ? THEORY_COLORS.voteWin : color;
    if (isWinner) {
      ctx.shadowColor = THEORY_COLORS.voteWin;
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.arc(cx, cy, isWinner ? 14 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Vote count
    if (votes?.[idx] != null) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(votes[idx]), cx, cy);
    }
  });

  // Center consensus indicator
  if (winnerIdx >= 0 && phase > 0.7) {
    ctx.fillStyle = THEORY_COLORS.voteWin;
    ctx.shadowColor = THEORY_COLORS.voteWin;
    ctx.shadowBlur = 15;
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✓', centerX, centerY);
    ctx.shadowBlur = 0;

    ctx.fillStyle = THEORY_COLORS.textMuted;
    ctx.font = '9px Inter, sans-serif';
    ctx.fillText('Consensus', centerX, centerY + 18);
  }
}

function drawInfoBox(x, y, title, lines) {
  if (!ctx) return;

  const padding = 10;
  const lineHeight = 16;
  const width = 160;
  const height = padding * 2 + lineHeight * (lines.length + 1);

  // Box
  ctx.fillStyle = THEORY_COLORS.infoBox;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, 6);
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.fill();

  ctx.strokeStyle = THEORY_COLORS.infoBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Title
  ctx.fillStyle = THEORY_COLORS.textPrimary;
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + padding, y + padding + 10);

  // Lines
  ctx.fillStyle = THEORY_COLORS.textMuted;
  ctx.font = '10px Inter, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + padding, y + padding + 10 + (i + 1) * lineHeight);
  });
}

function pulseStroke(baseColor, kind, alpha) {
  if (kind === 'minor') {
    return `rgba(120,130,150,${alpha})`;
  }
  return `${baseColor}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

export function drawGrid(pulseProgress = null) {
  if (!runtime.state?.mapConfig || !canvas || !ctx) return;
  const { width, height } = runtime.state.mapConfig;
  const cellSize = canvas.width / width;

  // Use elegant tutorial-style background
  drawElegantBackground(ctx, canvas.width, canvas.height);

  // Draw grid lines with tutorial styling
  ctx.strokeStyle = TUTORIAL_COLORS.gridLine;
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(canvas.width, y * cellSize);
    ctx.stroke();
  }

  if (runtime.state.history?.length > 0) {
    const columns = runtime.state.columns?.length ?? 1;
    for (let c = 0; c < columns; c += 1) {
      if (!runtime.visibleColumns.has(c)) continue;
      const path = runtime.state.history.map((entry) => entry.locations?.[c]).filter(Boolean);
      if (path.length === 0) continue;
      const baseAlpha = runtime.pulseState ? '33' : 'aa';
      ctx.strokeStyle = config.columnColors[c % config.columnColors.length] + baseAlpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      path.forEach((loc, idx) => {
        const px = (loc.x + 0.5) * cellSize;
        const py = (loc.y + 0.5) * cellSize;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      if (runtime.pulseState && pulseProgress != null) {
        const kind = runtime.pulseState.majorColumns?.includes(c)
          ? 'major'
          : runtime.pulseState.minorColumns?.includes(c)
            ? 'minor'
            : runtime.pulseState.columns?.includes(c)
              ? (runtime.pulseState.kind ?? 'major')
              : null;
        if (kind) {
          if (runtime.pulseState.mode === 'frames' && runtime.pulseState.currentEntry) {
            const step = runtime.pulseState.currentEntry.step;
            const prev = runtime.state.history?.[step - 1]?.locations ?? runtime.pulseState.currentEntry.locations;
            const to = runtime.pulseState.currentEntry.locations?.[c];
            const from = prev?.[c] ?? to;
            if (from && to) {
              const baseColor = frameColor(runtime.highlightedFrame ?? '');
              ctx.strokeStyle = pulseStroke(baseColor, 'major', 0.95);
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.moveTo((from.x + 0.5) * cellSize, (from.y + 0.5) * cellSize);
              ctx.lineTo((to.x + 0.5) * cellSize, (to.y + 0.5) * cellSize);
              ctx.stroke();
              if (c === 0) {
                const hx = (to.x + 0.5) * cellSize;
                const hy = (to.y + 0.5) * cellSize;
                ctx.fillStyle = pulseStroke(baseColor, 'major', 1);
                ctx.beginPath();
                ctx.arc(hx, hy, cellSize * 0.18, 0, Math.PI * 2);
                ctx.fill();
                const label = [];
                label.push(`Step ${step}`);
                label.push('frame');
                if (runtime.highlightedFrame) label.push(prettyName(runtime.highlightedFrame));
                const labelText = label.join(' · ');
                ctx.font = `${Math.max(10, Math.round(cellSize * 0.22))}px Inter, sans-serif`;
                const textWidth = ctx.measureText(labelText).width;
                const pad = 4;
                const boxW = textWidth + pad * 2;
                const boxH = Math.max(14, cellSize * 0.28);
                const boxX = hx + cellSize * 0.25;
                const boxY = hy - boxH * 0.5;
                ctx.fillStyle = 'rgba(8, 12, 24, 0.8)';
                ctx.fillRect(boxX, boxY, boxW, boxH);
                ctx.strokeStyle = pulseStroke(baseColor, 'major', 0.6);
                ctx.strokeRect(boxX, boxY, boxW, boxH);
                ctx.fillStyle = '#e6ecff';
                ctx.fillText(labelText, boxX + pad, boxY + boxH - pad);
              }
            }
          } else {
            const baseColor = config.columnColors[c % config.columnColors.length];
            const segmentLength = Math.min(10, path.length);
            const pathIndex = Math.max(0, Math.floor(pulseProgress * (path.length - 1)));
            const startIndex = Math.max(0, pathIndex - segmentLength + 1);
            const segment = path.slice(startIndex, pathIndex + 1);
            ctx.strokeStyle = pulseStroke(baseColor, kind, 0.95);
            ctx.lineWidth = 4;
            ctx.beginPath();
            segment.forEach((loc, idx) => {
              const px = (loc.x + 0.5) * cellSize;
              const py = (loc.y + 0.5) * cellSize;
              if (idx === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.stroke();
            const head = segment[segment.length - 1];
            if (head) {
              const hx = (head.x + 0.5) * cellSize;
              const hy = (head.y + 0.5) * cellSize;
              ctx.fillStyle = pulseStroke(baseColor, kind, 1);
              ctx.beginPath();
              ctx.arc(hx, hy, cellSize * 0.18, 0, Math.PI * 2);
              ctx.fill();
              const label = [];
              label.push(`C${c + 1}`);
              const labelKind = runtime.pulseState.labelOverride ?? kind;
              label.push(labelKind);
              if (runtime.pulseState.note) label.push(runtime.pulseState.note);
              if (runtime.highlightedFrame) label.push(prettyName(runtime.highlightedFrame));
              const labelText = label.join(' · ');
              ctx.font = `${Math.max(10, Math.round(cellSize * 0.22))}px Inter, sans-serif`;
              const textWidth = ctx.measureText(labelText).width;
              const pad = 4;
              const boxW = textWidth + pad * 2;
              const boxH = Math.max(14, cellSize * 0.28);
              const boxX = hx + cellSize * 0.25;
              const boxY = hy - boxH * 0.5;
              ctx.fillStyle = 'rgba(8, 12, 24, 0.8)';
              ctx.fillRect(boxX, boxY, boxW, boxH);
              ctx.strokeStyle = pulseStroke(baseColor, kind, 0.6);
              ctx.strokeRect(boxX, boxY, boxW, boxH);
              ctx.fillStyle = '#e6ecff';
              ctx.fillText(labelText, boxX + pad, boxY + boxH - pad);
            }
          }
        }
      }
    }
  }

  if (runtime.state.columns?.length) {
    const offsets = [
      { x: -0.2, y: -0.15 },
      { x: 0.2, y: -0.1 },
      { x: -0.1, y: 0.2 },
      { x: 0.15, y: 0.2 }
    ];
    runtime.state.columns.forEach((loc, idx) => {
      if (!runtime.visibleColumns.has(idx)) return;
      const px = (loc.x + 0.5 + offsets[idx % offsets.length].x) * cellSize;
      const py = (loc.y + 0.5 + offsets[idx % offsets.length].y) * cellSize;
      ctx.fillStyle = config.columnColors[idx % config.columnColors.length];
      ctx.beginPath();
      ctx.arc(px, py, cellSize * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = config.columnColors[idx % config.columnColors.length];
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (runtime.overlayFrames.length > 0 && runtime.pulseState?.mode !== 'frames') {
        const dotOffsets = [
          { x: -0.45, y: -0.5 },
          { x: 0.45, y: -0.45 },
          { x: 0.5, y: 0.4 },
          { x: -0.5, y: 0.45 }
        ];
        runtime.overlayFrames.forEach((entry, index) => {
          const offset = dotOffsets[index % dotOffsets.length];
          const dx = offset.x * cellSize;
          const dy = offset.y * cellSize;
          ctx.fillStyle = frameColor(entry.frame);
          ctx.beginPath();
          ctx.arc(px + dx, py + dy, cellSize * 0.12, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      if (runtime.highlightedFrame) {
        ctx.strokeStyle = frameColor(runtime.highlightedFrame);
        ctx.lineWidth = cellSize * 0.12;
        ctx.beginPath();
        ctx.arc(px, py, cellSize * 0.68, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  if (runtime.pulseState && pulseProgress != null && runtime.state.columns?.length) {
    const pulse = 1 - pulseProgress;
    const radius = cellSize * (0.6 + 1.2 * pulseProgress);
    runtime.state.columns.forEach((loc, idx) => {
      if (!runtime.visibleColumns.has(idx)) return;
      const kind = runtime.pulseState.majorColumns?.includes(idx)
        ? 'major'
        : runtime.pulseState.minorColumns?.includes(idx)
          ? 'minor'
          : runtime.pulseState.columns?.includes(idx)
            ? (runtime.pulseState.kind ?? 'major')
            : null;
      if (!kind) return;
      const px = (loc.x + 0.5) * cellSize;
      const py = (loc.y + 0.5) * cellSize;
      const baseColor = config.columnColors[idx % config.columnColors.length];
      ctx.strokeStyle = pulseStroke(baseColor, kind, 0.85 * pulse);
      ctx.lineWidth = cellSize * 0.22;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // ==================== THOUSAND BRAINS THEORY OVERLAYS ====================
  if (runtime.showTheoryViz && runtime.pulseState && pulseProgress != null) {
    const phase = pulseProgress;

    // Draw displacement vectors during step animation
    if (runtime.pulseState.mode === 'query' && runtime.state.history?.length > 1) {
      const pathIdx = Math.max(0, Math.floor(phase * (runtime.state.history.length - 1)));
      if (pathIdx > 0) {
        const prev = runtime.state.history[pathIdx - 1];
        const curr = runtime.state.history[pathIdx];
        if (prev?.locations?.[0] && curr?.locations?.[0]) {
          const from = prev.locations[0];
          const to = curr.locations[0];
          const dx = ((to.x - from.x + 32 + 64) % 64) - 32;
          const dy = ((to.y - from.y + 32 + 64) % 64) - 32;
          if (dx !== 0 || dy !== 0) {
            drawDisplacementVector(from, to, dx, dy, cellSize);
          }
        }
      }
    }

    // Draw localization candidates
    if (runtime.localizationCandidates?.length > 0 && phase > 0.2) {
      drawLocalizationCandidates(runtime.localizationCandidates, cellSize, phase);
    }

    // Draw voting circle
    if (runtime.votingState?.votes?.length > 0 && phase > 0.5) {
      const columns = runtime.state.columns || [];
      drawVotingCircle(
        columns,
        runtime.votingState.votes,
        runtime.votingState.winnerIdx ?? -1,
        phase,
        canvas.width,
        canvas.height
      );
    }

    // Draw info box with current step info
    if (phase > 0.1 && runtime.state.step != null) {
      const infoLines = [`Step: ${runtime.state.step}`];
      if (runtime.localizationCandidates?.length > 0) {
        infoLines.push(`Candidates: ${runtime.localizationCandidates.length}`);
      }
      if (runtime.votingState?.winnerIdx >= 0) {
        infoLines.push(`Winner: Column ${runtime.votingState.winnerIdx + 1}`);
      }
      drawInfoBox(10, 10, 'Query Progress', infoLines);
    }
  }
}

export function drawSaturationHeatmap(diagnostics, canvasWidth, canvasHeight) {
  if (!ctx || !diagnostics?.cellData) return;

  const { width, height } = runtime.state?.mapConfig ?? { width: 64, height: 64 };
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


import { dom, runtime } from '../store.js';
import { displayTime, formatDuration } from '../format.js';

const {
  perfBarVsa,
  perfBarNaive,
  perfBarVsaValue,
  perfBarNaiveValue,
  animSpeedValue,
  animSpeedHint
} = dom;

export function updatePerf(metrics) {
  if (!perfBarVsa || !perfBarNaive || !perfBarVsaValue || !perfBarNaiveValue) return;
  const setBar = (bar, label, width, text) => {
    bar.style.width = width;
    label.textContent = text;
  };
  if (!metrics) {
    const needLabel = '—';
    setBar(perfBarVsa, perfBarVsaValue, '0%', needLabel);
    setBar(perfBarNaive, perfBarNaiveValue, '0%', needLabel);
    return;
  }

  const vsaTime = Number.isFinite(metrics.vsaTimeMs) ? metrics.vsaTimeMs : NaN;
  const naiveTime = Number.isFinite(metrics.naiveTimeMs) ? metrics.naiveTimeMs : NaN;
  const vsaDisplay = displayTime(vsaTime);
  const naiveDisplay = displayTime(naiveTime);
  const safeVsa = Number.isFinite(vsaDisplay.scaleSeconds) ? vsaDisplay.scaleSeconds : 0;
  const safeNaive = Number.isFinite(naiveDisplay.scaleSeconds) ? naiveDisplay.scaleSeconds : 0;
  const maxTime = Math.max(safeVsa, safeNaive, 1e-9);
  const scaleWidth = (cost) => {
    if (!Number.isFinite(cost) || cost <= 0) return 0;
    const pct = (cost / maxTime) * 100;
    return Math.max(2, Math.min(100, pct));
  };

  const mismatchLabel = metrics.mismatch ? ' · mismatch' : '';
  const vsaLabel = Number.isFinite(vsaDisplay.scaleSeconds) ? `${vsaDisplay.label}${mismatchLabel}` : '—';
  const naiveLabel = Number.isFinite(naiveDisplay.scaleSeconds)
    ? `${naiveDisplay.label}${mismatchLabel}`
    : '—';

  setBar(perfBarVsa, perfBarVsaValue, `${scaleWidth(vsaDisplay.scaleSeconds)}%`, vsaLabel);
  setBar(perfBarNaive, perfBarNaiveValue, `${scaleWidth(naiveDisplay.scaleSeconds)}%`, naiveLabel);
}

export function updateAnimationSpeedLabels() {
  if (!animSpeedValue || !animSpeedHint) return;
  animSpeedValue.textContent = `${runtime.animationSpeed.toFixed(3)}x`;
  const sweepSeconds = 2.2 / Math.max(0.001, runtime.animationSpeed);
  animSpeedHint.textContent = `≈ ${formatDuration(sweepSeconds)} per sweep`;
}

export function updateAnimationSpeed(value) {
  const t = value - 50;
  runtime.animationSpeed = Math.pow(10, t / 16.7);
  updateAnimationSpeedLabels();
}


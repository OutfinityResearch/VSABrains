/**
 * Tutorial Main Controller
 * Animation loop, scene management, and UI controls
 */

import { SCENES, TOTAL_DURATION } from './config.js';
import { speech, createMuteButton, createLanguageSelector, createRepeatButton } from './speech.js';
import { getKeyIdea, loadNarrations } from './narrations.js';
import {
  renderGridScene, renderDisplacementScene, renderPathScene,
  renderMultiColumnScene, renderLocalizationScene, renderVotingScene,
  renderAlignmentScene, renderBranchingScene, renderPredictionScene, renderHeavyHittersScene,
  renderReplayScene, renderSlowMapsScene, renderReasoningScene,
  renderVSAIndexScene, renderRetrievalScene, renderConflictScene,
  renderVerdictsScene, renderDerivationScene, renderEntitiesScene, renderKnobsScene
} from './scenes.js';

// DOM elements - will be initialized in init()
let canvas, ctx;
let playBtn, pauseBtn, prevBtn, nextBtn;
let speedInput, speedValue, speedHint;
let stepsContainer;
let sceneTitle, sceneSummary, sceneBullets, sceneKey, sceneSignals;

// Canvas dimensions
let dpr, baseWidth, baseHeight;

// Animation state
let playing = true;
let lastTime = performance.now();
let timeline = 0;
let speed = 1;
let currentSceneIndex = -1;
let suppressNarrationOnce = false;
let holdSceneIndex = null;

/**
 * Get current scene object (for repeat button)
 */
function getCurrentScene() {
  const { scene } = getSceneAtTime(timeline);
  return scene;
}

/**
 * Convert slider value to speed multiplier
 */
function sliderToSpeed(value) {
  const t = value / 100;
  return Math.pow(10, (t - 0.5) * 1.1);
}

/**
 * Update speed labels
 */
function updateSpeedLabels() {
  if (speedValue) speedValue.textContent = `${speed.toFixed(2)}x`;
  if (speedHint) {
    const perScene = (SCENES[0].duration / speed).toFixed(1);
    speedHint.textContent = `≈ ${perScene}s per scene`;
  }
}

function setPlayingState(nextPlaying) {
  const wasPlaying = playing;
  playing = nextPlaying;

  // Keep both buttons clickable; reflect state via aria-pressed.
  if (playBtn) playBtn.setAttribute('aria-pressed', String(playing));
  if (pauseBtn) pauseBtn.setAttribute('aria-pressed', String(!playing));

  // Keep narration synced with animation state.
  if (!playing && wasPlaying) {
    speech.pause();
    // Some browsers are flaky with pause(); fall back to cancel so audio never runs
    // while the visuals are paused.
    if (speech.isSpeaking() && !speech.isPaused()) {
      speech.stop();
    }
  }

  if (playing && !wasPlaying) {
    if (speech.isPaused()) {
      speech.resume();
    } else if (!speech.isMuted() && !speech.isSpeaking()) {
      // If narration isn't active, (re)start it for the current scene.
      speech.speakScene(getCurrentScene());
    }
  }
}

function goToScene(index, { playback = 'keep', speak = true } = {}) {
  const wrappedIndex = ((index % SCENES.length) + SCENES.length) % SCENES.length;
  timeline = sceneStart(wrappedIndex);
  holdSceneIndex = null;

  // When jumping between scenes, cancel any in-flight or paused narration so we don't overlap
  // (and don't resume the old scene by accident).
  speech.stop();
  if (!speak) suppressNarrationOnce = true;

  if (playback === 'pause') {
    setPlayingState(false);
  } else if (playback === 'play') {
    setPlayingState(true);
  }

  render();
}

/**
 * Get scene at given timeline position
 */
function getSceneAtTime(t) {
  let acc = 0;
  for (let i = 0; i < SCENES.length; i++) {
    acc += SCENES[i].duration;
    if (t < acc) return { scene: SCENES[i], index: i, local: t - (acc - SCENES[i].duration) };
  }
  return { scene: SCENES[SCENES.length - 1], index: SCENES.length - 1, local: SCENES[SCENES.length - 1].duration };
}

/**
 * Get timeline position at scene start
 */
function sceneStart(index) {
  let t = 0;
  for (let i = 0; i < index; i++) t += SCENES[i].duration;
  return t;
}

/**
 * Build step chips UI
 */
function buildStepsUI() {
  if (!stepsContainer) return;
  stepsContainer.innerHTML = '';
  SCENES.forEach((scene, idx) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tutorial-step';
    chip.textContent = `${idx + 1}. ${scene.title.split(' - ')[0]}`;
    chip.addEventListener('click', () => {
      goToScene(idx, { playback: 'pause', speak: true });
    });
    stepsContainer.appendChild(chip);
  });
}

/**
 * Update step chips highlight
 */
function updateStepChips(activeIndex) {
  if (!stepsContainer) return;
  Array.from(stepsContainer.children).forEach((chip, idx) => {
    chip.classList.toggle('active', idx === activeIndex);
  });
}

/**
 * Update side panel content
 */
function updateSidePanel(scene, index) {
  if (sceneTitle) sceneTitle.textContent = scene.title;
  if (sceneSummary) sceneSummary.textContent = scene.summary;

  if (sceneBullets) {
    sceneBullets.innerHTML = '';
    scene.bullets.forEach(bullet => {
      const li = document.createElement('li');
      li.textContent = bullet;
      sceneBullets.appendChild(li);
    });
  }

  if (sceneKey) {
    const lang = typeof speech.getLanguage === 'function' ? speech.getLanguage() : 'en';
    const keyText = getKeyIdea(scene.id, lang) || getKeyIdea(scene.id, 'en') || scene.key;
    sceneKey.textContent = keyText || '';
  }

  if (sceneSignals) {
    sceneSignals.innerHTML = '';
    scene.signals.forEach(signal => {
      const span = document.createElement('span');
      span.className = 'signal-tag';
      span.textContent = signal;
      sceneSignals.appendChild(span);
    });
  }

  // Speak narration when scene changes
  if (index !== currentSceneIndex) {
    currentSceneIndex = index;
    if (suppressNarrationOnce) {
      suppressNarrationOnce = false;
    } else {
      speech.speakScene(scene);
    }
  }
}

/**
 * Main render function
 */
function render() {
  if (!ctx) return;
  
  const { scene, index, local } = getSceneAtTime(timeline);
  const phase = local / scene.duration;

  switch (scene.id) {
    case 'grid':
      renderGridScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'displacement':
      renderDisplacementScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'path':
      renderPathScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'multicolumn':
      renderMultiColumnScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'alignment':
      renderAlignmentScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'localization':
      renderLocalizationScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'voting':
      renderVotingScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'branching':
      renderBranchingScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'prediction':
      renderPredictionScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'heavyhitters':
      renderHeavyHittersScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'replay':
      renderReplayScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'slowmaps':
      renderSlowMapsScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'reasoning':
      renderReasoningScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'vsaindex':
      renderVSAIndexScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'retrieval':
      renderRetrievalScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'verdicts':
      renderVerdictsScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'conflict':
      renderConflictScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'derivation':
      renderDerivationScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'entities':
      renderEntitiesScene(ctx, phase, baseWidth, baseHeight);
      break;
    case 'knobs':
      renderKnobsScene(ctx, phase, baseWidth, baseHeight);
      break;
  }

  updateSidePanel(scene, index);
  updateStepChips(index);
}

/**
 * Animation tick
 */
function tick(now) {
  if (playing) {
    const dt = (now - lastTime) / 1000;
    const delta = dt * speed;
    const { scene, index, local } = getSceneAtTime(timeline);
    const narrationActive = !speech.isMuted() && (speech.isSpeaking() || speech.isPaused());

    // Default: advance time normally.
    let nextTimeline = (timeline + delta) % TOTAL_DURATION;

    if (narrationActive) {
      // If narration is still running and we'd leave the current scene, keep the visuals
      // looping within this scene until narration finishes (avoids cutting off speech).
      const localNext = local + delta;
      if (localNext >= scene.duration) {
        holdSceneIndex = index;
        const wrappedLocal = localNext % scene.duration;
        nextTimeline = sceneStart(index) + wrappedLocal;
      }
    } else if (holdSceneIndex === index) {
      // Narration ended while we were holding this scene: advance immediately.
      holdSceneIndex = null;
      nextTimeline = sceneStart((index + 1) % SCENES.length);
    }

    timeline = nextTimeline;
  }
  lastTime = now;
  render();
  requestAnimationFrame(tick);
}

/**
 * Initialize tutorial
 */
async function init() {
  console.log('[Tutorial] Initializing...');
  
  // Get DOM elements NOW (after DOM is ready)
  canvas = document.getElementById('tutorialCanvas');
  if (!canvas) {
    console.error('[Tutorial] Canvas not found!');
    return;
  }
  ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[Tutorial] 2D canvas context not available!');
    return;
  }
  
  playBtn = document.getElementById('tutorialPlay');
  pauseBtn = document.getElementById('tutorialPause');
  prevBtn = document.getElementById('tutorialPrev');
  nextBtn = document.getElementById('tutorialNext');
  speedInput = document.getElementById('tutorialSpeed');
  speedValue = document.getElementById('tutorialSpeedValue');
  speedHint = document.getElementById('tutorialSpeedHint');
  stepsContainer = document.getElementById('tutorialSteps');
  
  sceneTitle = document.getElementById('sceneTitle');
  sceneSummary = document.getElementById('sceneSummary');
  sceneBullets = document.getElementById('sceneBullets');
  sceneKey = document.getElementById('sceneKey');
  sceneSignals = document.getElementById('sceneSignals');

  // High-DPI canvas setup
  dpr = window.devicePixelRatio || 1;
  baseWidth = canvas.width;
  baseHeight = canvas.height;
  canvas.width = Math.floor(baseWidth * dpr);
  canvas.height = Math.floor(baseHeight * dpr);
  ctx.scale(dpr, dpr);

  // Initialize speed from slider
  if (speedInput) {
    speed = sliderToSpeed(Number(speedInput.value));
  }

  // Build UI
  buildStepsUI();
  updateSpeedLabels();

  const animButtons = document.querySelector('.anim-buttons');

  // Wire up controls
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      console.log('[Tutorial] Play clicked');
      setPlayingState(true);
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      console.log('[Tutorial] Pause clicked');
      setPlayingState(false);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      console.log('[Tutorial] Next clicked');
      const { index } = getSceneAtTime(timeline);
      goToScene(index + 1, { playback: 'keep', speak: true });
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      console.log('[Tutorial] Prev clicked');
      const { index } = getSceneAtTime(timeline);
      goToScene(index - 1, { playback: 'keep', speak: true });
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }

    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        setPlayingState(!playing);
        console.log('[Tutorial] Space pressed, playing:', playing);
        break;
      case 'r':
        speech.speakScene(getCurrentScene());
        break;
      case 'arrowleft':
        e.preventDefault();
        goToScene(getSceneAtTime(timeline).index - 1, { playback: 'keep', speak: true });
        break;
      case 'arrowright':
        e.preventDefault();
        goToScene(getSceneAtTime(timeline).index + 1, { playback: 'keep', speak: true });
        break;
      case 'm':
        speech.toggleMute();
        break;
    }
  });

  if (speedInput) {
    speedInput.addEventListener('input', () => {
      speed = sliderToSpeed(Number(speedInput.value));
      updateSpeedLabels();
    });
  }

  // Add language selector, repeat button, and mute button to controls
  if (animButtons) {
    try {
      createLanguageSelector(animButtons);
      createRepeatButton(animButtons, getCurrentScene);
      createMuteButton(animButtons);
    } catch (err) {
      console.warn('[Tutorial] Failed to create TTS controls:', err);
    }
  }

  if (animButtons) {
    speech.onLanguageChange = () => {
      const scene = getCurrentScene();
      if (scene) {
        speech.stop();
        speech.speakScene(scene);
      }
    };
  }

  setPlayingState(playing);
  console.log('[Tutorial] Controls initialized:', { playBtn: !!playBtn, pauseBtn: !!pauseBtn, prevBtn: !!prevBtn, nextBtn: !!nextBtn });

  // Preload narrations in the background (controls should work even if fetch hangs/fails).
  void loadNarrations()
    .then((narrations) => {
      const loadedCount = narrations ? Object.keys(narrations).length : 0;
      console.log('[Tutorial] Narrations loaded:', { loadedCount });
      if (loadedCount === 0) {
        console.warn('[Tutorial] No narration JSON files loaded; narration will fall back to English.');
      }
    })
    .catch((err) => {
      console.error('[Tutorial] Failed to load narrations:', err);
    });

  // Start animation
  render();
  requestAnimationFrame(tick);
  
  console.log('[Tutorial] Started');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}

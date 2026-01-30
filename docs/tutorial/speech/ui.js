/**
 * Tutorial TTS UI widgets
 */

import { speech } from './core.js';

/**
 * Create repeat button UI
 * @param {HTMLElement} container - Container to append the button to
 * @param {Function} getCurrentScene - Function that returns the current scene
 */
export function createRepeatButton(container, getCurrentScene) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-btn tutorial-repeat-btn';
  button.title = 'Repeat narration (R)';
  button.innerHTML = '🔁';
  
  button.addEventListener('click', () => {
    const scene = getCurrentScene();
    if (scene) {
      speech.speakScene(scene);
    }
  });
  
  container.appendChild(button);
  return button;
}

/**
 * Create language selector UI
 */
export function createLanguageSelector(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tutorial-lang-selector';
  
  const label = document.createElement('span');
  label.className = 'lang-label';
  label.textContent = 'Narration:';
  wrapper.appendChild(label);
  
  const select = document.createElement('select');
  select.className = 'lang-select';
  select.title = 'Select narration language';
  
  const languages = speech.getLanguages();
  for (const [code, lang] of Object.entries(languages)) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = `${lang.flag} ${lang.name}`;
    if (code === speech.getLanguage()) {
      option.selected = true;
    }
    select.appendChild(option);
  }

  // Inline status hint when a language is selected but no matching voice is available.
  const status = document.createElement('div');
  status.className = 'tts-voice-status';
  status.style.fontSize = '11px';
  status.style.opacity = '0.85';
  status.style.marginTop = '6px';
  status.style.maxWidth = '240px';
  status.style.display = 'none';

  const updateStatus = () => {
    const lang = select.value;
    if (lang !== 'en' && !speech.hasVoiceForLanguage(lang)) {
      const langName = speech.getLanguages()?.[lang]?.name || lang;
      status.textContent = `${langName} voice not available in this browser. Install an OS voice and restart Chrome.`;
      status.style.display = 'block';
    } else {
      status.textContent = '';
      status.style.display = 'none';
    }
  };
  updateStatus();
  
  select.addEventListener('change', () => {
    console.log(`[TTS] Language selector changed to: ${select.value}`);
    speech.setLanguage(select.value);
    updateStatus();
  });
  
  wrapper.appendChild(select);
  wrapper.appendChild(status);
  container.appendChild(wrapper);
  
  return wrapper;
}

/**
 * Create mute button UI
 */
export function createMuteButton(container) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-btn tutorial-mute-btn';
  button.title = speech.isMuted() ? 'Unmute narration' : 'Mute narration';
  button.innerHTML = speech.isMuted() ? '🔇' : '🔊';
  
  button.addEventListener('click', () => {
    const muted = speech.toggleMute();
    button.innerHTML = muted ? '🔇' : '🔊';
    button.title = muted ? 'Unmute narration' : 'Mute narration';
  });
  
  // Update button when mute state changes externally
  speech.onMuteChange = (muted) => {
    button.innerHTML = muted ? '🔇' : '🔊';
    button.title = muted ? 'Unmute narration' : 'Mute narration';
  };
  
  container.appendChild(button);
  return button;
}

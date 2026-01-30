/**
 * Tutorial Text-to-Speech Module
 * Handles narration with language selection, mute toggle, and localStorage persistence
 */

import { getNarration, loadNarrations } from './narrations.js';

const STORAGE_KEY_MUTE = 'vsabrains-tutorial-muted';
const STORAGE_KEY_LANG = 'vsabrains-tutorial-lang';

// Supported languages with their voice preferences (EN + RO only)
const LANGUAGES = {
  en: {
    code: 'en',
    name: 'English',
    flag: '🇬🇧',
    langPatterns: ['en-US', 'en-GB', 'en_US', 'en_GB', 'en']
  },
  ro: {
    code: 'ro',
    name: 'Română',
    flag: '🇷🇴',
    langPatterns: ['ro-RO', 'ro_RO', 'ro']
  }
};

class TutorialSpeech {
  constructor() {
    this.muted = this.loadMuteState();
    this.language = this.loadLanguage();
    this.currentUtterance = null;
    this.synth = window.speechSynthesis;
    this.voices = {};
    this.allVoices = [];
    this.onMuteChange = null;
    this.onLanguageChange = null;
    this.speakRequestId = 0;
    
    if (!this.synth) {
      console.warn('[TTS] speechSynthesis not supported in this browser.');
      return;
    }

    // Load voices when available
    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  /**
   * Load mute state from localStorage
   */
  loadMuteState() {
    try {
      return localStorage.getItem(STORAGE_KEY_MUTE) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Save mute state to localStorage
   */
  saveMuteState() {
    try {
      localStorage.setItem(STORAGE_KEY_MUTE, String(this.muted));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Load language from localStorage
   */
  loadLanguage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LANG);
      return saved && LANGUAGES[saved] ? saved : 'en';
    } catch {
      return 'en';
    }
  }

  /**
   * Save language to localStorage
   */
  saveLanguage() {
    try {
      localStorage.setItem(STORAGE_KEY_LANG, this.language);
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Load preferred voices for all languages
   */
  loadVoices() {
    if (!this.synth) return;
    this.allVoices = this.synth.getVoices();
    console.log(`[TTS] Found ${this.allVoices.length} voices`);
    
    // Log available voices for debugging
    if (this.allVoices.length > 0) {
      const voiceList = this.allVoices.map(v => `${v.name} (${v.lang})`);
      console.log('[TTS] Available voices:', voiceList);
    }
    
    for (const [langCode, langConfig] of Object.entries(LANGUAGES)) {
      let selectedVoice = null;
      
      // Try each lang pattern
      for (const pattern of langConfig.langPatterns) {
        if (selectedVoice) break;
        
        // Find voice where lang matches pattern
        selectedVoice = this.allVoices.find(v => 
          v.lang === pattern || v.lang.replace('_', '-') === pattern
        );
      }
      
      // Fallback: any voice starting with lang code
      if (!selectedVoice) {
        selectedVoice = this.allVoices.find(v => v.lang.startsWith(langCode));
      }
      
      this.voices[langCode] = selectedVoice;
      
      if (selectedVoice) {
        console.log(`[TTS] Voice for ${langCode}: ${selectedVoice.name} (${selectedVoice.lang})`);
      } else {
        console.warn(`[TTS] No voice found for ${langCode}`);
      }
    }
  }

  /**
   * Get voice for a specific language code.
   * @param {string} langCode - e.g. 'en', 'ro', 'en-US'
   */
  getVoiceForLanguage(langCode) {
    const normalized = String(langCode || 'en').toLowerCase().trim();
    const short = normalized.split('-')[0];

    // Try direct lookup by short code.
    let voice = this.voices[short];
    
    // If no voice found, try to find one dynamically
    if (!voice && this.allVoices.length > 0) {
      const langConfig = LANGUAGES[short];
      if (langConfig) {
        for (const pattern of langConfig.langPatterns) {
          voice = this.allVoices.find(v => 
            v.lang === pattern || v.lang.replace('_', '-') === pattern || v.lang.startsWith(short)
          );
          if (voice) break;
        }
      }
    }
    
    // Fallback to English or first available
    if (!voice) {
      voice = this.voices['en'] || this.allVoices[0];
    }
    
    return voice;
  }

  /**
   * Get current voice for selected language
   */
  getCurrentVoice() {
    return this.getVoiceForLanguage(this.language);
  }

  /**
   * Set language
   */
  setLanguage(langCode) {
    if (LANGUAGES[langCode]) {
      console.log(`[TTS] Language changed to: ${langCode}`);
      this.language = langCode;
      this.saveLanguage();
      this.stop();
      
      if (this.onLanguageChange) {
        this.onLanguageChange(langCode);
      }
    }
  }

  /**
   * Get current language
   */
  getLanguage() {
    return this.language;
  }

  /**
   * Get available languages
   */
  getLanguages() {
    return LANGUAGES;
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    this.muted = !this.muted;
    this.saveMuteState();
    
    if (this.muted) {
      this.stop();
    }
    
    if (this.onMuteChange) {
      this.onMuteChange(this.muted);
    }
    
    return this.muted;
  }

  /**
   * Set mute state directly
   */
  setMuted(muted) {
    this.muted = muted;
    this.saveMuteState();
    
    if (this.muted) {
      this.stop();
    }
    
    if (this.onMuteChange) {
      this.onMuteChange(this.muted);
    }
  }

  /**
   * Check if currently muted
   */
  isMuted() {
    return this.muted;
  }

  /**
   * Stop current speech
   */
  stop() {
    if (!this.synth) return;
    if (this.synth.speaking) {
      this.synth.cancel();
    }
    this.currentUtterance = null;
  }

  /**
   * Pause current speech (if supported)
   */
  pause() {
    if (!this.synth) return;
    if (this.synth.speaking && !this.synth.paused) {
      try {
        this.synth.pause();
      } catch {
        // Some browsers can throw if pause() is called in an invalid state.
      }
    }
  }

  /**
   * Resume paused speech (if supported)
   */
  resume() {
    if (!this.synth) return;
    if (this.synth.paused) {
      try {
        this.synth.resume();
      } catch {
        // Ignore resume errors
      }
    }
  }

  isSpeaking() {
    return Boolean(this.synth?.speaking);
  }

  isPaused() {
    return Boolean(this.synth?.paused);
  }

  /**
   * Speak text (if not muted)
   */
  speak(text, options = {}) {
    if (this.muted || !text || !this.synth) {
      return;
    }

    // Stop any current speech
    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply settings
    const languageOverride = options.languageOverride;
    const effectiveLang = languageOverride || this.language;
    const voice = this.getVoiceForLanguage(effectiveLang);
    if (voice) {
      utterance.voice = voice;
      console.log(`[TTS] Using voice: ${voice.name} (${voice.lang})`);
    }
    
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 0.9;
    
    // Also set lang on utterance for browsers that need it
    utterance.lang = voice?.lang || (effectiveLang === 'ro' ? 'ro-RO' : 'en-US');
    
    // Store reference
    this.currentUtterance = utterance;
    
    // Speak
    this.synth.speak(utterance);
  }

  /**
   * Speak scene narration in current language
   * Uses narrations loaded from JSON files
   */
  async speakScene(scene) {
    if (!scene) return;

    const requestId = ++this.speakRequestId;
    
    // Get narration from JSON files - explicitly pass current language
    const currentLang = this.language;
    let narrationText = getNarration(scene.id, currentLang);
    if (!narrationText) {
      // Lazy-load narrations in case the main controller didn't (or if module state was reset).
      try {
        await loadNarrations();
      } catch {
        // Ignore and fall back below.
      }
      // If a newer narration request came in while we were loading, drop this one.
      if (requestId !== this.speakRequestId) {
        return;
      }
      narrationText = getNarration(scene.id, currentLang);
    }

    // Prefer narration text for the selected language.
    // If it's missing, fall back to English narration *with an English voice* to avoid RO-accented English.
    const fallbackEnglish = getNarration(scene.id, 'en');
    const text = narrationText || fallbackEnglish || scene.summary;
    const languageOverride = narrationText ? undefined : 'en';
    
    // Debug logging
    console.log(`[TTS] speakScene called:`);
    console.log(`  - scene.id: ${scene.id}`);
    console.log(`  - currentLang: ${currentLang}`);
    console.log(`  - narrationText found: ${!!narrationText}`);
    console.log(`  - text preview: ${text.substring(0, 100)}...`);
    
    this.speak(text, { rate: 0.8, languageOverride });
  }

  /**
   * Check if speech synthesis is supported
   */
  isSupported() {
    return 'speechSynthesis' in window;
  }
}

// Singleton instance
export const speech = new TutorialSpeech();

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
  
  select.addEventListener('change', () => {
    console.log(`[TTS] Language selector changed to: ${select.value}`);
    speech.setLanguage(select.value);
  });
  
  wrapper.appendChild(select);
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

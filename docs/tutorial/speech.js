/**
 * Tutorial Text-to-Speech Module
 * Handles narration with language selection, mute toggle, and localStorage persistence
 */

import { getNarration, getKeyIdea, loadNarrations } from './narrations.js';

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
    this._voicesReadyWaiters = new Set();
    this.onMuteChange = null;
    this.onLanguageChange = null;
    this.speakRequestId = 0;
    
    if (!this.synth) {
      console.warn('[TTS] speechSynthesis not supported in this browser.');
      return;
    }

    // Ensure speech never leaks across navigations (some browsers keep speaking unless cancelled).
    window.addEventListener('pagehide', () => this.stop());
    window.addEventListener('beforeunload', () => this.stop());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
      }
    });

    // Load voices when available
    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  /**
   * Whether a suitable voice exists for the given language in the current browser.
   * For non-English languages we do NOT allow falling back to an English voice, because it
   * produces "wrong accent" output (e.g. Romanian text spoken by an English voice).
   * @param {string} langCode
   */
  hasVoiceForLanguage(langCode) {
    const normalized = String(langCode || 'en').toLowerCase().trim();
    const short = normalized.split('-')[0];
    this.loadVoices();
    return Boolean(this.getVoiceForLanguage(short, { allowFallback: short === 'en' }));
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
        
        // Find voice where lang matches pattern (case-insensitive, '_' and '-' treated as equivalent).
        const patternNorm = String(pattern).toLowerCase().replace('_', '-');
        selectedVoice = this.allVoices.find((v) => {
          const vLangNorm = String(v.lang || '').toLowerCase().replace('_', '-');
          return vLangNorm === patternNorm;
        });
      }
      
      // Fallback: any voice starting with lang code
      if (!selectedVoice) {
        const langNorm = String(langCode).toLowerCase();
        selectedVoice = this.allVoices.find((v) => String(v.lang || '').toLowerCase().startsWith(langNorm));
      }
      
      this.voices[langCode] = selectedVoice;
      
      if (selectedVoice) {
        console.log(`[TTS] Voice for ${langCode}: ${selectedVoice.name} (${selectedVoice.lang})`);
      } else {
        console.warn(`[TTS] No voice found for ${langCode}`);
      }
    }

    // Resolve any waiters once voices are available.
    if (this.allVoices.length > 0 && this._voicesReadyWaiters.size > 0) {
      const waiters = Array.from(this._voicesReadyWaiters);
      this._voicesReadyWaiters.clear();
      waiters.forEach((resolve) => {
        try {
          resolve(true);
        } catch {
          // Ignore waiter errors.
        }
      });
    }
  }

  /**
   * Wait briefly for voices to become available. Many browsers populate voices asynchronously.
   * @param {number} timeoutMs
   * @returns {Promise<boolean>} Whether voices were available before timeout.
   */
  whenVoicesReady(timeoutMs = 700) {
    if (!this.synth) return Promise.resolve(false);
    this.loadVoices();
    if (this.allVoices.length > 0) return Promise.resolve(true);

    return new Promise((resolve) => {
      let wrappedResolve = null;
      const timer = setTimeout(() => {
        if (wrappedResolve) {
          this._voicesReadyWaiters.delete(wrappedResolve);
        }
        resolve(false);
      }, timeoutMs);

      wrappedResolve = (ok) => {
        clearTimeout(timer);
        if (wrappedResolve) {
          this._voicesReadyWaiters.delete(wrappedResolve);
        }
        resolve(Boolean(ok));
      };

      // Use the wrapped resolver so we can cancel timeout and clean up.
      this._voicesReadyWaiters.add(wrappedResolve);
    });
  }

  /**
   * Get voice for a specific language code.
   * @param {string} langCode - e.g. 'en', 'ro', 'en-US'
   * @param {{ allowFallback?: boolean }} options
   */
  getVoiceForLanguage(langCode, options = {}) {
    const allowFallback = options.allowFallback !== false;
    const normalized = String(langCode || 'en').toLowerCase().trim();
    const short = normalized.split('-')[0];

    // Try direct lookup by short code.
    let voice = this.voices[short];
    
    // If no voice found, try to find one dynamically
    if (!voice && this.allVoices.length > 0) {
      const langConfig = LANGUAGES[short];
      if (langConfig) {
        for (const pattern of langConfig.langPatterns) {
          const patternNorm = String(pattern).toLowerCase().replace('_', '-');
          voice = this.allVoices.find((v) => {
            const vLangNorm = String(v.lang || '').toLowerCase().replace('_', '-');
            return vLangNorm === patternNorm || vLangNorm.startsWith(short);
          });
          if (voice) break;
        }
      }
    }
    
    // Fallback to English or first available (only when explicitly allowed).
    if (!voice && allowFallback) {
      voice = this.voices['en'] || this.allVoices[0] || null;
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
    // cancel() clears both current speech and any queued utterances (pending).
    if (this.synth.speaking || this.synth.pending) {
      try {
        this.synth.cancel();
      } catch {
        // Ignore cancel errors; some browsers can be finicky about state.
      }
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
    // Treat queued utterances as "active" so the tutorial can stay in sync when we chain narration parts.
    return Boolean(this.synth?.speaking || this.synth?.pending);
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

    const queue = options.queue === true;
    if (!queue) {
      // Stop any current speech
      this.stop();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply settings
    const languageOverride = options.languageOverride;
    const effectiveLang = languageOverride || this.language;
    // Voices often load asynchronously; refresh once if we haven't seen any yet.
    if (this.allVoices.length === 0) {
      this.loadVoices();
    }
    // Important: don't force an English voice when speaking Romanian text.
    // If a RO voice isn't available, leave `utterance.voice` unset and rely on `utterance.lang`.
    const allowFallback = String(effectiveLang).toLowerCase().trim().split('-')[0] === 'en';
    const voice = this.getVoiceForLanguage(effectiveLang, { allowFallback });
    if (voice) {
      utterance.voice = voice;
      console.log(`[TTS] Using voice: ${voice.name} (${voice.lang})`);
    } else {
      console.warn(`[TTS] No matching voice for "${effectiveLang}". Using default voice with utterance.lang hint.`);
    }
    
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 0.9;
    
    // Also set lang on utterance for browsers that need it.
    // If `voice` is missing, `lang` is the main hint to pick a correct voice.
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
    const hasVoiceForLang = this.hasVoiceForLanguage(currentLang);
    const fallbackEnglish = getNarration(scene.id, 'en');

    // If the user selected a language but the browser has no matching voice, speaking that text
    // will typically use a default (often English) voice and sound very wrong. In that case,
    // fall back to English narration/voice and surface a clear warning.
    let text = narrationText || fallbackEnglish || scene.summary;
    let languageOverride = narrationText ? undefined : 'en';
    if (currentLang !== 'en' && narrationText && !hasVoiceForLang) {
      console.warn(`[TTS] No voice available for "${currentLang}". Falling back to English narration/voice.`);
      text = fallbackEnglish || scene.summary;
      languageOverride = 'en';
    }
    
    // Debug logging
    console.log(`[TTS] speakScene called:`);
    console.log(`  - scene.id: ${scene.id}`);
    console.log(`  - currentLang: ${currentLang}`);
    console.log(`  - narrationText found: ${!!narrationText}`);
    console.log(`  - voice available for lang: ${hasVoiceForLang}`);
    console.log(`  - text preview: ${text.substring(0, 100)}...`);

    // Try to avoid speaking before voices are loaded (otherwise some browsers pick a wrong default voice).
    await this.whenVoicesReady(700);
    if (requestId !== this.speakRequestId) {
      return;
    }
    
    // Slightly slower than default for a calmer, more "lecture-like" cadence.
    this.speak(text, { rate: 0.78, languageOverride });

    // Read the on-screen "Key idea" too (it's shown in the right panel, but we avoid duplicating it on-canvas).
    // Keep language selection consistent with the narration language when the text exists,
    // otherwise fall back to English text with an English voice.
    const rawKeyIdeaText = getKeyIdea(scene.id, currentLang);
    const fallbackKeyIdeaEn = getKeyIdea(scene.id, 'en') || scene.key || '';
    const keyIdeaText = (currentLang !== 'en' && rawKeyIdeaText && !hasVoiceForLang) ? '' : rawKeyIdeaText;
    const keyText = keyIdeaText || fallbackKeyIdeaEn;
    if (keyText) {
      const keyLanguageOverride = keyIdeaText ? undefined : 'en';
      const prefix = (keyLanguageOverride !== 'en' && currentLang === 'ro') ? 'Ideea cheie' : 'Key idea';
      this.speak(`${prefix}: ${keyText}`, { rate: 0.82, languageOverride: keyLanguageOverride, queue: true });
    }
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

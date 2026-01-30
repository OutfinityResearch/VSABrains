/**
 * Narrations Loader
 * Loads narration texts from JSON files for each lesson
 */

// Narration file URLs (resolve relative to this module for reliable loading).
// Use `.href` strings for maximum browser compatibility (not all fetch impls accept URL objects).
const NARRATION_FILES = [
  new URL('./narrations/01-grid.json', import.meta.url).href,
  new URL('./narrations/02-displacement.json', import.meta.url).href,
  new URL('./narrations/03-path.json', import.meta.url).href,
  new URL('./narrations/04-multicolumn.json', import.meta.url).href,
  new URL('./narrations/05-localization.json', import.meta.url).href,
  new URL('./narrations/06-voting.json', import.meta.url).href,
  new URL('./narrations/07-branching.json', import.meta.url).href,
  new URL('./narrations/08-prediction.json', import.meta.url).href,
  new URL('./narrations/09-heavyhitters.json', import.meta.url).href,
  new URL('./narrations/10-replay.json', import.meta.url).href,
  new URL('./narrations/11-slowmaps.json', import.meta.url).href,
  new URL('./narrations/12-reasoning.json', import.meta.url).href,
  new URL('./narrations/13-vsaindex.json', import.meta.url).href,
  new URL('./narrations/14-retrieval.json', import.meta.url).href,
  new URL('./narrations/15-conflict.json', import.meta.url).href,
  new URL('./narrations/16-derivation.json', import.meta.url).href,
  new URL('./narrations/17-entities.json', import.meta.url).href
];

// Cache for loaded narrations
let narrationCache = null;

/**
 * Load all narrations from JSON files
 * @returns {Promise<Object>} Map of scene id to narrations object
 */
export async function loadNarrations() {
  if (narrationCache) {
    return narrationCache;
  }

  const results = await Promise.allSettled(
    NARRATION_FILES.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${response.url}`);
      }
      return response.json();
    })
  );

  const nextCache = {};
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      const data = result.value;
      nextCache[data.id] = data.narrations;
    } else {
      console.warn(`[Narration] Failed to load ${NARRATION_FILES[idx]}: ${result.reason}`);
    }
  });

  if (Object.keys(nextCache).length === 0) {
    console.error('[Narration] Failed to load any narration JSON files.');
    // Don't cache failures; allow retries (e.g., if the page was opened before the static server is ready).
    return {};
  }

  narrationCache = nextCache;
  return narrationCache;
}

/**
 * Get narration for a scene in a specific language
 * @param {string} sceneId - Scene identifier
 * @param {string} lang - Language code (en, pt, ro)
 * @returns {string} Narration text or empty string
 */
export function getNarration(sceneId, lang = 'en') {
  if (!narrationCache) {
    console.warn(`[Narration] Cache not loaded yet, requested scene "${sceneId}" lang "${lang}"`);
    return '';
  }
  
  if (!narrationCache[sceneId]) {
    console.warn(`[Narration] Scene "${sceneId}" not found in cache. Available: ${Object.keys(narrationCache).join(', ')}`);
    return '';
  }
  
  const sceneNarrations = narrationCache[sceneId];
  const normalizedLang = String(lang || 'en').toLowerCase().trim();
  const shortLang = normalizedLang.split('-')[0];
  const requestedText = sceneNarrations[lang] || sceneNarrations[normalizedLang] || sceneNarrations[shortLang];
  
  if (!requestedText) {
    console.warn(`[Narration] Language "${lang}" not found for scene "${sceneId}". Available: ${Object.keys(sceneNarrations).join(', ')}`);
    // Fallback to English
    return sceneNarrations['en'] || '';
  }
  
  console.log(`[Narration] Returning ${lang} text for scene "${sceneId}" (length: ${requestedText.length})`);
  return requestedText;
}

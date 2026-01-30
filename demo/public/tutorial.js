/**
 * Legacy tutorial script (deprecated).
 *
 * The interactive tutorial has been moved to the docs site:
 * - GitHub Pages: /tutorial/
 * - Local demo server: /tutorial/
 *
 * This file stays small on purpose (see fileSizesCheck.sh).
 */

(() => {
  // Only redirect if this script is loaded on a page that looks like the old tutorial page.
  const hasTutorialCanvas = typeof document !== 'undefined'
    && document.getElementById('tutorialCanvas');
  if (!hasTutorialCanvas) return;

  const target = '/tutorial/';
  try {
    // Avoid creating extra browser history entries.
    window.location.replace(target);
  } catch {
    window.location.href = target;
  }
})();


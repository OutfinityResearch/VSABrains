/**
 * Tutorial Text-to-Speech (barrel export)
 * Core logic lives in ./speech/core.js; UI widgets live in ./speech/ui.js.
 */

export { speech } from './speech/core.js';

export {
  createMuteButton,
  createLanguageSelector,
  createRepeatButton
} from './speech/ui.js';

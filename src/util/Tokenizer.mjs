import { Vocabulary } from './Vocabulary.mjs';

/**
 * Deterministic tokenization + encoding into token IDs.
 * Baseline is a simple lexer (words, numbers, punctuation).
 */
export class Tokenizer {
  constructor(config = {}) {
    this.mode = config.mode ?? 'simple';
    this.lowercase = config.lowercase ?? true;
    this.vocabulary = config.vocabulary ?? new Vocabulary();
  }

  /** Tokenize text into string tokens */
  tokenize(text) {
    const t = this.lowercase ? text.toLowerCase() : text;
    if (this.mode !== 'simple') {
      throw new Error(`Unsupported tokenizer mode: ${this.mode}`);
    }
    return t.match(/\w+|[^\w\s]/g) || [];
  }

  /** Encode text into token IDs */
  encode(text) {
    return this.encodeTokens(this.tokenize(text));
  }

  /** Encode pre-tokenized string tokens into token IDs */
  encodeTokens(tokens) {
    return tokens.map((t) => this.vocabulary.id(t));
  }
}

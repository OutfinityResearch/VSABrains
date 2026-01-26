import { SeededRandom } from '../../src/util/random.mjs';

export function makeRng(seed = 0) {
  return new SeededRandom(seed);
}

export function randomTokens(length, vocabSize, seed = 0) {
  const rng = makeRng(seed);
  const tokens = [];
  for (let i = 0; i < length; i++) {
    tokens.push(rng.nextInt(vocabSize) + 1);
  }
  return tokens;
}

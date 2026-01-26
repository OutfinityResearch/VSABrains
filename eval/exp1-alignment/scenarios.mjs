import { SeededRandom } from '../../src/util/random.mjs';

export function generateCleanSequence(length, vocabSize, seed = 0) {
  const rng = new SeededRandom(seed);
  const tokens = [];
  for (let i = 0; i < length; i++) {
    tokens.push(rng.nextInt(vocabSize) + 1);
  }
  return { tokens };
}

export function generatePartialViews(sequence, numColumns, dropRate, seed = 0) {
  const rng = new SeededRandom(seed);
  const views = Array.from({ length: numColumns }, () => []);
  const dropMasks = Array.from({ length: numColumns }, () => []);

  for (const token of sequence.tokens) {
    for (let c = 0; c < numColumns; c++) {
      const drop = rng.nextFloat() < dropRate;
      dropMasks[c].push(drop);
      if (!drop) views[c].push(token);
    }
  }

  return { views, dropMasks };
}

export function injectNoise(tokens, noiseRate, vocabSize, seed = 0) {
  const rng = new SeededRandom(seed);
  const noisyTokens = tokens.map((t) => {
    if (rng.nextFloat() < noiseRate) return rng.nextInt(vocabSize) + 1;
    return t;
  });
  return { noisyTokens };
}

export function generateAmbiguousSequence(length, motifLength, numMotifs, seed = 0) {
  const rng = new SeededRandom(seed);
  const motifs = [];
  for (let i = 0; i < numMotifs; i++) {
    const motif = [];
    for (let j = 0; j < motifLength; j++) {
      motif.push(rng.nextInt(100) + 1);
    }
    motifs.push(motif);
  }

  const tokens = [];
  for (let i = 0; i < length; i++) {
    const motif = motifs[i % motifs.length];
    tokens.push(motif[i % motif.length]);
  }

  return { tokens, motifPositions: {} };
}

/**
 * Seeded random number generator (LCG) for reproducibility.
 */
export class SeededRandom {
  constructor(seed = 0) {
    this.state = seed >>> 0;
  }

  /** Return next uint32 */
  nextU32() {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state;
  }

  /** Return float in [0, 1) */
  nextFloat() {
    return this.nextU32() / 0x100000000;
  }

  /** Return integer in [0, max) */
  nextInt(max) {
    if (max <= 0) return 0;
    return Math.floor(this.nextFloat() * max);
  }
}

/**
 * Deterministic non-cryptographic hashing utilities (32-bit).
 * Implementation: MurmurHash3 x86_32.
 */

function rotl32(n, c) {
  return (n << c) | (n >>> (32 - c));
}

function fmix32(h) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * MurmurHash3 x86_32 for any number of bytes.
 */
function murmur3_x86_32(bytes, seed = 0) {
  let h1 = seed >>> 0;
  const len = bytes.length;
  const nBlocks = (len / 4) | 0;

  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;

  for (let i = 0; i < nBlocks; i++) {
    const idx = i * 4;
    let k1 = (bytes[idx] | (bytes[idx + 1] << 8) | (bytes[idx + 2] << 16) | (bytes[idx + 3] << 24)) >>> 0;

    k1 = Math.imul(k1, c1);
    k1 = rotl32(k1, 15);
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = rotl32(h1, 13);
    h1 = (Math.imul(h1, 5) + 0xe6546b64) >>> 0;
  }

  // Tail
  let k1 = 0;
  const tailIdx = nBlocks * 4;
  switch (len & 3) {
    case 3:
      k1 ^= bytes[tailIdx + 2] << 16;
    case 2:
      k1 ^= bytes[tailIdx + 1] << 8;
    case 1:
      k1 ^= bytes[tailIdx];
      k1 = Math.imul(k1, c1);
      k1 = rotl32(k1, 15);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
  }

  // Finalization
  h1 ^= len;
  return fmix32(h1);
}

/**
 * MurmurHash3 x86_32 for a single uint32 value.
 */
export function murmurHash32(u32, seed = 0) {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, u32, true); // Little-endian
  return murmur3_x86_32(bytes, seed);
}

/**
 * MurmurHash3 x86_32 for strings.
 */
export function hashString(str, seed = 0) {
  if (str === "") return 0;
  const bytes = new TextEncoder().encode(str);
  return murmur3_x86_32(bytes, seed);
}

/**
 * Combines multiple uint32 values into a single hash.
 * Following the specific folding recommendation in DS002a.
 */
export function hashCombineU32(values, seed = 0) {
  let h = seed >>> 0;
  for (const v of values) {
    h = murmurHash32(v, h);
  }
  return h >>> 0;
}
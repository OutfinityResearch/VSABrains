import { describe, it } from 'node:test';
import assert from 'node:assert';
import { murmurHash32, hashString, hashCombineU32 } from '../../src/util/hash.mjs';

describe('Hash Golden Vectors (DS002a/DS002b)', () => {
  it('murmurHash32 vectors', () => {
    assert.strictEqual(murmurHash32(0x00000000, 0), 0x2362f9de);
    assert.strictEqual(murmurHash32(0x00000001, 0), 0xfbf1402a);
    assert.strictEqual(murmurHash32(0xffffffff, 0), 0x76293b50);
    assert.strictEqual(murmurHash32(0x12345678, 0), 0xec3dcb62);
  });

  it('hashString vectors', () => {
    assert.strictEqual(hashString('hello', 0), 0x248bfa47);
    assert.strictEqual(hashString('Alice', 0), 0xcf844b6e);
    assert.strictEqual(hashString('room_A', 0), 0xad4fb29b);
  });

  it('hashCombineU32 vectors', () => {
    assert.strictEqual(hashCombineU32([1, 2], 0), 0x647dde73);
    assert.strictEqual(hashCombineU32([100, 200, 300], 0), 0xb0965174);
  });
});

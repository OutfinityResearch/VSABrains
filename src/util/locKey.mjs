/** Pack (x, y) into a 32-bit locKey */
export function packLocKey(x, y) {
  return (((x & 0xffff) << 16) | (y & 0xffff)) >>> 0;
}

/** Unpack locKey into { x, y } */
export function unpackLocKey(locKey) {
  return { x: locKey >>> 16, y: locKey & 0xffff };
}

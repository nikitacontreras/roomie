/**
 * Standard CRC32 (ISO 3309 / ITU-T V.42) for Buffers / Uint8Arrays.
 * Lookup table is built once per process.
 */

const TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

export function crc32(buffer: Buffer | Uint8Array): string {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return ((crc ^ -1) >>> 0).toString(16).padStart(8, "0").toLowerCase();
}

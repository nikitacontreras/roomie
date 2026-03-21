/**
 * Standard CRC32 implementation for Node.js Buffers/TypedArrays.
 */
export function crc32(buffer: Buffer | Uint8Array): string {
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }

    let crc = -1;
    for (let i = 0; i < buffer.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xFF];
    }

    return ((crc ^ -1) >>> 0).toString(16).padStart(8, '0').toLowerCase();
}

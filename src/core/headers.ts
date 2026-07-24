import type { SupportedSystem } from "../types.js";

export interface HeaderStripResult {
  /** ROM bytes with dump header removed when applicable. */
  payload: Buffer;
  headerBytes: number;
}

/**
 * Strip known dump wrappers (not cartridge mapper headers):
 * - NES iNES / NES 2.0: 16-byte header (+ 512 trainer if present)
 * - SNES SMC: 512-byte copier header when size % 1024 === 512
 */
export function stripDumpHeader(
  buf: Buffer,
  system: SupportedSystem
): HeaderStripResult {
  if (system === "nes" && buf.length >= 16) {
    const isINes =
      buf[0] === 0x4e &&
      buf[1] === 0x45 &&
      buf[2] === 0x53 &&
      buf[3] === 0x1a;
    if (isINes) {
      const hasTrainer = (buf[6] & 0x04) !== 0;
      const headerBytes = 16 + (hasTrainer ? 512 : 0);
      if (buf.length > headerBytes) {
        return { payload: buf.subarray(headerBytes), headerBytes };
      }
    }
  }

  if (system === "sfc" && buf.length > 512 && buf.length % 1024 === 512) {
    return { payload: buf.subarray(512), headerBytes: 512 };
  }

  return { payload: buf, headerBytes: 0 };
}

/** Bytes used for metadata parsing (after SMC strip for SFC). */
export function romForParsing(buf: Buffer, system: SupportedSystem): Buffer {
  if (system === "sfc" && buf.length > 512 && buf.length % 1024 === 512) {
    return buf.subarray(512);
  }
  return buf;
}

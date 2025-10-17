import { promises as fs } from "node:fs";

function plausibleHeaderByte(b: number): boolean {
  return Number.isInteger(b) && b >= 0 && b <= 0xFF;
}

/** Heuristic detection. Defaults to LoROM (false) if unsure. */
export async function isHiRom(path: string): Promise<boolean> {
  const buf = await fs.readFile(path);
  return isHiRomBuffer(buf);
}

export function isHiRomBuffer(buf: Buffer): boolean {
  const offLo = 0x7FD5;
  const offHi = 0xFFD5;
  if (buf.length > offHi) {
    const lo = buf[offLo];
    const hi = buf[offHi];
    if (plausibleHeaderByte(lo) && plausibleHeaderByte(hi)) {
      // Very simple heuristic: choose the one whose "map" nibble looks like HiROM (0x21, 0x31, 0x23, 0x32, 0x25)
      const hiromCandidates = new Set([0x21, 0x31, 0x23, 0x32, 0x25]);
      const loromCandidates = new Set([0x20, 0x30]);
      const hiLikely = hiromCandidates.has(hi);
      const loLikely = loromCandidates.has(lo);
      if (hiLikely && !loLikely) return true;
      if (loLikely && !hiLikely) return false;
      // If both plausible, prefer the one with a valid checksum complement just as a tie-breaker (not implemented)
    }
  }
  // Fallback: LoROM
  return false;
}

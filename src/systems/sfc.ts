import { regions } from "../tables/regions.js";
import { specs } from "../tables/specs.js";
import { readAscii } from "../utils/buffer.js";
import type { DetectResult, SfcInfo } from "../types.js";

const HIROM_MAP = new Set([0x21, 0x31, 0x25, 0x35]);
const LOROM_MAP = new Set([0x20, 0x30]);
const SA1_MAP = new Set([0x23, 0x32]);

function stripSmcIfNeeded(buf: Buffer): { rom: Buffer; smcHeaderBytes: number } {
  if (buf.length > 512 && buf.length % 1024 === 512) {
    return { rom: buf.subarray(512), smcHeaderBytes: 512 };
  }
  return { rom: buf, smcHeaderBytes: 0 };
}

/** Validate SNES header checksum pair (complement + checksum == 0xFFFF). */
function headerChecksumScore(rom: Buffer, headerBase: number): number {
  // header at 0x7FC0 / 0xFFC0; checksum at +0x1C / +0x1E
  const off = headerBase + 0x1c;
  if (rom.length < off + 4) return 0;
  const complement = rom.readUInt16LE(off);
  const checksum = rom.readUInt16LE(off + 2);
  if (((complement + checksum) & 0xffff) === 0xffff && (complement !== 0 || checksum !== 0)) {
    return 40;
  }
  // Weak: non-zero checksum fields
  if (checksum !== 0 && complement !== 0) return 5;
  return 0;
}

function mapModeScore(byte: number, wantHi: boolean): number {
  if (wantHi) {
    if (HIROM_MAP.has(byte) || SA1_MAP.has(byte)) return 25;
    if (LOROM_MAP.has(byte)) return -10;
  } else {
    if (LOROM_MAP.has(byte)) return 25;
    if (HIROM_MAP.has(byte) || SA1_MAP.has(byte)) return -10;
  }
  // Accept other documented map modes loosely
  if ((byte & 0x0f) === 0x0 || (byte & 0x0f) === 0x1) return 8;
  return 0;
}

function titleScore(rom: Buffer, titleOff: number): number {
  if (rom.length < titleOff + 21) return 0;
  let printable = 0;
  let zeros = 0;
  for (let i = 0; i < 21; i++) {
    const c = rom[titleOff + i];
    if (c === 0) zeros++;
    else if (c >= 0x20 && c <= 0x7e) printable++;
  }
  if (printable >= 6) return 15;
  if (printable >= 3) return 5;
  if (zeros > 18) return -5;
  return 0;
}

/** Returns true when HiROM header looks better than LoROM. */
export function isHiRomBuffer(buf: Buffer): boolean {
  const { rom } = stripSmcIfNeeded(buf);
  return scoreHeader(rom, true) > scoreHeader(rom, false);
}

function scoreHeader(rom: Buffer, hi: boolean): number {
  const mapOff = hi ? 0xffd5 : 0x7fd5;
  const titleOff = hi ? 0xffc0 : 0x7fc0;
  if (rom.length <= mapOff) return -100;
  let score = 0;
  score += mapModeScore(rom[mapOff], hi);
  score += headerChecksumScore(rom, titleOff);
  score += titleScore(rom, titleOff);
  // Reset/vector-ish bytes in header often non-zero
  const resetVec = titleOff + 0x3c;
  if (rom.length > resetVec + 1) {
    const vec = rom.readUInt16LE(resetVec);
    if (vec >= 0x8000) score += 5;
  }
  return score;
}

export function scoreSfc(buf: Buffer): DetectResult | null {
  const { rom } = stripSmcIfNeeded(buf);
  if (rom.length < 0x8000) return null;

  const lo = scoreHeader(rom, false);
  const hi = rom.length > 0xffd5 ? scoreHeader(rom, true) : -100;
  const best = Math.max(lo, hi);

  if (best < 20) return null;
  // Cap score so stronger magics (NES, N64) still win when present
  return { system: "sfc", score: Math.min(90, 30 + best) };
}

/**
 * ROM size byte at $FFD7/$7FD7: size = 2^N kilobytes.
 * SRAM size byte at $FFD8/$7FD8: 0 = none, else 2^N kilobytes.
 */
export function romSizeBytes(exp: number): number {
  if (exp < 0 || exp > 20) return 0;
  return (1 << exp) * 1024;
}

export function ramSizeBytes(exp: number): number {
  if (exp <= 0 || exp > 20) return 0;
  return (1 << exp) * 1024;
}

export function parseSfc(buf: Buffer): SfcInfo {
  const { rom, smcHeaderBytes } = stripSmcIfNeeded(buf);
  const hi = isHiRomBuffer(buf);
  const headerBase = hi ? 0xffc0 : 0x7fc0;
  const mapOff = headerBase + 0x15; // D5
  const hwOff = headerBase + 0x16; // D6
  const romSizeOff = headerBase + 0x17; // D7
  const ramSizeOff = headerBase + 0x18; // D8
  const regionOff = headerBase + 0x19; // D9 (also used as raw romSpeed in legacy)

  const out: SfcInfo = {
    headerOffset: headerBase,
    smcHeaderBytes,
    size: buf.length,
  };

  if (rom.length > headerBase + 21) {
    out.title = readAscii(rom, headerBase, headerBase + 21);
  }

  if (rom.length > regionOff) {
    out.romSpeed = rom[regionOff].toString();
  }

  if (rom.length > mapOff) {
    const key = rom[mapOff].toString(16).padStart(2, "0");
    const spec = specs.sfc.romspeed[key as keyof typeof specs.sfc.romspeed];
    if (spec) {
      out.rom = {
        ...(out.rom || {}),
        type: "type" in spec ? spec.type : undefined,
        speed: "speed" in spec ? spec.speed : undefined,
      };
    } else {
      // Infer type from map mode nibble when table misses
      const mode = rom[mapOff];
      let type = "LoROM";
      if (HIROM_MAP.has(mode)) type = "HiROM";
      else if (mode === 0x25 || mode === 0x35) type = "ExHiROM";
      else if (SA1_MAP.has(mode)) type = "SA-1";
      out.rom = { ...(out.rom || {}), type };
    }
  }

  if (rom.length > romSizeOff) {
    const size = romSizeBytes(rom[romSizeOff]);
    out.rom = { ...(out.rom || {}), size };
  }

  if (rom.length > ramSizeOff) {
    out.ram = ramSizeBytes(rom[ramSizeOff]);
  }

  if (rom.length > hwOff) {
    const hwKey = rom[hwOff].toString(16).padStart(2, "0");
    const hw = specs.sfc.hardware[hwKey as keyof typeof specs.sfc.hardware];
    if (hw) out.hardware = { ...hw };
  }

  return out;
}

export function sfcRegion(buf: Buffer): string | undefined {
  const { rom } = stripSmcIfNeeded(buf);
  const hi = isHiRomBuffer(buf);
  const off = hi ? 0xffd9 : 0x7fd9;
  if (rom.length <= off) return undefined;
  return regions.snes[rom[off]];
}

export function sfcName(buf: Buffer): string | undefined {
  const info = parseSfc(buf);
  return info.title;
}

/** @deprecated use isHiRomBuffer */
export async function isHiRom(path: string): Promise<boolean> {
  const { promises: fs } = await import("node:fs");
  const buf = await fs.readFile(path);
  return isHiRomBuffer(buf);
}

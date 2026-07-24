import { regions } from "../tables/regions.js";
import { hasAscii, readAscii } from "../utils/buffer.js";
import type { DetectResult, GbaInfo } from "../types.js";

/** GBA Nintendo logo begins at 0x04 — first bytes of compressed logo. */
const GBA_LOGO_START = Buffer.from([0x24, 0xff, 0xae, 0x51, 0x69, 0x9a]);

const SAVE_PATTERNS = [
  "EEPROM_V",
  "SRAM_F_V",
  "SRAM_V",
  "FLASH1M_V",
  "FLASH512_V",
  "FLASH_V",
] as const;

export function scoreGba(buf: Buffer): DetectResult | null {
  if (buf.length < 0xc0) return null;

  let score = 0;

  // ARM branch at 0x00 (typically 0xEA0000xx)
  if (buf[3] === 0xea) score += 15;

  if (buf.subarray(0x04, 0x0a).equals(GBA_LOGO_START)) {
    score += 50;
  }

  // Fixed value 0x96 at 0xB2
  if (buf[0xb2] === 0x96) score += 30;

  // Game code A-Z0-9 at 0xAC–0xAF
  const code = readAscii(buf, 0xac, 0xb0, false);
  if (/^[A-Z0-9]{4}$/.test(code)) score += 15;

  if (score < 50) return null;
  return { system: "gba", score: Math.min(98, score) };
}

export function detectGbaSaveType(buf: Buffer): string {
  // Scan first 1MB for SDK save-type ID strings (byte search, not full toString)
  const max = Math.min(buf.length, 0x100000);
  for (const pattern of SAVE_PATTERNS) {
    if (hasAscii(buf, pattern, max)) {
      if (pattern.startsWith("FLASH1M")) return "FLASH1M";
      if (pattern.startsWith("FLASH512")) return "FLASH512";
      if (pattern.startsWith("FLASH")) return "FLASH";
      if (pattern.startsWith("EEPROM")) return "EEPROM";
      if (pattern.startsWith("SRAM")) return "SRAM";
    }
  }
  return "Unknown";
}

export function parseGba(buf: Buffer): GbaInfo {
  const title = buf.length >= 0xac ? readAscii(buf, 0xa0, 0xac) : undefined;
  const gameCode = buf.length >= 0xb0 ? readAscii(buf, 0xac, 0xb0) : undefined;
  const makerCode = buf.length >= 0xb2 ? readAscii(buf, 0xb0, 0xb2) : undefined;
  const region =
    gameCode && gameCode.length >= 4
      ? regions.gba[gameCode[3]]
      : undefined;

  return {
    title: title || undefined,
    gameCode: gameCode || undefined,
    makerCode: makerCode || undefined,
    region,
    saveType: detectGbaSaveType(buf),
    size: buf.length,
  };
}

export function gbaRegion(buf: Buffer): string | undefined {
  return parseGba(buf).region;
}

export function gbaName(buf: Buffer): string | undefined {
  return parseGba(buf).title;
}

export function gbaGameCode(buf: Buffer): string | undefined {
  return parseGba(buf).gameCode;
}

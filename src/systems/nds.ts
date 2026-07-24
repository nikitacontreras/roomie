import { regions } from "../tables/regions.js";
import { specs } from "../tables/specs.js";
import { readAscii } from "../utils/buffer.js";
import type { DetectResult, NdsInfo } from "../types.js";

export function scoreNds(buf: Buffer): DetectResult | null {
  if (buf.length < 0x200) return null;

  let score = 0;

  // Nintendo logo CRC at 0x15C / 0x15E are often used; also check ARM9 offset
  const gameCode = readAscii(buf, 0x0c, 0x10, false);
  if (/^[A-Z0-9]{4}$/.test(gameCode)) score += 20;

  // Unit code 0–2
  const unit = buf[0x12];
  if (unit <= 2) score += 5;

  // Encryption seed select usually 0
  // ARM9 ROM offset at 0x20 — typically >= 0x4000
  if (buf.length >= 0x24) {
    const arm9 = buf.readUInt32LE(0x20);
    if (arm9 >= 0x4000 && arm9 < buf.length) score += 25;
  }

  // Nintendo logo checksum fixed value 0xCF56 at 0x15C
  if (buf.length > 0x15d) {
    const logoCrc = buf.readUInt16LE(0x15c);
    if (logoCrc === 0xcf56) score += 45;
  }

  // Header CRC present
  if (buf.length > 0x15f) {
    score += 5;
  }

  if (score < 50) return null;
  // Prefer NDS over GBA when both could match game codes
  return { system: "nds", score: Math.min(99, score) };
}

export function parseNds(buf: Buffer): NdsInfo {
  const title = buf.length >= 0x0c ? readAscii(buf, 0x0, 0x0c) : undefined;
  const gameCode = buf.length >= 0x10 ? readAscii(buf, 0x0c, 0x10) : undefined;
  const makerCode = buf.length >= 0x12 ? readAscii(buf, 0x10, 0x12) : undefined;
  const unitCodeRaw = buf.length > 0x12 ? buf[0x12] : undefined;
  const unitCode =
    unitCodeRaw !== undefined
      ? specs.nds.unitcode[String(unitCodeRaw) as keyof typeof specs.nds.unitcode]
      : undefined;

  // Device capacity: size = 128KB << capacity
  const deviceCapacity = buf.length > 0x14 ? buf[0x14] : undefined;
  const deviceCapacityBytes =
    deviceCapacity !== undefined ? 131072 << deviceCapacity : undefined;

  const romVersion = buf.length > 0x1e ? buf[0x1e] : undefined;
  const region =
    gameCode && gameCode.length >= 4
      ? regions.nds[gameCode[3]]
      : undefined;

  return {
    title: title || undefined,
    gameCode: gameCode || undefined,
    makerCode: makerCode || undefined,
    region,
    unitCode,
    unitCodeRaw,
    deviceCapacity,
    deviceCapacityBytes,
    romVersion,
    size: buf.length,
  };
}

export function ndsRegion(buf: Buffer): string | undefined {
  return parseNds(buf).region;
}

export function ndsName(buf: Buffer): string | undefined {
  return parseNds(buf).title;
}

export function ndsGameCode(buf: Buffer): string | undefined {
  return parseNds(buf).gameCode;
}

export function ndsGameId(buf: Buffer): string | undefined {
  const code = ndsGameCode(buf);
  return code ? `NTR-${code}` : undefined;
}

import { regions } from "../tables/regions.js";
import { specs } from "../tables/specs.js";
import { readAscii } from "../utils/buffer.js";
import type { DetectResult, GbInfo, SupportedSystem } from "../types.js";

/** Nintendo logo bitmap at 0x104–0x133 (partial match is enough). */
const NINTENDO_LOGO_START = Buffer.from([
  0xce, 0xed, 0x66, 0x66, 0xcc, 0x0d, 0x00, 0x0b,
]);

export function scoreGb(buf: Buffer): DetectResult | null {
  if (buf.length < 0x150) return null;

  let score = 0;

  // Nintendo logo
  if (buf.subarray(0x104, 0x10c).equals(NINTENDO_LOGO_START)) {
    score += 50;
  }

  // Header checksum at 0x14D — validate over 0x134–0x14C
  if (buf.length > 0x14d) {
    let x = 0;
    for (let i = 0x134; i <= 0x14c; i++) {
      x = (x - buf[i] - 1) & 0xff;
    }
    if (x === buf[0x14d]) score += 40;
  }

  // CGB flag plausible
  const cgb = buf[0x143];
  if (cgb === 0x80 || cgb === 0xc0 || cgb === 0x00) score += 5;

  if (score < 40) return null;

  const system: SupportedSystem =
    cgb === 0xc0 || cgb === 0x80 ? "gbc" : "gb";

  return { system, score: Math.min(95, score) };
}

export function parseGb(buf: Buffer): GbInfo {
  const cgbFlag = buf.length > 0x143 ? buf[0x143] : 0;
  const isColor = cgbFlag === 0x80 || cgbFlag === 0xc0;

  // Title: 0x134–0x143, shorter when manufacturer code present (CGB)
  let titleEnd = 0x144;
  if (isColor) titleEnd = 0x13f;
  const title = buf.length >= titleEnd ? readAscii(buf, 0x134, titleEnd) : undefined;

  const manufacturerCode =
    isColor && buf.length >= 0x143 ? readAscii(buf, 0x13f, 0x143) : undefined;

  const mbcCode =
    buf.length > 0x147 ? buf[0x147].toString(16).padStart(2, "0") : undefined;
  const mbc = mbcCode ? specs.gb_mbc[mbcCode] : undefined;

  const romSizeKey =
    buf.length > 0x148 ? buf[0x148].toString(16).padStart(2, "0") : undefined;
  const ramSizeKey =
    buf.length > 0x149 ? buf[0x149].toString(16).padStart(2, "0") : undefined;

  const regionByte = buf.length > 0x14a ? buf[0x14a] : undefined;
  const region =
    regionByte !== undefined ? regions.gb[regionByte] : undefined;

  const sgbFlag = buf.length > 0x146 ? buf[0x146] : undefined;

  return {
    title: title || undefined,
    manufacturerCode: manufacturerCode || undefined,
    cgbFlag,
    sgbFlag,
    mbc,
    mbcCode,
    romSize: romSizeKey ? specs.gb_rom_size[romSizeKey] : undefined,
    ramSize: ramSizeKey ? specs.gb_ram_size[ramSizeKey] : undefined,
    region,
    isColor,
    size: buf.length,
  };
}

export function gbRegion(buf: Buffer): string | undefined {
  return parseGb(buf).region;
}

export function gbName(buf: Buffer): string | undefined {
  return parseGb(buf).title;
}

export function gbGameCode(buf: Buffer): string | undefined {
  const info = parseGb(buf);
  return info.manufacturerCode || undefined;
}

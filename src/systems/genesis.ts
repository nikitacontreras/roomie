import { readAscii } from "../utils/buffer.js";
import type { DetectResult, GenesisInfo } from "../types.js";

export function scoreGenesis(buf: Buffer): DetectResult | null {
  if (buf.length < 0x200) return null;

  // Prefer "SEGA" at 0x100; also " SEGA" variants
  const magic = readAscii(buf, 0x100, 0x104, false);
  if (magic === "SEGA") {
    // Console name at 0x100–0x110 often "SEGA GENESIS" / "SEGA MEGA DRIVE"
    const sys = readAscii(buf, 0x100, 0x110);
    let score = 90;
    if (/GENESIS|MEGA\s*DRIVE|MEGADRIVE/i.test(sys)) score = 100;
    return { system: "genesis", score };
  }

  // SMD interleaved format sometimes lacks plain SEGA at 0x100
  return null;
}

export function parseGenesis(buf: Buffer): GenesisInfo {
  if (buf.length < 0x200) {
    return { size: buf.length };
  }

  return {
    systemType: readAscii(buf, 0x100, 0x110) || undefined,
    copyright: readAscii(buf, 0x110, 0x120) || undefined,
    domesticName: readAscii(buf, 0x120, 0x150) || undefined,
    overseasName: readAscii(buf, 0x150, 0x180) || undefined,
    serial: readAscii(buf, 0x180, 0x18e) || undefined,
    region: readAscii(buf, 0x1f0, 0x200) || undefined,
    size: buf.length,
  };
}

export function genesisName(buf: Buffer): string | undefined {
  const info = parseGenesis(buf);
  return info.overseasName || info.domesticName;
}

export function genesisRegion(buf: Buffer): string | undefined {
  return parseGenesis(buf).region;
}

import type { DetectResult, SmsInfo, SupportedSystem } from "../types.js";

const HEADER_OFFSETS = [0x7ff0, 0x3ff0, 0x1ff0] as const;

export function findSmsHeaderOffset(buf: Buffer): number | null {
  for (const off of HEADER_OFFSETS) {
    if (buf.length >= off + 16) {
      const tag = buf.subarray(off, off + 8).toString("ascii");
      if (tag === "TMR SEGA") return off;
    }
  }
  return null;
}

export function scoreSms(buf: Buffer): DetectResult | null {
  const off = findSmsHeaderOffset(buf);
  if (off === null) return null;

  // Region code high nibble: 3=SMS Japan, 4=SMS Export, 5=GG Japan, 6=GG Export, 7=GG International
  const regionNibble = buf[off + 15] >> 4;
  let system: SupportedSystem = "sms";
  if (regionNibble >= 5) system = "gg";
  else if (regionNibble >= 3) system = "sms";
  else {
    // Fallback heuristic by size
    system = buf.length <= 0x80000 ? "gg" : "sms";
  }

  return { system, score: 95 };
}

export function parseSms(buf: Buffer, system: "sms" | "gg" = "sms"): SmsInfo {
  const off = findSmsHeaderOffset(buf);
  if (off === null) {
    return { headerOffset: -1, size: buf.length };
  }

  // Product code: BCD-ish in bytes 12–14
  const b12 = buf[off + 12];
  const b13 = buf[off + 13];
  const b14 = buf[off + 14];
  const version = b14 & 0x0f;
  const productNum =
    ((b14 & 0xf0) >> 4) * 10000 +
    ((b13 & 0xf0) >> 4) * 1000 +
    (b13 & 0x0f) * 100 +
    ((b12 & 0xf0) >> 4) * 10 +
    (b12 & 0x0f);

  const regionNibble = buf[off + 15] >> 4;
  const regionMap: Record<number, string> = {
    3: "Japan (SMS)",
    4: "Export (SMS)",
    5: "Japan (GG)",
    6: "Export (GG)",
    7: "International (GG)",
  };

  return {
    product: productNum.toString().padStart(5, "0"),
    version,
    region: regionMap[regionNibble] ?? (regionNibble >= 4 ? "Export" : "Japan"),
    headerOffset: off,
    size: buf.length,
  };
}

export function smsName(system: "sms" | "gg"): string {
  return system === "gg" ? "Game Gear ROM" : "Master System ROM";
}

export function smsRegion(buf: Buffer): string | undefined {
  return parseSms(buf).region;
}

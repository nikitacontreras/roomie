import type { DetectResult, SupportedSystem, WonderSwanInfo } from "../types.js";

/**
 * WonderSwan metadata lives in the last 10 (or 16) bytes of the ROM.
 * Layout (from end-10):
 *   +0 publisher, +1 system (0=WS, 1=WSC), +2 game id, +3 revision,
 *   +4 rom size, +5 save type/flags, +6 flags (bit0 region), +7–8 checksum...
 */
export function scoreWonderSwan(buf: Buffer): DetectResult | null {
  if (buf.length < 0x1000) return null;

  const off = buf.length - 10;
  const modelByte = buf[off + 1];
  if (modelByte !== 0 && modelByte !== 1) return null;

  // ROM size code at +4: known values 0x00–0x09 roughly
  const romSizeCode = buf[off + 4];
  if (romSizeCode > 0x0c) return null;

  // Checksum is over the whole image except the last 2 bytes (little-endian)
  // Validate when length is plausible
  let score = 20;
  if (buf.length >= 12) {
    const stored = buf.readUInt16LE(buf.length - 2);
    let sum = 0;
    for (let i = 0; i < buf.length - 2; i++) sum = (sum + buf[i]) & 0xffff;
    // Some dumps use complement; accept either exact sum or 0x10000-sum patterns loosely
    if (sum === stored) score += 50;
    else if (((0x10000 - sum) & 0xffff) === stored) score += 40;
    else score += 5; // weak
  }

  // Publisher non-zero is common
  if (buf[off] !== 0) score += 5;

  if (score < 25) return null;

  const system: SupportedSystem = modelByte === 1 ? "wsc" : "ws";
  return { system, score: Math.min(85, score) };
}

export function parseWonderSwan(buf: Buffer): WonderSwanInfo {
  if (buf.length < 10) {
    return { model: "WS", size: buf.length };
  }

  const off = buf.length - 10;
  const model: "WS" | "WSC" = buf[off + 1] === 1 ? "WSC" : "WS";
  const region = (buf[off + 6] & 0x01) === 0 ? "Japan" : "Export";

  return {
    publisher: buf[off],
    model,
    gameId: buf[off + 2],
    version: buf[off + 3],
    region,
    size: buf.length,
  };
}

export function wsName(model: "WS" | "WSC"): string {
  return model === "WSC" ? "WonderSwan Color ROM" : "WonderSwan ROM";
}

export function wsRegion(buf: Buffer): string | undefined {
  return parseWonderSwan(buf).region;
}

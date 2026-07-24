import { regions } from "../tables/regions.js";
import type { DetectResult, N64Info } from "../types.js";

export type N64Endian = "z64" | "v64" | "n64" | "unknown";

export function n64Endian(buf: Buffer): N64Endian {
  if (buf.length < 4) return "unknown";
  const magic = buf.readUInt32BE(0);
  if (magic === 0x80371240) return "z64";
  if (magic === 0x37804012) return "v64";
  if (magic === 0x40123780) return "n64";
  return "unknown";
}

export function scoreN64(buf: Buffer): DetectResult | null {
  if (buf.length < 0x40) return null;
  const endian = n64Endian(buf);
  if (endian === "unknown") return null;
  return { system: "n64", score: 100 };
}

/**
 * Convert a ROM (or header slice) to big-endian z64 byte order.
 * Always works on a copy so original dump endian is preserved in `rom`.
 */
export function toZ64(buf: Buffer): Buffer {
  const endian = n64Endian(buf);
  if (endian === "z64" || endian === "unknown") {
    return Buffer.from(buf);
  }

  const out = Buffer.alloc(buf.length);

  if (endian === "v64") {
    // 16-bit byte swap
    for (let i = 0; i + 1 < buf.length; i += 2) {
      out[i] = buf[i + 1];
      out[i + 1] = buf[i];
    }
    if (buf.length % 2 === 1) out[buf.length - 1] = buf[buf.length - 1];
    return out;
  }

  // .n64: 32-bit word swap
  for (let i = 0; i + 3 < buf.length; i += 4) {
    out[i] = buf[i + 3];
    out[i + 1] = buf[i + 2];
    out[i + 2] = buf[i + 1];
    out[i + 3] = buf[i];
  }
  const rem = buf.length % 4;
  if (rem) {
    buf.copy(out, buf.length - rem, buf.length - rem);
  }
  return out;
}

/** Header view in z64 order (enough for name / game code / version). */
function headerNative(buf: Buffer): Buffer {
  const slice = buf.subarray(0, Math.min(buf.length, 0x40));
  return toZ64(slice);
}

/** Read a string from the N64 header, accounting for byte-swapped dumps. */
export function getN64String(buf: Buffer, offset: number, length: number): string {
  const native = headerNative(buf);
  if (native.length < offset + length) return "";
  return native.subarray(offset, offset + length).toString("ascii");
}

/** Read a single header byte with endian conversion. */
export function getN64Byte(buf: Buffer, offset: number): number | undefined {
  const native = headerNative(buf);
  if (native.length <= offset) return undefined;
  return native[offset];
}

export function parseN64(buf: Buffer): N64Info {
  const endian = n64Endian(buf);
  const name = getN64String(buf, 0x20, 20).replace(/\0/g, "").trim();
  const gameCode = getN64String(buf, 0x3b, 4).replace(/\0/g, "").trim();
  const versionByte = getN64Byte(buf, 0x3f);
  const countryChar = gameCode.length >= 4 ? gameCode[3] : undefined;

  return {
    name: name || undefined,
    gameCode: gameCode || undefined,
    country: countryChar ? regions.n64[countryChar] ?? "Unknown" : undefined,
    version: versionByte !== undefined ? versionByte.toString() : undefined,
    endian,
    size: buf.length,
  };
}

export function n64Region(buf: Buffer): string | undefined {
  return parseN64(buf).country;
}

export function n64Name(buf: Buffer): string | undefined {
  return parseN64(buf).name;
}

export function n64GameCode(buf: Buffer): string | undefined {
  const code = getN64String(buf, 0x3b, 4).replace(/\0/g, "").trim();
  return code || undefined;
}

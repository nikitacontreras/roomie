import { createHash } from "node:crypto";
import { crc32 } from "../utils/crc32.js";
import type { HashInfo } from "../types.js";

export function computeHashes(buf: Buffer): Pick<HashInfo, "sha1" | "md5" | "crc32"> {
  return {
    sha1: createHash("sha1").update(buf).digest("hex"),
    md5: createHash("md5").update(buf).digest("hex"),
    crc32: crc32(buf),
  };
}

export function computeHashInfo(
  full: Buffer,
  stripped: Buffer | null,
  headerBytes: number
): HashInfo {
  const base = computeHashes(full);
  if (!stripped || headerBytes <= 0 || stripped.length === full.length) {
    return base;
  }
  const s = computeHashes(stripped);
  return {
    ...base,
    stripped: {
      sha1: s.sha1,
      md5: s.md5,
      crc32: s.crc32,
      headerBytes,
    },
  };
}

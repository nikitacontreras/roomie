import JSZip from "jszip";
import { RoomieError } from "../errors.js";
import type { SupportedSystem } from "../types.js";
import { detectSystem } from "./detect.js";

const SKIP_NAME =
  /\.(txt|nfo|jpg|jpeg|png|gif|bmp|xml|db|url|json|html|htm|md|diz)$|^\.|\/\./i;

const ROM_EXT =
  /\.(nds|gba|gb|gbc|sfc|smc|fig|swc|z64|n64|v64|nes|unf|md|gen|smd|bin|sms|gg|pce|ws|wsc)$/i;

export interface ZipRomEntry {
  filename: string;
  buffer: Buffer;
  system?: SupportedSystem;
  score: number;
}

function isLikelyRomName(name: string): boolean {
  if (SKIP_NAME.test(name)) return false;
  // Prefer known ROM extensions; still allow extensionless / odd names as fallbacks
  return true;
}

/**
 * Extract the best ROM candidate from a ZIP.
 * Scores each non-junk entry via magic-byte detection + extension bonus.
 */
export async function extractRomFromZip(
  zipBuffer: Buffer
): Promise<{ filename: string; buffer: Buffer }> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const names = Object.keys(zip.files).filter((f) => {
    const entry = zip.files[f];
    return !entry.dir && isLikelyRomName(f) && !SKIP_NAME.test(f);
  });

  if (names.length === 0) {
    throw new RoomieError("NO_ROM_IN_ZIP", "ZIP contains no usable ROM entry");
  }

  const scored: ZipRomEntry[] = [];

  for (const filename of names) {
    const buffer = Buffer.from(await zip.files[filename].async("nodebuffer"));
    if (buffer.length < 16) continue;

    const detected = detectSystem(buffer, filename);
    let score = detected?.score ?? 0;

    // Extension bonus when detection is weak or missing
    if (ROM_EXT.test(filename)) {
      score += detected ? 5 : 2;
    }

    // Prefer larger payloads over tiny stubs when scores tie later
    scored.push({
      filename,
      buffer,
      system: detected?.system,
      score,
    });
  }

  if (scored.length === 0) {
    throw new RoomieError("NO_ROM_IN_ZIP", "ZIP contains no usable ROM entry");
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.buffer.length - a.buffer.length;
  });

  const best = scored[0];
  if (best.score <= 0 && !ROM_EXT.test(best.filename)) {
    // Last resort: first non-junk file with a ROM-like extension, else highest size
    const byExt = scored.find((s) => ROM_EXT.test(s.filename));
    if (byExt) return { filename: byExt.filename, buffer: byExt.buffer };
    throw new RoomieError(
      "NO_ROM_IN_ZIP",
      "ZIP has files but none look like a known ROM"
    );
  }

  return { filename: best.filename, buffer: best.buffer };
}

export function isZipBuffer(buf: Buffer): boolean {
  return buf.length >= 4 && buf.readUInt32BE(0) === 0x504b0304;
}

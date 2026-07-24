import type { DetectResult, PceInfo } from "../types.js";

/**
 * PC Engine / TurboGrafx-16 ROMs have no universal magic header.
 * Detection relies mainly on extension; optional weak heuristics for HuCard sizes.
 */
const COMMON_SIZES = new Set([
  256 * 1024,
  384 * 1024,
  512 * 1024,
  768 * 1024,
  1024 * 1024,
]);

export function scorePce(buf: Buffer): DetectResult | null {
  // Very weak: only when size matches common HuCard dumps and not claimed by others
  if (COMMON_SIZES.has(buf.length)) {
    return { system: "pce", score: 5 };
  }
  // 512-byte headered dumps
  if (COMMON_SIZES.has(buf.length - 512)) {
    return { system: "pce", score: 6 };
  }
  return null;
}

export function parsePce(buf: Buffer): PceInfo {
  return {
    size: buf.length,
    note: "PC Engine has no standard internal header; metadata is limited",
  };
}

export function pceName(): string {
  return "PC Engine ROM";
}

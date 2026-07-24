import type { DetectResult, SupportedSystem } from "../types.js";
import { scoreNes } from "../systems/nes.js";
import { scoreSfc } from "../systems/sfc.js";
import { scoreN64 } from "../systems/n64.js";
import { scoreGb } from "../systems/gb.js";
import { scoreGba } from "../systems/gba.js";
import { scoreNds } from "../systems/nds.js";
import { scoreGenesis } from "../systems/genesis.js";
import { scoreSms } from "../systems/sms.js";
import { scoreWonderSwan } from "../systems/ws.js";
import { scorePce } from "../systems/pce.js";

const EXT_MAP: Record<string, SupportedSystem> = {
  nds: "nds",
  gba: "gba",
  gb: "gb",
  gbc: "gbc",
  sfc: "sfc",
  smc: "sfc",
  fig: "sfc",
  swc: "sfc",
  z64: "n64",
  n64: "n64",
  v64: "n64",
  nes: "nes",
  unf: "nes",
  md: "genesis",
  gen: "genesis",
  smd: "genesis",
  sms: "sms",
  gg: "gg",
  pce: "pce",
  ws: "ws",
  wsc: "wsc",
};

export function systemFromExtension(filename: string): SupportedSystem | undefined {
  const base = filename.toLowerCase().split(/[/\\]/).pop() ?? filename;
  const ext = base.includes(".") ? base.split(".").pop()! : "";
  return EXT_MAP[ext];
}

type Scorer = (buf: Buffer) => DetectResult | null;

const SCORERS: Scorer[] = [
  scoreNes,
  scoreN64,
  scoreGenesis,
  scoreSms,
  scoreGba,
  scoreNds,
  scoreGb,
  scoreSfc,
  scoreWonderSwan,
  scorePce,
];

/**
 * Detect console from magic bytes / headers.
 * Optional filename extension is used as a tie-breaker or soft boost.
 */
export function detectSystem(
  buf: Buffer,
  filename?: string,
  preferExtension = true
): DetectResult | null {
  const results: DetectResult[] = [];

  for (const score of SCORERS) {
    const r = score(buf);
    if (r && r.score > 0) results.push(r);
  }

  const byExt = filename ? systemFromExtension(filename) : undefined;

  if (results.length === 0) {
    // Extension-only fallback for systems with weak/no magic (e.g. PCE)
    if (byExt) return { system: byExt, score: 1 };
    return null;
  }

  // Merge extension boost
  if (byExt && preferExtension) {
    for (const r of results) {
      if (r.system === byExt || compatibleExt(r.system, byExt)) {
        r.score += 8;
      }
    }
    // gb/gbc refinement from extension
    if (byExt === "gbc") {
      const gb = results.find((r) => r.system === "gb" || r.system === "gbc");
      if (gb) {
        gb.system = "gbc";
        gb.score += 4;
      }
    }
    if (byExt === "wsc") {
      const ws = results.find((r) => r.system === "ws" || r.system === "wsc");
      if (ws) {
        ws.system = "wsc";
        ws.score += 4;
      }
    }
    if (byExt === "gg") {
      const sms = results.find((r) => r.system === "sms" || r.system === "gg");
      if (sms) {
        sms.system = "gg";
        sms.score += 4;
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results[0] ?? null;
}

function compatibleExt(detected: SupportedSystem, ext: SupportedSystem): boolean {
  if (detected === ext) return true;
  if (
    (detected === "gb" && ext === "gbc") ||
    (detected === "gbc" && ext === "gb")
  )
    return true;
  if (
    (detected === "ws" && ext === "wsc") ||
    (detected === "wsc" && ext === "ws")
  )
    return true;
  if (
    (detected === "sms" && ext === "gg") ||
    (detected === "gg" && ext === "sms")
  )
    return true;
  return false;
}

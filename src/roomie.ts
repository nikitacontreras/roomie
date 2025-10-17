import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { regions } from "./tables/regions";
import { specs } from "./tables/specs";
import { hexEncode } from "./utils/stringHelper";
import { isHiRom, isHiRomBuffer } from "./systems/snes";
import type { SupportedSystem } from "./types";

export interface RomInfo {
  path: string;
  system: SupportedSystem;
  size: number;
  hash: { sha1: string };
  gameCode?: string;
  region?: string;
  sfc?: {
    romSpeed?: string;
    rom?: { size?: number; type?: string; speed?: string };
    ram?: number;
    hardware?: Record<string, unknown>;
  };
}

export class Roomie extends EventEmitter {
  private _path!: string;
  private _rom!: Buffer;
  private _system!: SupportedSystem;
  private _info!: RomInfo;

  constructor(path: string) {
    super();
    this.load(path);
  }

  private detectSystemFromPath(p: string): SupportedSystem {
    const ext = p.toLowerCase().split(".").pop();
    if (ext === "nds") return "nds";
    if (ext === "gba") return "gba";
    if (ext === "gb" || ext === "gbc") return "gb";
    if (ext === "sfc" || ext === "smc") return "sfc";
    // Default to sfc to keep compatibility with original intent; could be improved.
    return "sfc";
  }

  private readGameCode(system: SupportedSystem): string | undefined {
    const b = this._rom;
    try {
      if (system === "nds" && b.length >= 0x10) {
        return b.subarray(0x0C, 0x10).toString("ascii");
      }
      if (system === "gba" && b.length >= 0xB0) {
        return b.subarray(0xAC, 0xB0).toString("ascii");
      }
      if (system === "gb" && b.length >= 0x0143) {
        return b.subarray(0x013F, 0x0143).toString("ascii");
      }
    } catch {}
    return undefined;
  }

  private computeRegion(system: SupportedSystem, gameCode?: string): string | undefined {
    switch (system) {
      case "nds":
        if (gameCode && gameCode.length >= 4) {
          const key = gameCode[3] as keyof typeof regions["nds"];
          return regions.nds[key] as unknown as string;
        }
        return undefined;
      case "gba":
        if (gameCode && gameCode.length >= 4) {
          const key = gameCode[3] as keyof typeof regions["gba"];
          return regions.gba[key] as unknown as string;
        }
        return undefined;
      case "gb":
        if (this._rom.length > 0x14A) {
          const v = this._rom[0x14A];
          return regions.gb[v as keyof typeof regions["gb"]] as string;
        }
        return undefined;
      case "sfc":
        const hi = isHiRomBuffer(this._rom);
        const off = hi ? 0xFFD9 : 0x7FD9;
        if (this._rom.length > off) {
          const key = this._rom[off];
          return regions.snes[key as keyof typeof regions["snes"]] as string;
        }
        return undefined;
    }
  }

  private computeSfcInfo(): RomInfo["sfc"] | undefined {
    if (this._system !== "sfc") return undefined;
    const hi = isHiRomBuffer(this._rom);
    const base = hi ? 0xFFD0 : 0x7FD0; // region/speed map nearby
    const romspeedOff = base + 0x09; // D9
    const romTypeOff = base + 0x05;  // D5
    const romSizeOff = base + 0x07;  // D7
    const ramSizeOff = base + 0x08;  // D8
    const out: RomInfo["sfc"] = {};
    if (this._rom.length > romspeedOff) {
      const key = this._rom[romspeedOff].toString(16);
      out.romSpeed = key;
      const spec = (specs as any).sfc?.romspeed?.[key];
      if (spec) out.rom = { ...(out.rom || {}), type: spec.type, speed: spec.speed };
    }
    if (this._rom.length > romTypeOff) {
      const hwKey = this._rom[romTypeOff].toString(16);
      const hw = (specs as any).sfc?.hardware?.[hwKey];
      if (hw) out.hardware = hw;
    }
    if (this._rom.length > romSizeOff) {
      const exp = this._rom[romSizeOff];
      out.rom = { ...(out.rom || {}), size: Math.pow(2, exp) * 1024 };
    }
    if (this._rom.length > ramSizeOff) {
      const exp = this._rom[ramSizeOff];
      out.ram = Math.pow(2, exp) * 1024;
    }
    return out;
  }

  async load(path: string): Promise<void> {
    this._path = path;
    this._rom = await fs.readFile(path);
    this._system = this.detectSystemFromPath(path);
    const sha1 = createHash("sha1").update(this._rom).digest("hex");
    const gameCode = this.readGameCode(this._system);
    const info: RomInfo = {
      path: this._path,
      system: this._system,
      size: this._rom.length,
      hash: { sha1 },
      gameCode,
      region: this.computeRegion(this._system, gameCode),
    };
    if (this._system === "sfc") {
      info.sfc = this.computeSfcInfo();
    }
    this._info = info;
    this.emit("loaded", info);
  }

  get info(): RomInfo { return this._info; }
  get system(): SupportedSystem { return this._system; }
  get path(): string { return this._path; }
  get rom(): Buffer { return this._rom; }
}

export default Roomie;

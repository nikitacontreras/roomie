import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { regions } from "./tables/regions.js";
import { specs } from "./tables/specs.js";
import { hexEncode } from "./utils/stringHelper.js";
import { isHiRom, isHiRomBuffer } from "./systems/snes.js";
import type { SupportedSystem } from "./types.js";

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
  n64?: {
    name?: string;
    country?: string;
    version?: string;
  };
}

export class Roomie extends EventEmitter {
  private _path!: string;
  private _rom!: Buffer;
  private _system!: SupportedSystem;
  private _info!: RomInfo;

  public name?: string;
  public gameid?: string;
  public region?: string;
  public gamecode?: string;
  public cartridge?: Record<string, unknown>;

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
    if (ext === "z64" || ext === "n64") return "n64";
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
      if (system === "n64" && b.length >= 0x2F) {
        return b.subarray(0x20, 0x2F).toString("ascii").trim();
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
      case "n64":
        // N64 region code at offset 0x3E in some ROMs (common practice)
        if (this._rom.length > 0x3E) {
          const regionByte = this._rom[0x3E];
          // Map region byte to region string (basic example)
          const regionMap: Record<number, string> = {
            0x44: "USA",
            0x45: "Europe",
            0x46: "France",
            0x4A: "Japan",
            0x50: "PAL",
            0x55: "Australia",
            0x58: "Germany",
            0x59: "Europe",
            0x5A: "Europe",
          };
          return regionMap[regionByte] || "Unknown";
        }
        return undefined;
    }
  }

  private computeSfcInfo(): RomInfo["sfc"] | undefined {
    if (this._system !== "sfc") return undefined;
    const hi = isHiRomBuffer(this._rom);
    const base = hi ? 0xFFD0 : 0x7FD0;
    const offD5 = base + 0x05;  // map mode (for specs mapping)
    const offD6 = base + 0x06;  // hardware type
    const offD7 = base + 0x07;  // ROM size exponent
    const offD8 = base + 0x08;  // RAM size exponent
    const offD9 = base + 0x09;  // raw romSpeed byte
    const out: RomInfo["sfc"] = {};

    // romSpeed: raw D9 byte as string, like original JS
    if (this._rom.length > offD9) {
      out.romSpeed = this._rom[offD9].toString().trim();
    }

    // specs: map D5 (2-digit hex) to specs.sfc.romspeed
    if (this._rom.length > offD5) {
      const key = this._rom[offD5].toString(16).padStart(2, "0");
      const spec = (specs as any).sfc?.romspeed?.[key];
      if (spec) out.rom = { ...(out.rom || {}), type: spec.type, speed: spec.speed };
    }

    // rom size from D7 using original expression
    if (this._rom.length > offD7) {
      const exp = this._rom[offD7];
      const size = 2 ** (2 ^ exp) * 1000;
      out.rom = { ...(out.rom || {}), size };
    }

    // ram size from D8 using original expression
    if (this._rom.length > offD8) {
      const exp = this._rom[offD8];
      out.ram = 2 ** (2 ^ exp) * 1000;
    }

    // hardware from D6 (2-digit hex)
    if (this._rom.length > offD6) {
      const hwKey = this._rom[offD6].toString(16).padStart(2, "0");
      const hw = (specs as any).sfc?.hardware?.[hwKey];
      if (hw) out.hardware = hw;
    }

    return out;
  }

  private _name(): string | undefined {
    const b = this._rom;
    try {
      switch (this._system) {
        case "nds":
          if (b.length >= 0x20) {
            return b.subarray(0x0, 0x20).toString("ascii").replace(/\0/g, "").trim();
          }
          break;
        case "gba":
          if (b.length >= 0xAC) {
            return b.subarray(0xA0, 0xAC).toString("ascii").replace(/\0/g, "").trim();
          }
          break;
        case "gb":
          if (b.length >= 0x134) {
            return b.subarray(0x134, 0x144).toString("ascii").replace(/\0/g, "").trim();
          }
          break;
        case "sfc":
          // SNES title at 0x7FC0 or 0xFFC0 depending on LoROM/HiROM
          const hi = isHiRomBuffer(b);
          const base = hi ? 0xFFC0 : 0x7FC0;
          if (b.length > base + 21) {
            return b.subarray(base, base + 21).toString("ascii").replace(/\0/g, "").trim();
          }
          break;
        case "n64":
          if (b.length >= 0x20) {
            return b.subarray(0x20, 0x34).toString("ascii").replace(/\0/g, "").trim();
          }
          break;
      }
    } catch {}
    return undefined;
  }

  private _gameid(): string | undefined {
    const code = this._gamecode();
    if (!code) return undefined;
    switch (this._system) {
      case "nds":
        return "NTR-" + code;
      case "gba":
        return "AGB-" + code;
      default:
        return undefined;
    }
  }

  private _gamecode(): string | undefined {
    const b = this._rom;
    try {
      switch (this._system) {
        case "nds":
          if (b.length >= 0x10) {
            return b.subarray(0x0C, 0x10).toString("ascii");
          }
          break;
        case "gba":
          if (b.length >= 0xB0) {
            return b.subarray(0xAC, 0xB0).toString("ascii");
          }
          break;
        case "gb":
          if (b.length >= 0x0143) {
            return b.subarray(0x013F, 0x0143).toString("ascii");
          }
          break;
        case "n64":
          if (b.length >= 0x2F) {
            return b.subarray(0x20, 0x2F).toString("ascii").trim();
          }
          break;
      }
    } catch {}
    return undefined;
  }

  private _cartridge(): Record<string, unknown> | undefined {
    // Build cartridge metadata depending on system
    const b = this._rom;
    switch (this._system) {
      case "nds": {
        const code = this._gamecode();
        const region = this._region();
        return {
          system: "nds",
          gameCode: code,
          region,
          size: b.length,
        };
      }
      case "gba": {
        const code = this._gamecode();
        const region = this._region();
        return {
          system: "gba",
          gameCode: code,
          region,
          size: b.length,
        };
      }
      case "gb": {
        const region = this._region();
        return {
          system: "gb",
          region,
          size: b.length,
        };
      }
      case "sfc": {
        const sfcInfo = this.computeSfcInfo();
        return {
          system: "sfc",
          ...sfcInfo,
          size: b.length,
        };
      }
      case "n64": {
        // N64 cartridge info from header bytes
        const countryByte = b.length > 0x3E ? b[0x3E] : undefined;
        const versionByte = b.length > 0x3F ? b[0x3F] : undefined;
        const countryMap: Record<number, string> = {
          0x00: "Japan",
          0x01: "USA",
          0x02: "Europe",
          0x03: "Germany",
          0x04: "France",
          0x05: "Spain",
          0x06: "Italy",
          0x07: "China",
          0x08: "Australia",
          0x09: "Unknown",
          0x0A: "Unknown",
          0x0B: "Unknown",
          0x0C: "Unknown",
          0x0D: "Unknown",
          0x0E: "Unknown",
          0x0F: "Unknown",
        };
        return {
          system: "n64",
          name: this._name(),
          country: countryByte !== undefined ? countryMap[countryByte] || "Unknown" : undefined,
          version: versionByte !== undefined ? versionByte.toString() : undefined,
          size: b.length,
        };
      }
      default:
        return undefined;
    }
  }

  private _region(): string | undefined {
    return this.computeRegion(this._system, this._gamecode());
  }

  async load(pathOrBuffer: string | Buffer): Promise<void> {
    if (typeof pathOrBuffer === "string") {
      this._path = pathOrBuffer;
      this._rom = await fs.readFile(pathOrBuffer);
      this._system = this.detectSystemFromPath(pathOrBuffer);
      if (!this._system) {
        throw new Error("unknown_file");
      }
    } else {
      this._rom = pathOrBuffer;
      this._path = "in-memory";

      const b = this._rom;
      let detected: SupportedSystem | undefined = undefined;

      // Check NDS: game code at 0x0C-0x10 ASCII uppercase letters/digits
      if (b.length >= 0x10) {
        const code = b.subarray(0x0C, 0x10).toString("ascii");
        if (/^[A-Z0-9]{4}$/.test(code)) {
          detected = "nds";
        }
      }

      // Check GBA: game code at 0xAC-0xB0 ASCII uppercase letters/digits
      if (!detected && b.length >= 0xB0) {
        const code = b.subarray(0xAC, 0xB0).toString("ascii");
        if (/^[A-Z0-9]{4}$/.test(code)) {
          detected = "gba";
        }
      }

      // Check GB: game code at 0x0134-0x0143 ASCII valid characters
      if (!detected && b.length >= 0x0143) {
        const code = b.subarray(0x0134, 0x0143).toString("ascii");
        if (/^[A-Z0-9]{4,9}$/.test(code)) {
          detected = "gb";
        }
      }

      // Check N64: ASCII text at 0x20-0x2E
      if (!detected && b.length >= 0x2F) {
        const code = b.subarray(0x20, 0x2F).toString("ascii");
        if (/^[\x20-\x7E]+$/.test(code) && code.trim().length > 0) {
          detected = "n64";
        }
      }

      // Check SFC: use isHiRomBuffer heuristic
      if (!detected) {
        if (b.length > 0x8000 && (isHiRomBuffer(b) || !isHiRomBuffer(b))) {
          detected = "sfc";
        }
      }

      if (!detected) {
        throw new Error("unknown_bytes");
      }

      this._system = detected;
    }
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
    if (this._system === "n64") {
      info.n64 = {
        name: this._name(),
        country: this._region(),
        version: this._rom.length > 0x3F ? this._rom[0x3F].toString() : undefined,
      };
    }
    this._info = info;

    this.name = this._name();
    this.gameid = this._gameid();
    this.region = this._region();
    this.gamecode = this._gamecode();
    this.cartridge = this._cartridge();

    this.emit("loaded", info);
  }

  get info(): RomInfo { return this._info; }
  get system(): SupportedSystem { return this._system; }
  get path(): string { return this._path; }
  get rom(): Buffer { return this._rom; }
}

export default Roomie;
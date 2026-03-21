import path from "node:path";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as AdmZip from "adm-zip";
// Handle ESM/CJS Interop for AdmZip
const Zip = (AdmZip as any).default || AdmZip;

import { regions } from "./tables/regions.js";
import { specs } from "./tables/specs.js";
import { hexEncode } from "./utils/stringHelper.js";
import { isHiRom, isHiRomBuffer } from "./systems/snes.js";
import { crc32 } from "./utils/crc32.js";
import type { SupportedSystem } from "./types.js";

export interface RomInfo {
  path: string;
  system: SupportedSystem;
  size: number;
  hash: { sha1: string; crc32: string };
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
  nes?: {
    version: "1.0" | "2.0";
    mapper: number;
    submapper?: number;
    prgRomSize: number;
    chrRomSize: number;
    prgRamSize?: number;
    prgNvramSize?: number;
    chrRamSize?: number;
    chrNvramSize?: number;
    timing?: string;
    consoleType?: string;
  };
  genesis?: {
    version?: string;
    serial?: string;
    region?: string;
    description?: string;
  };
  sms?: {
    version?: string;
    region?: string;
    serial?: string;
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

  constructor(path?: string) {
    super();
    if (path) this.load(path);
  }

  private detectSystemFromPath(p: string): SupportedSystem | false {
    const ext = p.toLowerCase().split(".").pop();
    if (ext === "nds") return "nds";
    if (ext === "gba") return "gba";
    if (ext === "gb" || ext === "gbc") return "gb";
    if (ext === "sfc" || ext === "smc") return "sfc";
    if (ext === "z64" || ext === "n64") return "n64";
    if (ext === "nes") return "nes";
    if (ext === "md" || ext === "gen" || ext === "smd") return "genesis";
    if (ext === "sms") return "sms";
    if (ext === "gg") return "gg";
    if (ext === "pce") return "pce";
    if (ext === "ws") return "ws";
    if (ext === "wsc") return "wsc";

    return false;
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
    } catch { }
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
      case "nes":
        if (this._rom.length >= 16) {
          const b = this._rom;
          const isNes2 = (b[7] & 0x0C) === 0x08;
          if (isNes2) {
            const timing = b[12] & 0x03;
            switch (timing) {
              case 0: return "NTSC";
              case 1: return "PAL";
              case 2: return "Multi-region";
              case 3: return "Dendy";
            }
          }
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
        case "nes":
          return "NES ROM";
        case "genesis":
          if (b.length >= 0x150) {
            return b.subarray(0x120, 0x150).toString("ascii").trim();
          }
          break;
        case "sms":
        case "gg":
          return "SEGA MASTER/GG ROM";
        case "ws":
        case "wsc":
          return "WONDERSWAN ROM";
      }
    } catch { }
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
    } catch { }
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

        // GBA Save Type identification (heuristic scanning)
        const saveTypePatterns = ["SRAM_V", "EEPROM_V", "FLASH_V", "FLASH512_V", "FLASH1M_V"];
        let saveType = "Unknown";
        const romStr = b.subarray(0, Math.min(b.length, 0x100000)).toString("ascii"); // Scan first 1MB
        for (const pattern of saveTypePatterns) {
          if (romStr.includes(pattern)) {
            saveType = pattern.split("_")[0];
            break;
          }
        }

        return {
          system: "gba",
          gameCode: code,
          region,
          saveType,
          size: b.length,
        };
      }
      case "gb": {
        const region = this._region();
        const mbcCode = b.length >= 0x148 ? b[0x147].toString(16).padStart(2, "0") : undefined;
        const mbc = mbcCode ? (specs as any).gb_mbc?.[mbcCode] : undefined;
        return {
          system: "gb",
          region,
          mbc,
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
      case "nes": {
        if (b.length < 16) return { system: "nes", size: b.length };
        const isNes2 = (b[7] & 0x0C) === 0x08;
        const mapper = isNes2
          ? (b[6] >> 4) | (b[7] & 0xF0) | ((b[8] & 0x0F) << 8)
          : (b[6] >> 4) | (b[7] & 0xF0);

        const nesInfo: any = {
          version: isNes2 ? "2.0" : "1.0",
          mapper,
          size: b.length
        };

        const getNesSize = (lsb: number, msbNibble: number, baseUnit: number) => {
          if (msbNibble === 0x0F) {
            const multiplier = (lsb & 0x03) * 2 + 1;
            const exponent = (lsb >> 2);
            return Math.pow(2, exponent) * multiplier;
          }
          return ((msbNibble << 8) | lsb) * baseUnit;
        };

        if (isNes2) {
          nesInfo.submapper = b[8] >> 4;
          nesInfo.prgRomSize = getNesSize(b[4], b[9] & 0x0F, 16384);
          nesInfo.chrRomSize = getNesSize(b[5], (b[9] >> 4) & 0x0F, 8192);

          const prgRamShift = b[10] & 0x0F;
          const prgNvramShift = (b[10] >> 4) & 0x0F;
          if (prgRamShift > 0) nesInfo.prgRamSize = 64 << prgRamShift;
          if (prgNvramShift > 0) nesInfo.prgNvramSize = 64 << prgNvramShift;

          const chrRamShift = b[11] & 0x0F;
          const chrNvramShift = (b[11] >> 4) & 0x0F;
          if (chrRamShift > 0) nesInfo.chrRamSize = 64 << chrRamShift;
          if (chrNvramShift > 0) nesInfo.chrNvramSize = 64 << chrNvramShift;

          const timingCodes = ["NTSC", "PAL", "Multi-region", "Dendy"];
          nesInfo.timing = timingCodes[b[12] & 0x03];

          const consoleTypes = ["NES/Famicom", "Vs. System", "PlayChoice-10", "Extended"];
          nesInfo.consoleType = consoleTypes[b[7] & 0x03];
          nesInfo.mapperName = (specs as any).nes?.mappers?.[mapper.toString()];
        } else {
          nesInfo.prgRomSize = b[4] * 16384;
          nesInfo.chrRomSize = b[5] * 8192;
          nesInfo.mapperName = (specs as any).nes?.mappers?.[mapper.toString()];
        }

        return {
          system: "nes",
          ...nesInfo
        };
      }
      case "genesis": {
        if (b.length < 0x200) return { system: "genesis", size: b.length };
        const region = b.subarray(0x1F0, 0x200).toString("ascii").trim();
        const serial = b.subarray(0x180, 0x18E).toString("ascii").trim();
        const overseasName = b.subarray(0x150, 0x180).toString("ascii").trim();
        return {
          system: "genesis",
          serial,
          region,
          overseasName,
          size: b.length
        };
      }
      case "sms":
      case "gg": {
        const off = b.length >= 0x8000 ? 0x7FF0 : (b.length >= 0x4000 ? 0x3FF0 : 0x1FF0);
        if (b.length < off + 16) return { system: this._system, size: b.length };
        const product = b.subarray(off + 12, off + 14).toString("hex");
        const regionByte = b[off + 15] >> 4;
        const region = regionByte >= 4 ? "Export" : "Japan";
        return {
          system: this._system,
          product,
          region,
          size: b.length
        };
      }
      case "ws":
      case "wsc": {
        if (b.length < 10) return { system: this._system, size: b.length };
        const off = b.length - 10;
        const publisher = b[off];
        const model = b[off + 1] === 0 ? "WS" : "WSC";
        const gameId = b[off + 2];
        const version = b[off + 3];
        const region = b[off + 4] === 0 ? "Japan" : "Export";
        return {
          system: this._system,
          publisher,
          model,
          gameId,
          version,
          region,
          size: b.length
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
    let b: Buffer;

    if (typeof pathOrBuffer === "string") {
      this._path = pathOrBuffer;
      const fileBuffer = await fs.readFile(pathOrBuffer);

      // Check if it's a ZIP by extension or magic
      if (pathOrBuffer.toLowerCase().endsWith(".zip") || (fileBuffer.length > 4 && fileBuffer.readUInt32BE(0) === 0x504B0304)) {
        const zip = new Zip(fileBuffer);
        const entries = zip.getEntries();
        // Look for the first entry that doesn't look like junk
        const romEntry = entries.find((e: any) => !e.isDirectory && !e.entryName.match(/\.(txt|jpg|png|xml|db|url)$|^\./i));

        if (!romEntry) throw new Error("no_rom_in_zip");
        b = zip.readFile(romEntry) as Buffer;
      } else {
        b = fileBuffer;
      }

      this._rom = b;
      const detected = this.detectSystemFromPath(pathOrBuffer);
      this._system = detected || "sfc"; // Fallback to be handled by buffer check if needed
    } else {
      this._path = "in-memory";
      // Check if buffer is a ZIP
      if (pathOrBuffer.length > 4 && pathOrBuffer.readUInt32BE(0) === 0x504B0304) {
        const zip = new Zip(pathOrBuffer);
        const entries = zip.getEntries();
        const romEntry = entries.find((e: any) => !e.isDirectory && !e.entryName.match(/\.(txt|jpg|png|xml|db|url)$|^\./i));
        if (!romEntry) throw new Error("no_rom_in_zip");
        b = zip.readFile(romEntry) as Buffer;
      } else {
        b = pathOrBuffer;
      }
      this._rom = b;
    }

    const romBuffer = this._rom;
    let detected: SupportedSystem | undefined = undefined;

    // Check system from bytes (more reliable than extension for ZIPs)
    // -------------------------------------------------------------

    // Check NDS: game code at 0x0C-0x10 ASCII uppercase letters/digits
    if (romBuffer.length >= 0x10) {
      const code = romBuffer.subarray(0x0C, 0x10).toString("ascii");
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

    // Check NES: starts with "NES\x1a"
    if (!detected && b.length >= 4) {
      if (b[0] === 0x4E && b[1] === 0x45 && b[2] === 0x53 && b[3] === 0x1A) {
        detected = "nes";
      }
    }

    // Check N64: ASCII text at 0x20-0x2E AND Magic Word at 0x00
    if (!detected && b.length >= 0x2F) {
      const magic = b.readUInt32BE(0);
      // Common N64 magic values (Big Endian, Byte Swapped, Little Endian)
      if (magic === 0x80371240 || magic === 0x37804012 || magic === 0x40123780) {
        detected = "n64";
      }
    }

    // Check SFC: verify checksum or markup before falling back
    if (!detected && b.length >= 0x8000) {
      if (isHiRomBuffer(b)) {
        detected = "sfc";
      } else {
        // LoROM check
        const titleOff = 0x7FC0;
        if (b.length > titleOff + 20) {
          const title = b.subarray(titleOff, titleOff + 20).toString('ascii');
          if (/^[\x20-\x7E\s]+$/.test(title) && title.trim().length > 0) {
            detected = "sfc";
          }
        }
      }
    }

    // Check Genesis: "SEGA" at 0x100
    if (!detected && b.length >= 0x104) {
      const magic = b.subarray(0x100, 0x104).toString("ascii");
      if (magic === "SEGA") {
        detected = "genesis";
      }
    }

    // Check SMS/GG: "TMR SEGA" at 0x7FF0, 0x3FF0 or 0x1FF0
    if (!detected) {
      for (const off of [0x7FF0, 0x3FF0, 0x1FF0]) {
        if (b.length >= off + 8 && b.subarray(off, off + 8).toString("ascii") === "TMR SEGA") {
          detected = b.length >= 0x8000 ? "sms" : "gg"; // Heuristic
          break;
        }
      }
    }

    // Check WSC: check model byte near end
    if (!detected && b.length >= 0x8000) {
      const off = b.length - 10;
      if (b[off + 1] === 0 || b[off + 1] === 1) { // 0=WS, 1=WSC
        // WSC check is a bit weak without developer ID check, but let's use it as heuristic
        // maybe only if extension also matches? 
      }
    }

    if (!detected) {
      throw new Error("unknown_bytes");
    }

    this._system = detected;

    const sha1 = createHash("sha1").update(this._rom).digest("hex");
    const crc = crc32(this._rom);
    const gameCode = this.readGameCode(this._system);
    const info: RomInfo = {
      path: this._path,
      system: this._system,
      size: this._rom.length,
      hash: { sha1, crc32: crc },
      gameCode,
      region: this.computeRegion(this._system, gameCode),
    };
    if (this._system === "sfc") {
      info.sfc = this.computeSfcInfo();
    } else if (this._system === "n64") {
      info.n64 = {
        name: this._name(),
        country: this._region(),
        version: this._rom.length > 0x3F ? this._rom[0x3F].toString() : undefined,
      };
    } else {
      // Generic assignment for new systems (nes, genesis, sms, gg, etc)
      const cart = this._cartridge();
      if (cart) {
        (info as any)[this._system] = cart;
      }
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

  public toJSON(): string {
    return JSON.stringify(this._info, null, 2);
  }

  public toGamelistXML(): string {
    const info = this._info;
    const name = this.name || path.basename(this._path);
    const cart: any = this.cartridge || {};

    let hardware = "None";
    if (cart.mapperName) hardware = `Mapper ${cart.mapper} (${cart.mapperName})`;
    else if (cart.mbc) hardware = `MBC (${cart.mbc})`;
    else if (cart.rom?.type) hardware = `Type (${cart.rom.type})`;
    else if (cart.saveType) hardware = `Save (${cart.saveType})`;

    return `<?xml version="1.0"?>
<gameList>
  <game>
    <path>${this._path}</path>
    <name>${name}</name>
    <desc>System: ${info.system}, Hardware: ${hardware}</desc>
    <hash>${info.hash.sha1}</hash>
    <crc32>${info.hash.crc32}</crc32>
  </game>
</gameList>`;
  }
}

export default Roomie;
import path from "node:path";
import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";

import { detectSystem, systemFromExtension } from "./core/detect.js";
import { computeHashInfo } from "./core/hash.js";
import { stripDumpHeader } from "./core/headers.js";
import { extractRomFromZip, isZipBuffer } from "./core/zip.js";
import { RoomieError } from "./errors.js";
import { toGamelistXML } from "./export/gamelist.js";
import { parseGenesis, genesisName, genesisRegion } from "./systems/genesis.js";
import { parseGb, gbName, gbRegion, gbGameCode } from "./systems/gb.js";
import { parseGba, gbaName, gbaRegion, gbaGameCode } from "./systems/gba.js";
import { parseN64, n64Name, n64Region, n64GameCode } from "./systems/n64.js";
import { parseNds, ndsName, ndsRegion, ndsGameCode, ndsGameId } from "./systems/nds.js";
import { parseNes, nesName, nesRegion } from "./systems/nes.js";
import { parsePce, pceName } from "./systems/pce.js";
import { parseSfc, sfcName, sfcRegion } from "./systems/sfc.js";
import { parseSms, smsName, smsRegion } from "./systems/sms.js";
import { parseWonderSwan, wsName, wsRegion } from "./systems/ws.js";
import type {
  HashInfo,
  LoadOptions,
  RomInfo,
  SupportedSystem,
} from "./types.js";

export type { RomInfo, LoadOptions, SupportedSystem, HashInfo } from "./types.js";
export { RoomieError } from "./errors.js";

export class Roomie extends EventEmitter {
  private _path = "";
  private _rom: Buffer = Buffer.alloc(0);
  private _system: SupportedSystem | undefined;
  private _info: RomInfo | undefined;
  private _loaded = false;

  /** @deprecated Prefer Roomie.open() — constructor no longer starts async load. */
  public name?: string;
  public gameid?: string;
  public region?: string;
  public gamecode?: string;
  public cartridge?: Record<string, unknown>;

  constructor() {
    super();
  }

  /**
   * Preferred entry: load a ROM from path or buffer and return a ready instance.
   * Supports plain ROMs and ZIP archives (best entry is selected by detection score).
   */
  static async open(
    pathOrBuffer: string | Buffer,
    options: LoadOptions = {}
  ): Promise<Roomie> {
    const r = new Roomie();
    await r.load(pathOrBuffer, options);
    return r;
  }

  /** Load many ROMs sequentially. Failures for individual paths reject that slot. */
  static async openMany(
    paths: string[],
    options: LoadOptions = {}
  ): Promise<Roomie[]> {
    const out: Roomie[] = [];
    for (const p of paths) {
      out.push(await Roomie.open(p, options));
    }
    return out;
  }

  /**
   * Load many ROMs; returns settled results so one failure does not abort the batch.
   */
  static async openManySettled(
    paths: string[],
    options: LoadOptions = {}
  ): Promise<PromiseSettledResult<Roomie>[]> {
    return Promise.allSettled(paths.map((p) => Roomie.open(p, options)));
  }

  async load(
    pathOrBuffer: string | Buffer,
    options: LoadOptions = {}
  ): Promise<this> {
    const doHash = options.hash !== false;
    const preferExtension = options.preferExtension !== false;

    let displayPath: string;
    let romBuffer: Buffer;

    if (typeof pathOrBuffer === "string") {
      displayPath = pathOrBuffer;
      let fileBuffer = await fs.readFile(pathOrBuffer);

      if (pathOrBuffer.toLowerCase().endsWith(".zip") || isZipBuffer(fileBuffer)) {
        const extracted = await extractRomFromZip(fileBuffer);
        romBuffer = extracted.buffer;
        // Keep original zip path for path field; use inner name for detection
        displayPath = pathOrBuffer;
        const detected = detectSystem(
          romBuffer,
          extracted.filename,
          preferExtension
        );
        if (!detected) {
          throw new RoomieError(
            "UNKNOWN_BYTES",
            "Could not identify ROM system from ZIP contents"
          );
        }
        this._path = pathOrBuffer;
        this._rom = romBuffer;
        this._system = detected.system;
        this.finishLoad(doHash, extracted.filename);
        return this;
      }

      romBuffer = fileBuffer;
      this._path = pathOrBuffer;
    } else if (Buffer.isBuffer(pathOrBuffer)) {
      displayPath = "in-memory";
      if (isZipBuffer(pathOrBuffer)) {
        const extracted = await extractRomFromZip(pathOrBuffer);
        romBuffer = extracted.buffer;
        this._path = displayPath;
        this._rom = romBuffer;
        const detected = detectSystem(
          romBuffer,
          extracted.filename,
          preferExtension
        );
        if (!detected) {
          throw new RoomieError(
            "UNKNOWN_BYTES",
            "Could not identify ROM system from ZIP contents"
          );
        }
        this._system = detected.system;
        this.finishLoad(doHash, extracted.filename);
        return this;
      }
      romBuffer = pathOrBuffer;
      this._path = displayPath;
    } else {
      throw new RoomieError(
        "INVALID_INPUT",
        "Invalid path or buffer provided to Roomie.load()"
      );
    }

    this._rom = romBuffer;

    const filenameForDetect =
      typeof pathOrBuffer === "string" ? pathOrBuffer : undefined;
    const detected = detectSystem(romBuffer, filenameForDetect, preferExtension);

    if (!detected) {
      const byExt = filenameForDetect
        ? systemFromExtension(filenameForDetect)
        : undefined;
      if (byExt) {
        this._system = byExt;
      } else {
        throw new RoomieError(
          "UNKNOWN_BYTES",
          "Bytes don't match any known system header"
        );
      }
    } else {
      this._system = detected.system;
    }

    this.finishLoad(doHash, filenameForDetect);
    return this;
  }

  private finishLoad(doHash: boolean, filenameHint?: string): void {
    const system = this._system!;
    const raw = this._rom;

    // System parsers handle their own header quirks (e.g. SMC strip for SFC).
    const systemInfo = this.parseSystem(system, raw);

    const name = this.resolveName(system, raw, systemInfo);
    const gameCode = this.resolveGameCode(system, raw, systemInfo);
    const gameId = this.resolveGameId(system, raw, gameCode);
    const region = this.resolveRegion(system, raw, systemInfo, gameCode);

    let hash: HashInfo;
    if (doHash) {
      const { payload, headerBytes } = stripDumpHeader(raw, system);
      hash = computeHashInfo(raw, payload, headerBytes);
    } else {
      hash = { sha1: "", md5: "", crc32: "" };
    }

    const cart = { system, ...systemInfo } as Record<string, unknown>;

    const info: RomInfo = {
      path: this._path,
      system,
      size: raw.length,
      hash,
      name,
      gameCode,
      gameId,
      region,
      cartridge: cart,
    };

    // Attach typed system block
    switch (system) {
      case "nes":
        info.nes = systemInfo as unknown as RomInfo["nes"];
        break;
      case "sfc":
        info.sfc = systemInfo as unknown as RomInfo["sfc"];
        break;
      case "n64":
        info.n64 = systemInfo as unknown as RomInfo["n64"];
        break;
      case "gb":
        info.gb = systemInfo as unknown as RomInfo["gb"];
        break;
      case "gbc":
        info.gbc = systemInfo as unknown as RomInfo["gbc"];
        break;
      case "gba":
        info.gba = systemInfo as unknown as RomInfo["gba"];
        break;
      case "nds":
        info.nds = systemInfo as unknown as RomInfo["nds"];
        break;
      case "genesis":
        info.genesis = systemInfo as unknown as RomInfo["genesis"];
        break;
      case "sms":
        info.sms = systemInfo as unknown as RomInfo["sms"];
        break;
      case "gg":
        info.gg = systemInfo as unknown as RomInfo["gg"];
        break;
      case "ws":
        info.ws = systemInfo as unknown as RomInfo["ws"];
        break;
      case "wsc":
        info.wsc = systemInfo as unknown as RomInfo["wsc"];
        break;
      case "pce":
        info.pce = systemInfo as unknown as RomInfo["pce"];
        break;
    }

    this._info = info;
    this._loaded = true;

    this.name = name;
    this.gameid = gameId;
    this.region = region;
    this.gamecode = gameCode;
    this.cartridge = cart;

    void filenameHint;
    this.emit("loaded", info);
  }

  private parseSystem(
    system: SupportedSystem,
    buf: Buffer
  ): Record<string, unknown> {
    switch (system) {
      case "nes":
        return parseNes(buf) as unknown as Record<string, unknown>;
      case "sfc":
        return parseSfc(buf) as unknown as Record<string, unknown>;
      case "n64":
        return parseN64(buf) as unknown as Record<string, unknown>;
      case "gb":
      case "gbc":
        return parseGb(buf) as unknown as Record<string, unknown>;
      case "gba":
        return parseGba(buf) as unknown as Record<string, unknown>;
      case "nds":
        return parseNds(buf) as unknown as Record<string, unknown>;
      case "genesis":
        return parseGenesis(buf) as unknown as Record<string, unknown>;
      case "sms":
        return parseSms(buf, "sms") as unknown as Record<string, unknown>;
      case "gg":
        return parseSms(buf, "gg") as unknown as Record<string, unknown>;
      case "ws":
      case "wsc":
        return parseWonderSwan(buf) as unknown as Record<string, unknown>;
      case "pce":
        return parsePce(buf) as unknown as Record<string, unknown>;
      default:
        return { size: buf.length };
    }
  }

  private resolveName(
    system: SupportedSystem,
    buf: Buffer,
    info: Record<string, unknown>
  ): string | undefined {
    switch (system) {
      case "nes":
        return nesName();
      case "sfc":
        return sfcName(buf) ?? (info.title as string | undefined);
      case "n64":
        return n64Name(buf);
      case "gb":
      case "gbc":
        return gbName(buf);
      case "gba":
        return gbaName(buf);
      case "nds":
        return ndsName(buf);
      case "genesis":
        return genesisName(buf);
      case "sms":
        return smsName("sms");
      case "gg":
        return smsName("gg");
      case "ws":
        return wsName("WS");
      case "wsc":
        return wsName("WSC");
      case "pce":
        return pceName();
      default:
        return undefined;
    }
  }

  private resolveGameCode(
    system: SupportedSystem,
    buf: Buffer,
    _info: Record<string, unknown>
  ): string | undefined {
    switch (system) {
      case "n64":
        return n64GameCode(buf);
      case "gb":
      case "gbc":
        return gbGameCode(buf);
      case "gba":
        return gbaGameCode(buf);
      case "nds":
        return ndsGameCode(buf);
      default:
        return undefined;
    }
  }

  private resolveGameId(
    system: SupportedSystem,
    buf: Buffer,
    gameCode?: string
  ): string | undefined {
    if (system === "nds") return ndsGameId(buf);
    if (system === "gba" && gameCode) return `AGB-${gameCode}`;
    return undefined;
  }

  private resolveRegion(
    system: SupportedSystem,
    buf: Buffer,
    info: Record<string, unknown>,
    _gameCode?: string
  ): string | undefined {
    switch (system) {
      case "nes":
        return nesRegion(buf);
      case "sfc":
        return sfcRegion(buf);
      case "n64":
        return n64Region(buf);
      case "gb":
      case "gbc":
        return gbRegion(buf);
      case "gba":
        return gbaRegion(buf);
      case "nds":
        return ndsRegion(buf);
      case "genesis":
        return genesisRegion(buf);
      case "sms":
      case "gg":
        return smsRegion(buf);
      case "ws":
      case "wsc":
        return wsRegion(buf);
      default:
        return typeof info.region === "string" ? info.region : undefined;
    }
  }

  private ensureLoaded(): void {
    if (!this._loaded || !this._info || !this._system) {
      throw new RoomieError(
        "NOT_LOADED",
        "ROM not loaded — call await roomie.load() or Roomie.open()"
      );
    }
  }

  get info(): RomInfo {
    this.ensureLoaded();
    return this._info!;
  }

  get system(): SupportedSystem {
    this.ensureLoaded();
    return this._system!;
  }

  get path(): string {
    this.ensureLoaded();
    return this._path;
  }

  get rom(): Buffer {
    this.ensureLoaded();
    return this._rom;
  }

  get hash(): HashInfo {
    this.ensureLoaded();
    return this._info!.hash;
  }

  get loaded(): boolean {
    return this._loaded;
  }

  public toJSON(): string {
    this.ensureLoaded();
    return JSON.stringify(this._info, null, 2);
  }

  public toGamelistXML(): string {
    this.ensureLoaded();
    return toGamelistXML({
      info: this._info!,
      name: this.name,
      path: this._path,
      cartridge: this.cartridge,
    });
  }
}

export default Roomie;

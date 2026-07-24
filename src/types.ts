export type SupportedSystem =
  | "nds"
  | "gba"
  | "gb"
  | "gbc"
  | "sfc"
  | "n64"
  | "nes"
  | "genesis"
  | "sms"
  | "gg"
  | "pce"
  | "ws"
  | "wsc";

export interface HashInfo {
  sha1: string;
  md5: string;
  crc32: string;
  /** Hashes after stripping known dump headers (iNES, SMC, etc.). */
  stripped?: {
    sha1: string;
    md5: string;
    crc32: string;
    headerBytes: number;
  };
}

export interface NesInfo {
  version: "1.0" | "2.0";
  mapper: number;
  mapperName?: string;
  submapper?: number;
  prgRomSize: number;
  chrRomSize: number;
  prgRamSize?: number;
  prgNvramSize?: number;
  chrRamSize?: number;
  chrNvramSize?: number;
  timing?: string;
  consoleType?: string;
  mirroring?: string;
  hasBattery?: boolean;
  hasTrainer?: boolean;
  headerBytes: number;
  size: number;
}

export interface SfcInfo {
  romSpeed?: string;
  rom?: { size?: number; type?: string; speed?: string };
  ram?: number;
  hardware?: {
    coprocessor?: string | false;
    rom?: boolean;
    ram?: boolean;
    battery?: boolean;
  };
  title?: string;
  headerOffset: number;
  smcHeaderBytes: number;
  size: number;
}

export interface N64Info {
  name?: string;
  country?: string;
  version?: string;
  gameCode?: string;
  endian: "z64" | "v64" | "n64" | "unknown";
  size: number;
}

export interface GbInfo {
  title?: string;
  manufacturerCode?: string;
  cgbFlag?: number;
  sgbFlag?: number;
  mbc?: string;
  mbcCode?: string;
  romSize?: number;
  ramSize?: number;
  region?: string;
  isColor: boolean;
  size: number;
}

export interface GbaInfo {
  title?: string;
  gameCode?: string;
  makerCode?: string;
  region?: string;
  saveType: string;
  size: number;
}

export interface NdsInfo {
  title?: string;
  gameCode?: string;
  makerCode?: string;
  region?: string;
  unitCode?: string;
  unitCodeRaw?: number;
  deviceCapacity?: number;
  deviceCapacityBytes?: number;
  romVersion?: number;
  size: number;
}

export interface GenesisInfo {
  systemType?: string;
  copyright?: string;
  domesticName?: string;
  overseasName?: string;
  serial?: string;
  region?: string;
  size: number;
}

export interface SmsInfo {
  product?: string;
  version?: number;
  region?: string;
  headerOffset: number;
  size: number;
}

export interface WonderSwanInfo {
  publisher?: number;
  model: "WS" | "WSC";
  gameId?: number;
  version?: number;
  region?: string;
  size: number;
}

export interface PceInfo {
  /** PCE/TG-16 has no standard internal header; identification is heuristic. */
  size: number;
  note?: string;
}

export interface RomInfoBase {
  path: string;
  system: SupportedSystem;
  size: number;
  hash: HashInfo;
  name?: string;
  gameCode?: string;
  gameId?: string;
  region?: string;
}

export type RomInfo = RomInfoBase & {
  nes?: NesInfo;
  sfc?: SfcInfo;
  n64?: N64Info;
  gb?: GbInfo;
  gbc?: GbInfo;
  gba?: GbaInfo;
  nds?: NdsInfo;
  genesis?: GenesisInfo;
  sms?: SmsInfo;
  gg?: SmsInfo;
  ws?: WonderSwanInfo;
  wsc?: WonderSwanInfo;
  pce?: PceInfo;
  /** Alias of the system-specific block for convenient access. */
  cartridge?: Record<string, unknown>;
};

export interface LoadOptions {
  /** Compute hashes (default: true). */
  hash?: boolean;
  /** When true, extension can break detection ties. */
  preferExtension?: boolean;
}

export interface DetectResult {
  system: SupportedSystem;
  score: number;
}

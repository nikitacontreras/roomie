import { specs } from "../tables/specs.js";
import type { DetectResult, NesInfo } from "../types.js";

export function scoreNes(buf: Buffer): DetectResult | null {
  if (buf.length < 16) return null;
  if (buf[0] === 0x4e && buf[1] === 0x45 && buf[2] === 0x53 && buf[3] === 0x1a) {
    return { system: "nes", score: 100 };
  }
  return null;
}

function getNesSize(lsb: number, msbNibble: number, baseUnit: number): number {
  if (msbNibble === 0x0f) {
    const multiplier = (lsb & 0x03) * 2 + 1;
    const exponent = lsb >> 2;
    return Math.pow(2, exponent) * multiplier;
  }
  return ((msbNibble << 8) | lsb) * baseUnit;
}

export function parseNes(buf: Buffer): NesInfo {
  if (buf.length < 16) {
    return {
      version: "1.0",
      mapper: 0,
      prgRomSize: 0,
      chrRomSize: 0,
      headerBytes: 0,
      size: buf.length,
    };
  }

  const isNes2 = (buf[7] & 0x0c) === 0x08;
  const mapper = isNes2
    ? (buf[6] >> 4) | (buf[7] & 0xf0) | ((buf[8] & 0x0f) << 8)
    : (buf[6] >> 4) | (buf[7] & 0xf0);

  const hasTrainer = (buf[6] & 0x04) !== 0;
  const hasBattery = (buf[6] & 0x02) !== 0;
  const mirroring =
    buf[6] & 0x08 ? "four-screen" : buf[6] & 0x01 ? "vertical" : "horizontal";

  const headerBytes = 16 + (hasTrainer ? 512 : 0);
  const mapperName = specs.nes.mappers[mapper.toString()];

  const info: NesInfo = {
    version: isNes2 ? "2.0" : "1.0",
    mapper,
    mapperName,
    prgRomSize: 0,
    chrRomSize: 0,
    mirroring,
    hasBattery,
    hasTrainer,
    headerBytes,
    size: buf.length,
  };

  if (isNes2) {
    info.submapper = buf[8] >> 4;
    info.prgRomSize = getNesSize(buf[4], buf[9] & 0x0f, 16384);
    info.chrRomSize = getNesSize(buf[5], (buf[9] >> 4) & 0x0f, 8192);

    const prgRamShift = buf[10] & 0x0f;
    const prgNvramShift = (buf[10] >> 4) & 0x0f;
    if (prgRamShift > 0) info.prgRamSize = 64 << prgRamShift;
    if (prgNvramShift > 0) info.prgNvramSize = 64 << prgNvramShift;

    const chrRamShift = buf[11] & 0x0f;
    const chrNvramShift = (buf[11] >> 4) & 0x0f;
    if (chrRamShift > 0) info.chrRamSize = 64 << chrRamShift;
    if (chrNvramShift > 0) info.chrNvramSize = 64 << chrNvramShift;

    const timingCodes = ["NTSC", "PAL", "Multi-region", "Dendy"];
    info.timing = timingCodes[buf[12] & 0x03];

    const consoleTypes = ["NES/Famicom", "Vs. System", "PlayChoice-10", "Extended"];
    info.consoleType = consoleTypes[buf[7] & 0x03];
  } else {
    info.prgRomSize = buf[4] * 16384;
    info.chrRomSize = buf[5] * 8192;
  }

  return info;
}

export function nesRegion(buf: Buffer): string | undefined {
  if (buf.length < 16) return undefined;
  const isNes2 = (buf[7] & 0x0c) === 0x08;
  if (!isNes2) return undefined;
  const timing = buf[12] & 0x03;
  switch (timing) {
    case 0:
      return "NTSC";
    case 1:
      return "PAL";
    case 2:
      return "Multi-region";
    case 3:
      return "Dendy";
    default:
      return undefined;
  }
}

export function nesName(): string {
  return "NES ROM";
}

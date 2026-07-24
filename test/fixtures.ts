/**
 * Synthetic ROM-like buffers for unit tests (not real game dumps).
 */

/** Minimal iNES 1.0 header: NROM, 1x16K PRG, 1x8K CHR */
export function makeNesINes(): Buffer {
  const buf = Buffer.alloc(16 + 16384 + 8192, 0);
  buf[0] = 0x4e;
  buf[1] = 0x45;
  buf[2] = 0x53;
  buf[3] = 0x1a;
  buf[4] = 1; // PRG banks
  buf[5] = 1; // CHR banks
  buf[6] = 0x00;
  buf[7] = 0x00;
  return buf;
}

/** NES 2.0 header with mapper 4 (MMC3), PAL timing */
export function makeNes2(): Buffer {
  const buf = Buffer.alloc(16 + 32768 + 8192, 0);
  buf[0] = 0x4e;
  buf[1] = 0x45;
  buf[2] = 0x53;
  buf[3] = 0x1a;
  buf[4] = 2;
  buf[5] = 1;
  buf[6] = 0x40; // mapper low nibble 4
  buf[7] = 0x08; // NES 2.0 identifier
  buf[8] = 0x00;
  buf[9] = 0x00;
  buf[12] = 0x01; // PAL
  return buf;
}

/** Minimal LoROM-like SNES image with valid checksum pair and title */
export function makeSnesLoRom(opts?: { romSizeExp?: number; ramSizeExp?: number }): Buffer {
  const size = 0x8000; // 32 KiB minimum for LoROM header at 0x7FC0
  const buf = Buffer.alloc(size, 0);
  const base = 0x7fc0;
  const title = "TEST GAME             "; // 21 chars
  buf.write(title.slice(0, 21), base, "ascii");
  buf[base + 0x15] = 0x20; // LoROM map mode
  buf[base + 0x16] = 0x02; // ROM+RAM+battery
  buf[base + 0x17] = opts?.romSizeExp ?? 0x09; // 2^9 KB = 512 KB
  buf[base + 0x18] = opts?.ramSizeExp ?? 0x03; // 2^3 KB = 8 KB
  buf[base + 0x19] = 0x01; // region Americas
  // Checksum pair summing to 0xFFFF
  buf.writeUInt16LE(0x1234, base + 0x1c);
  buf.writeUInt16LE(0xedcb, base + 0x1e); // 0x1234 + 0xEDCB = 0xFFFF
  // Reset vector-ish
  buf.writeUInt16LE(0x8000, base + 0x3c);
  return buf;
}

/** SNES dump with 512-byte SMC header */
export function makeSnesWithSmc(): Buffer {
  const body = makeSnesLoRom();
  return Buffer.concat([Buffer.alloc(512, 0xaa), body]);
}

/** N64 z64 (big-endian) header stub */
export function makeN64Z64(): Buffer {
  const buf = Buffer.alloc(0x1000, 0);
  buf.writeUInt32BE(0x80371240, 0);
  buf.write("SMASH BROS           ", 0x20, "ascii");
  buf.write("NSME", 0x3b, "ascii"); // USA
  buf[0x3f] = 0x00;
  return buf;
}

/** N64 v64 (byte-swapped) of the same header */
export function makeN64V64(): Buffer {
  const z64 = makeN64Z64();
  const v64 = Buffer.alloc(z64.length);
  for (let i = 0; i < z64.length; i += 2) {
    v64[i] = z64[i + 1];
    v64[i + 1] = z64[i];
  }
  return v64;
}

/** GB ROM with Nintendo logo prefix + valid header checksum */
export function makeGb(opts?: { cgb?: number }): Buffer {
  const buf = Buffer.alloc(0x8000, 0);
  // Logo start
  Buffer.from([0xce, 0xed, 0x66, 0x66, 0xcc, 0x0d, 0x00, 0x0b]).copy(buf, 0x104);
  buf.write("TESTGB", 0x134, "ascii");
  buf[0x143] = opts?.cgb ?? 0x00;
  buf[0x147] = 0x01; // MBC1
  buf[0x148] = 0x00; // 32KB
  buf[0x149] = 0x00;
  buf[0x14a] = 0x01; // overseas
  // Header checksum 0x134–0x14C
  let x = 0;
  for (let i = 0x134; i <= 0x14c; i++) {
    x = (x - buf[i] - 1) & 0xff;
  }
  buf[0x14d] = x;
  return buf;
}

/** GBA header with logo start + 0x96 marker */
export function makeGba(): Buffer {
  const buf = Buffer.alloc(0x200, 0);
  buf[0] = 0x00;
  buf[1] = 0x00;
  buf[2] = 0x00;
  buf[3] = 0xea; // branch
  Buffer.from([0x24, 0xff, 0xae, 0x51, 0x69, 0x9a]).copy(buf, 0x04);
  buf.write("TESTGBA GAME", 0xa0, "ascii");
  buf.write("ATGE", 0xac, "ascii"); // game code, E = english
  buf.write("01", 0xb0, "ascii");
  buf[0xb2] = 0x96;
  // Embed save type marker
  buf.write("SRAM_V123", 0x100, "ascii");
  return buf;
}

/** NDS header with logo CRC 0xCF56 */
export function makeNds(): Buffer {
  const buf = Buffer.alloc(0x400, 0);
  buf.write("TESTNDS GAME", 0x0, "ascii");
  buf.write("ATDE", 0x0c, "ascii");
  buf.write("01", 0x10, "ascii");
  buf[0x12] = 0x00; // NDS
  buf[0x14] = 0x06; // capacity
  buf.writeUInt32LE(0x4000, 0x20); // ARM9 offset
  buf.writeUInt16LE(0xcf56, 0x15c);
  return buf;
}

/** Genesis / Mega Drive header */
export function makeGenesis(): Buffer {
  const buf = Buffer.alloc(0x200, 0);
  buf.write("SEGA MEGA DRIVE ", 0x100, "ascii");
  buf.write("(C)TEST 2024    ", 0x110, "ascii");
  buf.write("DOMESTIC NAME".padEnd(48, " "), 0x120, "ascii");
  buf.write("OVERSEAS NAME".padEnd(48, " "), 0x150, "ascii");
  buf.write("GM 00000000-00", 0x180, "ascii");
  buf.write("JUE", 0x1f0, "ascii");
  return buf;
}

/** SMS with TMR SEGA at 0x7FF0 */
export function makeSms(): Buffer {
  const buf = Buffer.alloc(0x8000, 0);
  const off = 0x7ff0;
  buf.write("TMR SEGA", off, "ascii");
  buf[off + 12] = 0x00;
  buf[off + 13] = 0x00;
  buf[off + 14] = 0x00;
  buf[off + 15] = 0x40; // Export SMS (region nibble 4)
  return buf;
}

/** WonderSwan stub with model + checksum */
export function makeWonderSwan(color = false): Buffer {
  const size = 0x10000;
  const buf = Buffer.alloc(size, 0x11);
  const off = size - 10;
  buf[off] = 0x01; // publisher
  buf[off + 1] = color ? 1 : 0;
  buf[off + 2] = 0x10; // game id
  buf[off + 3] = 0x00;
  buf[off + 4] = 0x03; // rom size code
  buf[off + 5] = 0x00;
  buf[off + 6] = 0x00; // Japan
  // Checksum over all but last 2 bytes
  let sum = 0;
  for (let i = 0; i < size - 2; i++) sum = (sum + buf[i]) & 0xffff;
  buf.writeUInt16LE(sum, size - 2);
  return buf;
}

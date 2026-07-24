# roomie

![GitHub Sponsors](https://img.shields.io/github/sponsors/nikitacontreras?style=flat-square&label=sponsor%20me&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fnikitacontreras) ![NPM Version](https://img.shields.io/npm/v/roomie?style=flat-square)

---

## Introduction

**roomie** is a lightweight library for extracting metadata from ROM files of classic gaming consoles. It supports multiple systems, handles **NES 2.0** headers, calculates **CRC32**, **MD5**, and **SHA1** hashes (including header-stripped hashes), and can read ROMs directly from **ZIP** archives.

Designed for simplicity and accuracy, **roomie** identifies systems via header magic / scoring and optional file extensions, and provides details about mappers, co-processors, regions, and save types.

> **Runtime:** Node.js ≥ 18 (uses `node:fs`, `node:crypto`, and `Buffer`).

---

## Features

- **ZIP Support**: Loads ROMs from `.zip` files and picks the best entry by detection score.
- **Hardware Detection**: NES mappers, GB MBCs, SNES co-processors, GBA save types, NDS unit/capacity.
- **NES 2.0**: Full support for modern NES header fields.
- **Hashing**: SHA1, MD5, CRC32 — plus optional hashes with dump headers stripped (iNES, SMC).
- **Exports**: JSON and EmulationStation-compatible `gamelist.xml` (XML-escaped).
- **Typed API**: Per-system info blocks on `RomInfo`.

---

## Installation

```bash
npm install roomie
```

---

## Usage

Supports both **ESM** and **CommonJS**.

### Preferred: `Roomie.open`

```ts
import Roomie from "roomie";

const roomie = await Roomie.open("./Super Mario World.sfc");

console.log(roomie.system); // "sfc"
console.log(roomie.name);
console.log(roomie.hash);   // { sha1, md5, crc32, stripped? }
console.log(roomie.info);   // full RomInfo

// EmulationStation gamelist fragment
console.log(roomie.toGamelistXML());
```

### Options

```ts
// Skip hashing for speed
await Roomie.open(buf, { hash: false });

// Batch
const roms = await Roomie.openMany(["./a.nes", "./b.gba"]);

// Batch without failing the whole list
const settled = await Roomie.openManySettled(["./a.nes", "./missing.nes"]);
```

### Instance `load`

```ts
const roomie = new Roomie();
await roomie.load("./game.zip");
```

### From a Buffer

```ts
import { readFile } from "node:fs/promises";

const buf = await readFile("./game.nes");
const roomie = await Roomie.open(buf);
```

---

## Supported Consoles

| Console | System Key | Description |
|---------|------------|-------------|
| **NES / Famicom** | `nes` | iNES & **NES 2.0**. Mapper, PRG/CHR, timing. |
| **Super Nintendo** | `sfc` | LoROM/HiROM, co-processors, correct ROM/RAM sizes, SMC strip. |
| **Nintendo 64** | `n64` | Header parse with **z64 / v64 / n64** endian support. |
| **Game Boy** | `gb` | MBC, ROM/RAM sizes, region. |
| **Game Boy Color** | `gbc` | Same as GB with CGB flag detection. |
| **Game Boy Advance** | `gba` | Game ID, region, save type (SRAM/Flash/EEPROM). |
| **Nintendo DS** | `nds` | Game code, region, unit code (DSi), device capacity. |
| **Sega Genesis** | `genesis` | Domestic/overseas names, serial, regions. |
| **Master System / GG** | `sms` / `gg` | `TMR SEGA` header, product code, region. |
| **WonderSwan / Color** | `ws` / `wsc` | End-of-ROM header, model, checksum score. |
| **PC Engine** | `pce` | Extension / size heuristics (no standard header). |

---

## API Reference

### Static methods

| Method | Description |
|--------|-------------|
| `Roomie.open(path \| Buffer, options?)` | Load and return a ready instance. |
| `Roomie.openMany(paths, options?)` | Load many paths (rejects on first error). |
| `Roomie.openManySettled(paths, options?)` | `Promise.allSettled` style batch. |

### Instance methods

| Method | Description |
|--------|-------------|
| `await load(path \| Buffer, options?)` | Load into this instance. |
| `toJSON()` | Pretty-printed `RomInfo` JSON. |
| `toGamelistXML()` | EmulationStation-compatible XML (escaped). |

### Properties

| Property | Description |
|----------|-------------|
| `info` | Full `RomInfo` (typed per-system blocks: `info.nes`, `info.sfc`, …). |
| `system` | Detected system key. |
| `hash` | `{ sha1, md5, crc32, stripped? }`. |
| `path` | Source path or `"in-memory"`. |
| `rom` | Raw ROM `Buffer`. |
| `name` / `region` / `gamecode` / `gameid` / `cartridge` | Convenience mirrors of `info`. |
| `loaded` | Whether a ROM has been loaded. |

### `LoadOptions`

```ts
{
  hash?: boolean;             // default true
  preferExtension?: boolean;  // default true — extension boosts detection ties
}
```

### Errors

Throws `RoomieError` with a `code`:

| Code | Meaning |
|------|---------|
| `UNKNOWN_BYTES` | No known system header / detection failed. |
| `NO_ROM_IN_ZIP` | ZIP has no usable ROM entry. |
| `INVALID_INPUT` | Not a path string or Buffer. |
| `NOT_LOADED` | Accessed `info` / `system` before load. |

Legacy string-style messages still appear in `error.message` for readability.

---

## Development

```bash
npm install
npm test
npm run build
npm run typecheck
```

Tests use synthetic header fixtures only (no copyrighted ROMs).

---

## License

MIT

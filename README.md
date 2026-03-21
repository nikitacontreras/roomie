# roomie

![GitHub Sponsors](https://img.shields.io/github/sponsors/nikitacontreras?style=flat-square&label=sponsor%20me&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fnikitacontreras) ![NPM Version](https://img.shields.io/npm/v/roomie?style=flat-square)

---

## Introduction

**roomie** is a powerful and lightweight library for extracting metadata from ROM files of classic gaming consoles. It supports multiple systems, handles **NES 2.0** headers, calculates **CRC32** and **SHA1** hashes, and can even read ROMs directly from **ZIP** archives.

Designed for simplicity and accuracy, **roomie** identifies systems via header magic words or file extensions and provides detailed information about mappers, co-processors, regions, and save types.

---

## Features

- **ZIP Support**: Load ROMs directly from `.zip` files.
- **Hardware Detection**: Identifies NES Mappers, GB MBCs, SNES Co-processors, and GBA Save types.
- **NES 2.0**: Full support for modern NES header specifications.
- **Hashing**: Built-in SHA1 and CRC32 calculation.
- **Exports**: Generate `JSON` or `Gamelist XML` (EmulationStation compatible) strings.

---

## Installation

Install via npm:

```bash
npm install roomie
```

---

## Usage

**roomie** supports both CommonJS (CJS) and ES Modules (ESM).

### Basic Example (Async/Await)

```ts
import Roomie from "roomie";

const roomie = new Roomie();

// Load from a file path (supports .zip)
await roomie.load("./Super Mario World.zip");

console.log(roomie.info);
/*
{
  system: 'sfc',
  hash: { sha1: '...', crc32: 'b19ed489' },
  sfc: { rom: { type: 'LoROM', size: 2048000 }, ram: 8000 },
  ...
}
*/

// Export to EmulationStation gamelist format
console.log(roomie.toGamelistXML());
```

---

## Supported Consoles

| Console | System Key | Description |
|---------|------------|-------------|
| **NES / Famicom** | `nes` | iNES & **NES 2.0** support. Detects Mappers (MMC1, MMC3, etc). |
| **Super Nintendo** | `sfc` | Detects LoROM/HiROM, Co-processors (SuperFX, SA-1, DSP). |
| **Nintendo 64** | `n64` | Header parsing, region detection, and byte-swapping support. |
| **Game Boy / Color** | `gb` | Detects MBC types, RAM size, and GBC/SGB features. |
| **Game Boy Advance** | `gba` | Extract Game ID and identifies Save Type (SRAM/Flash/EEPROM). |
| **Nintendo DS** | `nds` | Game code, region, unit code (DSi), and device capacity. |
| **Sega Genesis** | `genesis` | Reads Domestic/Overseas names, serials, and regions. |
| **Master System / GG** | `sms` / `gg` | Header detection (TMR SEGA), product code, and region. |
| **WonderSwan / Color** | `ws` / `wsc` | End-of-ROM header parsing for game ID and model. |
| **PC Engine** | `pce` | Basic identification for TurboGrafx-16 systems. |

---

## API Reference

### Methods

- **`await load(pathOrBuffer: string | Buffer)`**: Loads a ROM. If it's a ZIP, it extracts the first ROM entry.
- **`toJSON(): string`**: Returns the `RomInfo` object as a formatted JSON string.
- **`toGamelistXML(): string`**: Returns an XML string compatible with EmulationStation's `gamelist.xml`.

### Properties

- **`info: RomInfo`**: Comprehensive metadata object.
- **`system: string`**: The detected system key (e.g., `"sfc"`, `"nes"`).
- **`hash: { sha1, crc32 }`**: Calculated hashes of the ROM (excluding ZIP overhead).
- **`cartridge`**: System-specific details (Mappers, MBC, Save Types).

---

## Error Handling

- `unknown_file`: System extension not supported.
- `unknown_bytes`: Bytes don't match any known system header.
- `no_rom_in_zip`: ZIP file loaded but no valid ROM found inside.

---

## License

MIT

# roomie

![GitHub Sponsors](https://img.shields.io/github/sponsors/nikitacontreras?style=flat-square&label=sponsor%20me&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fnikitacontreras) ![NPM Version](https://img.shields.io/npm/v/roomie?style=flat-square)

---

## Introduction

**roomie** is a lightweight library for extracting metadata from ROM files of classic gaming consoles. It supports multiple systems and provides detailed information such as game title, region, game code, ROM and RAM sizes, version, and other console-specific data. Designed for simplicity and accuracy, roomie aids developers and enthusiasts in analyzing ROM files programmatically.

---

## Installation

Install via npm:

```bash
npm install roomie
```

---

## Usage

roomie supports both CommonJS (CJS) and ES Modules (ESM) import styles.

### CommonJS (CJS)

```js
const Roomie = require("roomie");

const romPath = "/path/to/game.sfc";
const roomie = new Roomie(romPath);

roomie.on("loaded", (info) => {
  console.log("ROM Information:", info);
});
```

### ES Modules (ESM)

```ts
import Roomie from "roomie";

const romPath = "/path/to/game.sfc";
const roomie = new Roomie(romPath);

roomie.on("loaded", (info) => {
  console.log("ROM Information:", info);
});

await roomie.load(romPath); // Load ROM from file path

const romBuffer = Buffer.from([...]); // Load ROM from a Buffer
await roomie.load(romBuffer);

console.log(roomie.info);
```

---

## Supported Consoles

| Console                     | Description                                                   |
|-----------------------------|---------------------------------------------------------------|
| **Nintendo DS (NDS)**        | Extracts game name, region, game code, ROM/RAM size, version, and other metadata. |
| **Game Boy Advance (GBA)**   | Provides title, game code, region, ROM/RAM size, version, and related info.       |
| **Game Boy (GB)**            | Retrieves title, cartridge type, ROM/RAM size, and additional metadata.          |
| **Super Nintendo / Super Famicom (SNES/SFC)** | Detects ROM type (HiROM/LoROM), game name, region, code, ROM size, and console-specific fields. |
| **Nintendo 64 (N64)**        | Extracts the game title (byte-swapped), ROM hash, and region information.         |

---

## API Reference

### Constructor

```ts
new Roomie(pathOrBuffer: string | Buffer)
```

Creates a new Roomie instance and immediately loads the ROM from the given file path or Buffer. Emits the `'loaded'` event once metadata extraction is complete.

### Methods

```ts
await roomie.load(pathOrBuffer: string | Buffer): Promise<void>
```

Loads or reloads a ROM from a file path or Buffer, emitting `'loaded'` on success.

### Properties

- `roomie.info: RomInfo` – Object containing extracted ROM metadata.
- `roomie.rom: Buffer` – Raw bytes of the loaded ROM.
- `roomie.system: "nds" | "gba" | "gb" | "sfc" | "n64"` – Detected console system.

### Events

- `'loaded'` – Emitted when ROM metadata is successfully loaded and parsed. The listener receives the `info` object.

### Example JSON Output

```json
{
  "system": "gba",
  "title": "METROID FUSION",
  "gameCode": "AGB-AMME",
  "region": "USA",
  "romSize": 2097152,
  "ramSize": 32768,
  "version": 1,
  "checksum": "0x1234"
}
```

---

## Error Handling

If the ROM cannot be identified, the library throws errors with codes:

- `unknown_file` – When loading from a file path and the system is unrecognized.
- `unknown_bytes` – When loading from a Buffer and the system is unrecognized.

---

## License

MIT

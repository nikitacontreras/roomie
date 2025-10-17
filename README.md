# roomie

![GitHub Sponsors](https://img.shields.io/github/sponsors/nikitacontreras?style=flat-square&label=sponsor%20me&link=https%3A%2F%2Fgithub.com%2Fsponsors%2Fnikitacontreras) ![NPM Version](https://img.shields.io/npm/v/roomie?style=flat-square)



Roomie is a library for analyzing basic metadata of ROM files from various classic consoles. It allows extracting relevant information such as the game name, region, code, ROM and RAM size, version, and other console-specific data.

## Installation

```bash
npm install roomie
```

## Usage

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

## Supported Consoles

Roomie supports metadata extraction from the following systems:

- **Nintendo DS (NDS):** Retrieves data such as the game name, region, game code, ROM and RAM size, version, among others.
- **Game Boy Advance (GBA):** Extracts information about the title, game code, region, ROM and RAM size, version, etc.
- **Game Boy (GB):** Provides details about the title, cartridge type, ROM and RAM size, and other metadata.
- **Super Nintendo / Super Famicom (SNES/SFC):** Detects the ROM type (HiROM/LoROM), game name, region, code, ROM size, and other specific fields.

## API

- `new Roomie(path: string | Buffer)` – Creates an instance and immediately loads the specified ROM file or buffer. Emits the `'loaded'` event when the information is available.
- `await roomie.load(pathOrBuffer: string | Buffer)` – Loads or reloads a different ROM file from a file path or a Buffer.
- `roomie.info: RomInfo` – Object with the analyzed ROM metadata, including system, size, game code, region, and other specific fields.
- `roomie.rom: Buffer` – Contains the raw bytes of the loaded ROM file.
- `roomie.system: "nds" | "gba" | "gb" | "sfc"` – Detected system based on the file extension and content.

If the system cannot be identified, the library throws errors with codes `unknown_file` (when loading from a path) or `unknown_bytes` (when loading from a Buffer).

## License

MIT

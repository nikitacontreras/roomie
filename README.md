# roomie (refactor)

TypeScript-first refactor of the original **roomie** library. It parses basic metadata from ROM files for a few systems (NDS, GBA, GB, SNES/SFC).

> This is a conservative refactor: no prototype pollution, strong typing, and clear APIs. The SNES header detection uses a simple heuristic and can be improved later.

## Install

```bash
npm i roomie
```

## Usage

```ts
import Roomie from "roomie";

const r = new Roomie("/path/to/game.sfc");
r.on("loaded", (info) => console.log(info));

await r.load("/path/to/game.sfc"); // or construct with path and wait for 'loaded'
console.log(r.info);
```

### API

- `new Roomie(path: string)` – constructs and immediately loads the ROM file (emits `'loaded'`).
- `await roomie.load(path: string)` – reload another file.
- `roomie.info: RomInfo` – parsed metadata (system, size, sha1, gameCode, region, and SFC fields when applicable).
- `roomie.rom: Buffer` – raw bytes.
- `roomie.system: "nds" | "gba" | "gb" | "sfc"` – detected system (by file extension for now).

### Notes

- **SNES HiROM/LoROM**: detection is heuristic. If you have a better strategy (e.g., checksum/compl. validation), PRs welcome.
- **Regions/specs** tables are auto-generated from the original JS to keep behavior and coverage.

## Scripts

- `npm run build` – typecheck, emit ESM to `dist`, then produce `index.mjs` and a CJS shim.
- `npm run typecheck` – TypeScript type check.
- `npm run clean` – remove `dist`.

## License

MIT

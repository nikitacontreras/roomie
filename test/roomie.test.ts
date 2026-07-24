import { describe, it } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import Roomie, { RoomieError, crc32, detectSystem, stripDumpHeader } from "../src/index.js";
import { romSizeBytes, ramSizeBytes } from "../src/systems/sfc.js";
import {
  makeNesINes,
  makeNes2,
  makeSnesLoRom,
  makeSnesWithSmc,
  makeN64Z64,
  makeN64V64,
  makeGb,
  makeGba,
  makeNds,
  makeGenesis,
  makeSms,
  makeWonderSwan,
} from "./fixtures.js";

describe("crc32", () => {
  it("is stable and cached", () => {
    const a = crc32(Buffer.from("123456789"));
    const b = crc32(Buffer.from("123456789"));
    assert.equal(a, b);
    // Known CRC32 of "123456789"
    assert.equal(a, "cbf43926");
  });
});

describe("SNES size helpers", () => {
  it("computes ROM/RAM sizes as 2^N kilobytes", () => {
    assert.equal(romSizeBytes(0x09), 512 * 1024);
    assert.equal(romSizeBytes(0x0b), 2048 * 1024);
    assert.equal(ramSizeBytes(0x03), 8 * 1024);
    assert.equal(ramSizeBytes(0), 0);
  });
});

describe("Roomie.open NES", () => {
  it("parses iNES 1.0", async () => {
    const r = await Roomie.open(makeNesINes());
    assert.equal(r.system, "nes");
    assert.equal(r.info.nes?.version, "1.0");
    assert.equal(r.info.nes?.prgRomSize, 16384);
    assert.equal(r.info.nes?.chrRomSize, 8192);
    assert.ok(r.hash.sha1.length === 40);
    assert.ok(r.hash.md5.length === 32);
    assert.ok(r.hash.crc32.length === 8);
    assert.ok(r.hash.stripped);
    assert.equal(r.hash.stripped?.headerBytes, 16);
  });

  it("parses NES 2.0 mapper and timing", async () => {
    const r = await Roomie.open(makeNes2());
    assert.equal(r.info.nes?.version, "2.0");
    assert.equal(r.info.nes?.mapper, 4);
    assert.equal(r.info.nes?.mapperName, "MMC3");
    assert.equal(r.region, "PAL");
  });
});

describe("Roomie.open SFC", () => {
  it("parses LoROM title, sizes, and region", async () => {
    const r = await Roomie.open(makeSnesLoRom());
    assert.equal(r.system, "sfc");
    assert.equal(r.info.sfc?.rom?.type, "LoROM");
    assert.equal(r.info.sfc?.rom?.size, 512 * 1024);
    assert.equal(r.info.sfc?.ram, 8 * 1024);
    assert.equal(r.region, "americas");
    assert.ok(r.name?.includes("TEST GAME"));
  });

  it("strips SMC header for hashes", async () => {
    const r = await Roomie.open(makeSnesWithSmc());
    assert.equal(r.system, "sfc");
    assert.equal(r.info.sfc?.smcHeaderBytes, 512);
    assert.equal(r.hash.stripped?.headerBytes, 512);
  });
});

describe("Roomie.open N64", () => {
  it("reads z64 name and region", async () => {
    const r = await Roomie.open(makeN64Z64());
    assert.equal(r.system, "n64");
    assert.ok(r.name?.startsWith("SMASH BROS"));
    assert.equal(r.gamecode, "NSME");
    assert.equal(r.region, "USA");
    assert.equal(r.info.n64?.endian, "z64");
  });

  it("reads v64 with byte-swap", async () => {
    const r = await Roomie.open(makeN64V64());
    assert.equal(r.system, "n64");
    assert.equal(r.info.n64?.endian, "v64");
    assert.ok(r.name?.startsWith("SMASH BROS"));
    assert.equal(r.gamecode, "NSME");
    assert.equal(r.region, "USA");
  });
});

describe("Roomie.open handhelds", () => {
  it("detects GB and GBC", async () => {
    const gb = await Roomie.open(makeGb());
    assert.equal(gb.system, "gb");
    assert.equal(gb.info.gb?.mbc, "MBC1");
    assert.equal(gb.region, "overseas");

    const gbc = await Roomie.open(makeGb({ cgb: 0xc0 }));
    assert.equal(gbc.system, "gbc");
    assert.equal(gbc.info.gbc?.isColor, true);
  });

  it("detects GBA save type without full-string scan bugs", async () => {
    const r = await Roomie.open(makeGba());
    assert.equal(r.system, "gba");
    assert.equal(r.info.gba?.saveType, "SRAM");
    assert.equal(r.gameid, "AGB-ATGE");
    assert.equal(r.region, "english");
  });

  it("parses NDS unit code and capacity", async () => {
    const r = await Roomie.open(makeNds());
    assert.equal(r.system, "nds");
    assert.equal(r.info.nds?.unitCode, "nds");
    assert.equal(r.info.nds?.deviceCapacityBytes, 131072 << 6);
    assert.equal(r.gameid, "NTR-ATDE");
  });
});

describe("Roomie.open other systems", () => {
  it("parses Genesis", async () => {
    const r = await Roomie.open(makeGenesis());
    assert.equal(r.system, "genesis");
    assert.ok(r.name?.includes("OVERSEAS"));
  });

  it("parses SMS", async () => {
    const r = await Roomie.open(makeSms());
    assert.equal(r.system, "sms");
    assert.ok(r.region?.includes("Export"));
  });

  it("parses WonderSwan / Color", async () => {
    const ws = await Roomie.open(makeWonderSwan(false));
    assert.equal(ws.system, "ws");
    assert.equal(ws.info.ws?.model, "WS");

    const wsc = await Roomie.open(makeWonderSwan(true));
    assert.equal(wsc.system, "wsc");
    assert.equal(wsc.info.wsc?.model, "WSC");
  });
});

describe("API helpers", () => {
  it("Roomie.open is preferred; load works on instance", async () => {
    const r = new Roomie();
    assert.equal(r.loaded, false);
    await r.load(makeNesINes());
    assert.equal(r.loaded, true);
    assert.equal(r.system, "nes");
  });

  it("throws NOT_LOADED before load", () => {
    const r = new Roomie();
    assert.throws(() => r.info, (e: unknown) => e instanceof RoomieError && e.code === "NOT_LOADED");
  });

  it("hash: false skips digests", async () => {
    const r = await Roomie.open(makeNesINes(), { hash: false });
    assert.equal(r.hash.sha1, "");
    assert.equal(r.hash.md5, "");
  });

  it("openManySettled returns mixed results", async () => {
    const results = await Roomie.openManySettled(["/nonexistent/rom.nes"]);
    assert.equal(results[0].status, "rejected");
  });

  it("toGamelistXML escapes special characters", async () => {
    const r = await Roomie.open(makeNesINes());
    // force nasty path/name
    (r as unknown as { _path: string })._path = `/roms/A&B<C>.nes`;
    r.name = `Foo & Bar <baz>`;
    const xml = r.toGamelistXML();
    assert.ok(xml.includes("&amp;"));
    assert.ok(xml.includes("&lt;"));
    assert.ok(!xml.includes("<baz>"));
    assert.ok(xml.includes("<md5>"));
  });

  it("toJSON returns valid JSON", async () => {
    const r = await Roomie.open(makeGba());
    const obj = JSON.parse(r.toJSON());
    assert.equal(obj.system, "gba");
  });
});

describe("ZIP support", () => {
  it("picks the best ROM entry from a zip", async () => {
    const zip = new JSZip();
    zip.file("readme.txt", "hello");
    zip.file("game.nes", makeNesINes());
    const blob = await zip.generateAsync({ type: "nodebuffer" });
    const r = await Roomie.open(blob);
    assert.equal(r.system, "nes");
  });
});

describe("detectSystem / stripDumpHeader", () => {
  it("detects NES with high score", () => {
    const d = detectSystem(makeNesINes());
    assert.equal(d?.system, "nes");
    assert.ok((d?.score ?? 0) >= 100);
  });

  it("strips iNES header", () => {
    const buf = makeNesINes();
    const { headerBytes, payload } = stripDumpHeader(buf, "nes");
    assert.equal(headerBytes, 16);
    assert.equal(payload.length, buf.length - 16);
  });
});

import path from "node:path";
import type { RomInfo } from "../types.js";
import { escapeXml } from "../utils/xml.js";

export interface GamelistContext {
  info: RomInfo;
  name?: string;
  path: string;
  cartridge?: Record<string, unknown>;
}

function hardwareLabel(info: RomInfo, cart: Record<string, unknown>): string {
  if (info.nes?.mapperName) {
    return `Mapper ${info.nes.mapper} (${info.nes.mapperName})`;
  }
  if (info.nes) return `Mapper ${info.nes.mapper}`;
  if (info.gb?.mbc) return `MBC (${info.gb.mbc})`;
  if (info.gbc?.mbc) return `MBC (${info.gbc.mbc})`;
  if (info.sfc?.rom?.type) return `Type (${info.sfc.rom.type})`;
  if (info.gba?.saveType) return `Save (${info.gba.saveType})`;
  if (info.nds?.unitCode) return `Unit (${info.nds.unitCode})`;
  if (typeof cart.mapperName === "string") {
    return `Mapper ${cart.mapper} (${cart.mapperName})`;
  }
  if (typeof cart.mbc === "string") return `MBC (${cart.mbc})`;
  if (cart.rom && typeof cart.rom === "object" && cart.rom !== null && "type" in cart.rom) {
    return `Type (${String((cart.rom as { type?: string }).type)})`;
  }
  if (typeof cart.saveType === "string") return `Save (${cart.saveType})`;
  return "None";
}

export function toGamelistXML(ctx: GamelistContext): string {
  const { info } = ctx;
  const name = escapeXml(ctx.name || path.basename(ctx.path));
  const filePath = escapeXml(ctx.path);
  const cart = ctx.cartridge || info.cartridge || {};
  const hardware = escapeXml(hardwareLabel(info, cart));
  const system = escapeXml(info.system);
  const region = info.region ? escapeXml(info.region) : undefined;
  const gameCode = info.gameCode ? escapeXml(info.gameCode) : undefined;
  const gameId = info.gameId ? escapeXml(info.gameId) : undefined;
  const sha1 = escapeXml(info.hash.sha1);
  const crc = escapeXml(info.hash.crc32);
  const md5 = escapeXml(info.hash.md5);

  const descParts = [`System: ${system}`, `Hardware: ${hardware}`];
  if (region) descParts.push(`Region: ${region}`);
  if (gameCode) descParts.push(`Code: ${gameCode}`);

  const extra: string[] = [];
  if (region) extra.push(`    <region>${region}</region>`);
  if (gameId) extra.push(`    <id>${gameId}</id>`);
  if (gameCode) extra.push(`    <serial>${gameCode}</serial>`);
  extra.push(`    <md5>${md5}</md5>`);

  return `<?xml version="1.0"?>
<gameList>
  <game>
    <path>${filePath}</path>
    <name>${name}</name>
    <desc>${escapeXml(descParts.join(", "))}</desc>
    <hash>${sha1}</hash>
    <crc32>${crc}</crc32>
${extra.join("\n")}
  </game>
</gameList>`;
}

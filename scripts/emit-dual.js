import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, "..", "dist");

async function run() {
  const esmIndex = join(dist, "index.js");
  try {
    const code = await fs.readFile(esmIndex, "utf8");
    await fs.writeFile(join(dist, "index.mjs"), code, "utf8");
    // CJS proxy
    const cjs = `
const mod = require("./index.mjs");
module.exports = mod.default || mod;
module.exports.default = mod.default || mod;
`;
    await fs.writeFile(join(dist, "index.cjs"), cjs, "utf8");
    console.log("Dual build emitted.");
  } catch (e) {
    console.error("emit-dual failed:", e);
    process.exit(1);
  }
}
run();

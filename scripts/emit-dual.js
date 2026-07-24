import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");
const cjs = join(dist, "cjs");

async function run() {
  // Mark CJS tree as CommonJS even though package root is "type": "module"
  await fs.writeFile(join(cjs, "package.json"), JSON.stringify({ type: "commonjs" }, null, 2));

  // ESM entry aliases expected by package.json exports
  const esmIndex = join(dist, "index.js");
  await fs.copyFile(esmIndex, join(dist, "index.mjs"));

  // CJS entry alias
  await fs.writeFile(
    join(dist, "index.cjs"),
    `"use strict";\nmodule.exports = require("./cjs/index.js");\nmodule.exports.default = module.exports.default || module.exports;\n`
  );

  // Types stay at dist/index.d.ts from ESM build
  console.log("Dual build emitted (ESM + CJS).");
}

run().catch((e) => {
  console.error("emit-dual failed:", e);
  process.exit(1);
});

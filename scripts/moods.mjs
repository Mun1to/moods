// Writes skills/moods/runtime/moods.js from the folders in skills/moods/moods/, so a window can
// ship the four built-in moods without reading any file. Run it with `pnpm moods` after changing one.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORDER = ["calm", "focus", "dream", "bright"];

/** The text of the module, from the folders as they are now. */
export async function moodsModule() {
  const moods = [];
  for (const id of ORDER) {
    const folder = path.join(root, "skills", "moods", "moods", id);
    const manifest = JSON.parse(await readFile(path.join(folder, "mod.json"), "utf8"));
    const mood = JSON.parse(await readFile(path.join(folder, "mood.json"), "utf8"));
    moods.push({ id, manifest, files: { "mood.json": JSON.stringify(mood) } });
  }
  return [
    "// The four moods every app with the plugin can ship: Calm, Focus, Dream and Bright.",
    "// Written by `pnpm moods` from the folders in ../moods/. Change those, not this file.",
    "",
    '/** @type {import("./compile.js").ModInput[]} */',
    `export const MOODS = ${JSON.stringify(moods, null, 2)};`,
    "",
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = path.join(root, "skills", "moods", "runtime", "moods.js");
  await writeFile(target, await moodsModule());
  console.log(`Wrote ${path.relative(root, target)}`);
}

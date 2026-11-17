// For apps and tools that run on Node (Electron, a CLI, a build step): reading the mods folder of
// a person and noticing when it changes. A window never imports this file.
import { readdir, readFile, stat } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { FILE_FOR_TYPE } from "./manifest.js";
import { MAX_STYLE_BYTES } from "./gate.js";

const MAX_MANIFEST_BYTES = 64 * 1024;
const MISSING = "is missing";

/**
 * Reads every mod inside a folder: one sub-folder per mod, with its `mod.json` and the one file
 * its type needs. A mod that cannot be read comes back with an `error`, never as an exception.
 * Links are not followed, so a mod cannot point outside its own folder.
 *
 * @param {string} dir the mods folder, in the person's data folder (never the install folder)
 * @returns {Promise<import("./compile.js").ModInput[]>} ready for `review` or `host.apply`, sorted by folder name
 */
export async function readModsFolder(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const folders = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort();
  return Promise.all(folders.map((name) => readMod(path.join(dir, name))));
}

/**
 * Reads one mod folder.
 * @param {string} folder
 * @returns {Promise<import("./compile.js").ModInput>}
 */
export async function readMod(folder) {
  const id = path.basename(folder);
  const manifest = await readSmall(path.join(folder, "mod.json"), MAX_MANIFEST_BYTES);
  if (!manifest.ok) return { id, manifest: undefined, error: `mod.json ${manifest.error}` };
  let data;
  try {
    data = JSON.parse(manifest.text);
  } catch {
    return { id, manifest: manifest.text };
  }
  if (typeof data?.id === "string" && data.id !== id) {
    return { id, manifest: manifest.text, error: `the folder is called ${id} but mod.json says the id is ${data.id}` };
  }
  const fileName = FILE_FOR_TYPE[/** @type {keyof typeof FILE_FOR_TYPE} */ (data?.type)];
  if (!fileName) return { id, manifest: manifest.text };
  const file = await readSmall(path.join(folder, fileName), MAX_STYLE_BYTES);
  if (!file.ok && file.error === MISSING) return { id, manifest: manifest.text, files: {} };
  if (!file.ok) return { id, manifest: manifest.text, error: `${fileName} ${file.error}` };
  return { id, manifest: manifest.text, files: { [fileName]: file.text } };
}

/**
 * @param {string} file
 * @param {number} limit
 * @returns {Promise<{ ok: true, text: string } | { ok: false, error: string }>}
 */
async function readSmall(file, limit) {
  try {
    const info = await stat(file);
    if (!info.isFile()) return { ok: false, error: MISSING };
    if (info.size > limit) return { ok: false, error: `is ${Math.round(info.size / 1024)} KB, the limit is ${Math.round(limit / 1024)} KB` };
    return { ok: true, text: await readFile(file, "utf8") };
  } catch {
    return { ok: false, error: MISSING };
  }
}

/**
 * Calls `onChange` a moment after anything inside the mods folder changes, so the app can read
 * the folder again and apply. Returns the function that stops watching.
 *
 * @param {string} dir
 * @param {() => void} onChange
 * @param {{ delay?: number }} [options] how long to wait for the writes to settle, in milliseconds
 * @returns {() => void}
 */
export function watchModsFolder(dir, onChange, { delay = 150 } = {}) {
  /** @type {NodeJS.Timeout | undefined} */
  let timer;
  const watcher = watch(dir, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, delay);
  });
  watcher.on("error", () => {});
  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}

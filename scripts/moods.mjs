// The mood library. Reads the families in skills/moods/library/, checks every mood and writes
//  - skills/moods/runtime/moods.js, so a window ships them without reading any file, and
//  - skills/moods/library/CREDITS.md, where each family says where its colors come from.
// `pnpm moods` after changing a family. `pnpm moods --check` only checks and writes nothing.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contrast, luminance } from "../skills/moods/runtime/color.js";
import { moodContrastNotes, ROLES } from "../skills/moods/runtime/compile.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const LIBRARY = path.join(root, "skills", "moods", "library");
/** The family of this project: its moods keep their short names. */
const HOUSE = "moods";
/** The four faces of the brand. A mood picks the one that feels like it. */
export const FACES = ["bright", "calm", "focus", "dream"];
/** The licenses a family can come under. Each one needs its notice in `notice()`. */
export const LICENSES = ["MIT"];

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const FAMILY_KEYS = ["name", "about", "source", "license", "copyright", "moods"];
const MOOD_KEYS = ["id", "name", "scheme", "face", "request", "colors"];

/**
 * @typedef {{ id: string, name: string, scheme: "dark" | "light", face?: string, request?: string, colors: Record<string, string> }} LibraryMood
 * @typedef {{ slug: string, name: string, about: string, source: string, license: string, copyright: string, moods: LibraryMood[] }} Family
 */

/**
 * The families as they are on disk: the house one first, then by name.
 * @param {string} [dir]
 * @returns {Promise<Family[]>}
 */
export async function readLibrary(dir = LIBRARY) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const families = [];
  for (const file of files) {
    const slug = file.slice(0, -".json".length);
    let data;
    try {
      data = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    } catch {
      data = { broken: true };
    }
    families.push({ ...data, slug });
  }
  return families.sort((a, b) => (a.slug === HOUSE ? -1 : b.slug === HOUSE ? 1 : String(a.name).localeCompare(String(b.name), "en")));
}

/** @param {unknown} value @param {number} max */
const isText = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max;

/**
 * Everything wrong with the library, one sentence each. An empty list means it can ship.
 * @param {Family[]} families
 * @returns {string[]}
 */
export function checkLibrary(families) {
  /** @type {string[]} */
  const problems = [];
  /** @type {Map<string, string>} */
  const ids = new Map();
  /** @type {Map<string, string>} */
  const palettes = new Map();
  const names = new Set();
  for (const family of families) {
    const file = `${family.slug}.json`;
    /** @param {string} text */
    const say = (text) => problems.push(`${file}: ${text}`);
    if (/** @type {{ broken?: boolean }} */ (family).broken) {
      say("is not valid JSON");
      continue;
    }
    if (!ID.test(family.slug)) say("the file name must use lowercase letters, digits and dashes");
    for (const key of Object.keys(family)) if (key !== "slug" && !FAMILY_KEYS.includes(key)) say(`does not know "${key}"`);
    if (!isText(family.name, 40)) say("needs a name of 40 characters at most");
    else if (names.has(family.name.toLowerCase())) say(`another family is already called ${family.name}`);
    else names.add(family.name.toLowerCase());
    if (!isText(family.about, 90)) say("needs an about of one sentence, 90 characters at most");
    if (typeof family.source !== "string" || !/^https:\/\/\S+$/.test(family.source)) say("needs a source: the https address where the colors come from");
    if (!LICENSES.includes(family.license)) say(`needs a license of ${LICENSES.join(", ")}, checked at its source`);
    if (!isText(family.copyright, 200)) say("needs the copyright line of its source, as written there");
    if (!Array.isArray(family.moods) || !family.moods.length) {
      say("needs at least one mood");
      continue;
    }
    const inFamily = new Set();
    for (const mood of family.moods) {
      const id = typeof mood?.id === "string" ? mood.id : "?";
      /** @param {string} text */
      const sayMood = (text) => problems.push(`${file}: ${id}: ${text}`);
      if (!mood || typeof mood !== "object") {
        say("a mood must be an object");
        continue;
      }
      for (const key of Object.keys(mood)) if (!MOOD_KEYS.includes(key)) sayMood(`does not know "${key}"`);
      if (!ID.test(id)) sayMood("the id must use lowercase letters, digits and dashes");
      else if (family.slug !== HOUSE && id !== family.slug && !id.startsWith(`${family.slug}-`)) sayMood(`the id must start with ${family.slug}-`);
      if (ids.has(id)) sayMood(`${ids.get(id)} already has this id`);
      else ids.set(id, file);
      if (!isText(mood.name, 30)) sayMood("needs a name of 30 characters at most");
      else if (inFamily.has(mood.name.toLowerCase())) sayMood(`the family already has a mood called ${mood.name}`);
      else inFamily.add(mood.name.toLowerCase());
      if (mood.scheme !== "dark" && mood.scheme !== "light") sayMood("scheme must be dark or light");
      if (mood.face !== undefined && !FACES.includes(mood.face)) sayMood(`face must be one of ${FACES.join(", ")}`);
      if (mood.request !== undefined && !isText(mood.request, 200)) sayMood("request must be a sentence");
      const colors = mood.colors && typeof mood.colors === "object" ? mood.colors : {};
      const extra = Object.keys(colors).filter((role) => !ROLES.includes(role));
      if (extra.length) sayMood(`has colors with no role: ${extra.join(", ")}`);
      const bad = ROLES.filter((role) => typeof colors[role] !== "string" || !HEX.test(colors[role]));
      if (bad.length) {
        sayMood(`needs a #RRGGBB color for ${bad.join(", ")}`);
        continue;
      }
      for (const note of [...moodContrastNotes(colors), ...panelNotes(colors)]) sayMood(note);
      const dark = luminance(colors.background) < luminance(colors.text);
      if ((mood.scheme === "dark") !== dark && (mood.scheme === "dark" || mood.scheme === "light")) {
        sayMood(`says ${mood.scheme}, but its background is ${dark ? "darker" : "lighter"} than its text`);
      }
      const palette = ROLES.map((role) => colors[role].toLowerCase()).join(" ");
      if (palettes.has(palette)) sayMood(`has the same seven colors as ${palettes.get(palette)}`);
      else palettes.set(palette, id);
    }
  }
  return problems;
}

/**
 * What the library asks for on top of the plugin's own warnings: a mood has to read well inside a
 * panel too, and its lines have to show.
 * @param {Record<string, string>} colors
 */
function panelNotes(colors) {
  /** @type {[string, string, number][]} */
  const checks = [["text", "surface", 4.5], ["muted", "surface", 4.5], ["border", "background", 1.2]];
  const notes = [];
  for (const [fg, bg, min] of checks) {
    const ratio = contrast(colors[fg], colors[bg]);
    if (ratio < min) notes.push(`${fg} on ${bg} is ${ratio.toFixed(2)}:1, under ${min}:1`);
  }
  return notes;
}

/**
 * The words a license asks to travel with what it covers.
 * @param {string} license
 */
async function notice(license) {
  if (license !== "MIT") throw new Error(`No notice written for ${license} yet`);
  // The MIT text, from this repository's own LICENSE: everything after its copyright line.
  const text = await readFile(path.join(root, "LICENSE"), "utf8");
  return text.slice(text.indexOf("Permission is hereby granted")).trim();
}

/** @param {Family[]} families */
function refuse(families) {
  const problems = checkLibrary(families);
  if (problems.length) throw new Error(`The mood library has ${problems.length === 1 ? "a problem" : `${problems.length} problems`}:\n  ${problems.join("\n  ")}`);
}

/**
 * The text of runtime/moods.js, from the library as it is now.
 * @param {Family[]} [families]
 */
export async function moodsModule(families) {
  const list = families ?? await readLibrary();
  refuse(list);
  const others = list.filter((f) => f.slug !== HOUSE);
  const moods = list.flatMap((family) => family.moods.map((mood) => ({
    id: mood.id,
    manifest: {
      format: 1, id: mood.id, name: mood.name, type: "mood", family: family.name,
      request: mood.request ?? `The ${mood.name} mood of ${family.name}.`, contract: "^1.0",
    },
    files: { "mood.json": JSON.stringify({ scheme: mood.scheme, ...(mood.face ? { face: mood.face } : {}), colors: mood.colors }) },
  })));
  const about = list.map((f) => ({ name: f.name, about: f.about, source: f.source, license: f.license, copyright: f.copyright, moods: f.moods.map((m) => m.id) }));
  const count = `${moods.length} moods in ${list.length} families`;
  const lines = [
    `// Example moods for any app with the plugin: ${count}. The plugin puts none of them in an app`,
    "// by itself: an app offers the ones it passes to `startMods`, changes them or brings its own.",
    "// Written by `pnpm moods` from the files in ../library/. Change those, not this file.",
  ];
  if (others.length) {
    lines.push("//", "// Some families bring the colors of other projects, under the license each one chose:");
    for (const f of others) lines.push(`//   ${f.name}: ${f.source} (${f.license}). ${f.copyright}`);
    for (const license of new Set(others.map((f) => f.license))) {
      lines.push("//", `// ${license}:`, ...(await notice(license)).split("\n").map((l) => `//   ${l}`.trimEnd()));
    }
  }
  lines.push(
    "",
    "/** The families: who made each one, under which license, and which moods are in it. */",
    `export const FAMILIES = [\n${about.map((f) => `  ${JSON.stringify(f)},`).join("\n")}\n];`,
    "",
    "/**",
    " * Every example mood, family by family.",
    ' * @type {import("./compile.js").ModInput[]}',
    " */",
    `export const EXAMPLES = [\n${moods.map((m) => `  ${JSON.stringify(m)},`).join("\n")}\n];`,
    "",
    "/**",
    ' * The example moods of some families, by name: `moodsFrom("Moods", "Catppuccin")`.',
    " * @param {...string} families",
    " */",
    "export function moodsFrom(...families) {",
    "  const ids = new Set(FAMILIES.filter((f) => families.includes(f.name)).flatMap((f) => f.moods));",
    '  return EXAMPLES.filter((m) => ids.has(m.id ?? ""));',
    "}",
    "",
  );
  return lines.join("\n");
}

/**
 * The text of library/CREDITS.md.
 * @param {Family[]} [families]
 */
export async function creditsFile(families) {
  const list = families ?? await readLibrary();
  refuse(list);
  const others = list.filter((f) => f.slug !== HOUSE);
  const lines = [
    "# Where the colors come from",
    "",
    "Written by `pnpm moods` from the files in this folder. Each family names its source and its",
    "license, checked there before the family came in.",
    "",
    "| Family | Moods | Source | License | Copyright |",
    "| --- | --- | --- | --- | --- |",
    ...list.map((f) => `| ${f.name} | ${f.moods.map((m) => m.name).join(", ")} | ${f.source} | ${f.license} | ${f.copyright} |`),
    "",
  ];
  for (const license of new Set(others.map((f) => f.license))) {
    lines.push(`## ${license}`, "", "```", await notice(license), "```", "");
  }
  return lines.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const families = await readLibrary();
    const module = await moodsModule(families);
    const credits = await creditsFile(families);
    const count = families.reduce((n, f) => n + f.moods.length, 0);
    if (process.argv.includes("--check")) {
      console.log(`The library is fine: ${count} moods in ${families.length} families.`);
    } else {
      await writeFile(path.join(root, "skills", "moods", "runtime", "moods.js"), module);
      await writeFile(path.join(LIBRARY, "CREDITS.md"), credits);
      console.log(`Wrote ${count} moods in ${families.length} families: skills/moods/runtime/moods.js and skills/moods/library/CREDITS.md`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

#!/usr/bin/env node
// Gets an app ready for mods in one go.
//
//   node init.mjs [app folder] [--into src/mods] [--dry-run]
//
// It copies the plugin into the app, reads the app's styles to draft its contract.json (which
// variables are its colors, its corners, its letter), writes MODS.md for the people who use the
// app and tells coding agents, in AGENTS.md, to make a mod instead of editing the app. Run it
// again to update the plugin: it never overwrites a contract.json or a MODS.md that is already there.
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const skill = path.resolve(here, "..");
const PLUGIN = "https://github.com/Mun1to/moods";

const SKIP = new Set(["node_modules", ".git", "dist", "build", "out", "target", "coverage", "vendor", "venv", ".venv",
  "__pycache__", ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache", ".output", "gen", "bin", "obj"]);
const STYLES = /\.(css|scss|sass|less|pcss|html|vue|svelte|astro)$/i;
const MARKUP = /\.(html|vue|svelte|astro|jsx|tsx|js|ts|mjs|py|rs)$/i;
const MAX_FILE = 1024 * 1024;
const MAX_FILES = 6000;

const COLOR = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(.+\)|white|black|transparent|currentcolor|[a-z]+)$/i;
const HSL_CHANNELS = /^-?[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%$/;
const RGB_CHANNELS = /^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/;
const RGB_COMMAS = /^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/;
const NAMED = new Set(["inherit", "initial", "unset", "none", "auto", "normal", "bold", "italic", "solid", "dashed"]);

/** What each mood role is usually called. The first pattern that matches gives the highest score. */
const ROLE_NAMES = /** @type {Record<string, RegExp[]>} */ ({
  background: [/^(color-)?(background|bg)$/, /(^|-)(background|bg)-(base|default|primary|main|app|page|body)$/, /(^|-)(background|bg|canvas|page)$/],
  surface: [/(^|-)(surface|panel|card|paper|elevated|popover)(-(bg|background|default|color))?$/,
    /(^|-)(background|bg)-(secondary|alt|subtle|soft|elevated|2|ui|panel|card|surface|raised)$/, /(^|-)(sidebar|secondary)(-(bg|background))?$/],
  text: [/^(color-)?(text|fg|foreground|ink)$/, /(^|-)(text|fg|foreground)-(primary|main|base|default|body)$/, /(^|-)(text|fg|foreground|ink)$/],
  muted: [/(^|-)(muted-foreground|muted-text|subtext)$/, /(^|-)(text|fg|foreground)-(muted|secondary|quiet|subtle|dim|soft|2|weak)$/,
    /(^|-)(muted|quiet|subtle|dim|mid-gray|secondary-text)$/],
  accent: [/^(color-)?(primary|brand)$/, /^(color-)?accent$/, /(^|-)(accent|primary|brand|highlight)(-(color|default|base|main|500|600))?$/],
  accentText: [/(^|-)(primary|accent|brand)-(foreground|fg|text|contrast|content)$/, /(^|-)on-(primary|accent|brand)$/, /(^|-)(text|fg)-on-(primary|accent|brand)$/],
  border: [/^(color-)?(border|line)$/, /(^|-)(border|line|divider|separator|outline|hairline|stroke)(-(color|default|base|main))?$/],
});

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const intoArg = args.indexOf("--into");
const app = path.resolve(args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--into") ?? ".");

/** @param {string} file */
const exists = (file) => stat(file).then(() => true, () => false);
/** @param {string} file */
const rel = (file) => path.relative(app, file).split(path.sep).join("/") || ".";

/**
 * @param {string} dir
 * @param {string[]} found
 * @param {string} skipDir
 */
async function walk(dir, found, skipDir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (found.length >= MAX_FILES) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name) && !entry.name.startsWith(".") && full !== skipDir) await walk(full, found, skipDir);
    } else if (entry.isFile() && (STYLES.test(entry.name) || MARKUP.test(entry.name))) {
      found.push(full);
    }
  }
}

/** @param {string} value */
function kindOf(value) {
  const v = value.trim().replace(/\s*!important$/, "");
  if (HSL_CHANNELS.test(v)) return "hsl";
  if (RGB_CHANNELS.test(v)) return "rgb";
  if (RGB_COMMAS.test(v)) return "rgb-commas";
  if (/^var\(/.test(v)) return "alias";
  if (/^-?[\d.]+(px|rem|em|%|vh|vw|ch|pt)?$/.test(v) || /^(calc|clamp|min|max)\(/.test(v)) return "size";
  if (COLOR.test(v) && !NAMED.has(v.toLowerCase())) return "color";
  return "other";
}

/** @param {string} name the variable without its dashes */
function aboutOf(name) {
  if (/radius|rounded|corner/.test(name)) return "corner";
  if (/font|typeface|letter|leading|line-height/.test(name)) return "letter";
  if (/shadow|elevation/.test(name)) return "shadow";
  if (/size|space|spacing|gap|width|height|padding|margin/.test(name)) return "size";
  return "";
}

try {
  if (!(await exists(app))) throw new Error(`There is no folder at ${app}`);
  const into = path.resolve(app, intoArg >= 0 ? args[intoArg + 1] : (await exists(path.join(app, "src"))) ? "src/mods" : "mods");

  // 1. What the app is called.
  let name = path.basename(app);
  for (const [file, pick] of /** @type {[string, (data: any) => unknown][]} */ ([
    ["src-tauri/tauri.conf.json", (d) => d.productName ?? d.package?.productName],
    ["package.json", (d) => d.productName ?? d.name],
  ])) {
    try {
      const found = pick(JSON.parse(await readFile(path.join(app, file), "utf8")));
      if (typeof found === "string" && found.trim()) {
        name = found.trim();
        break;
      }
    } catch {
      // That file is not there or is not JSON: the next one, or the folder name.
    }
  }

  // 2. What the app paints with, and what it already marked.
  /** @type {string[]} */
  const files = [];
  await walk(app, files, into);
  /** @type {Map<string, { value: string, file: string, uses: number }>} */
  const variables = new Map();
  /** @type {Map<string, number>} */
  const uses = new Map();
  const marks = { piece: new Set(), zone: new Set(), "no-mods": new Set() };
  for (const file of files) {
    const info = await stat(file);
    if (info.size > MAX_FILE) continue;
    const text = await readFile(file, "utf8");
    if (STYLES.test(file)) {
      for (const m of text.matchAll(/(^|[;{\s])(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+)/g)) {
        const [, , variable, value] = m;
        if (/^--(tw|mod)-/.test(variable) || !value.trim()) continue;
        if (!variables.has(variable)) variables.set(variable, { value: value.trim(), file: rel(file), uses: 0 });
      }
    }
    for (const m of text.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) uses.set(m[1], (uses.get(m[1]) ?? 0) + 1);
    for (const m of text.matchAll(/data-(piece|zone|no-mods)=["'{`]+([a-z0-9-]+)/g)) marks[/** @type {"piece"} */ (m[1])].add(m[2]);
  }
  for (const [variable, found] of variables) found.uses = uses.get(variable) ?? 0;

  /** The kind of a variable, following one alias: `--accent: var(--blue)` is what `--blue` is. */
  const resolved = (/** @type {string} */ variable) => {
    const found = variables.get(variable);
    if (!found) return "other";
    const kind = kindOf(found.value);
    if (kind !== "alias") return kind;
    const target = /var\(\s*(--[A-Za-z0-9_-]+)/.exec(found.value)?.[1];
    return target && variables.has(target) ? kindOf(/** @type {{ value: string }} */ (variables.get(target)).value) : "other";
  };

  // 3. The seven roles, by what apps usually call them.
  /** @type {Record<string, string | { variable: string, as: string }>} */
  const roles = {};
  const taken = new Set();
  /** @type {string[]} */
  const missing = [];
  for (const [role, patterns] of Object.entries(ROLE_NAMES)) {
    let best = null;
    for (const [variable, found] of variables) {
      const kind = resolved(variable);
      if (taken.has(variable) || !["color", "hsl", "rgb", "rgb-commas"].includes(kind)) continue;
      const bare = variable.slice(2).toLowerCase();
      const rank = patterns.findIndex((p) => p.test(bare));
      if (rank < 0) continue;
      const score = (patterns.length - rank) * 1000 + Math.min(found.uses, 500) - bare.length;
      if (!best || score > best.score) best = { variable, kind, score };
    }
    if (!best) {
      missing.push(role);
      continue;
    }
    taken.add(best.variable);
    roles[role] = best.kind === "color" ? best.variable : { variable: best.variable, as: best.kind };
  }

  // 4. Other names worth promising: corners, letter, sizes and the colors the app uses most.
  /** @type {Record<string, { since: string, about: string }>} */
  const promised = {};
  const rest = [...variables].filter(([variable]) => !taken.has(variable))
    .map(([variable, found]) => ({ variable, ...found, about: aboutOf(variable.slice(2).toLowerCase()), kind: resolved(variable) }))
    .filter((v) => v.about || v.kind === "color")
    .sort((a, b) => Number(Boolean(b.about)) - Number(Boolean(a.about)) || b.uses - a.uses || a.variable.localeCompare(b.variable))
    .slice(0, 24);
  for (const v of rest) promised[v.variable] = { since: "1.0.0", about: `${v.about || "color"}: ${v.value.slice(0, 60)}, in ${v.file}` };

  const contract = {
    contract: "1.0.0",
    app: name,
    roles,
    variables: promised,
    pieces: Object.fromEntries([...marks.piece].sort().map((p) => [p, { since: "1.0.0" }])),
    zones: Object.fromEntries([...marks.zone].sort().map((z) => [z, { since: "1.0.0", pieces: [] }])),
    deprecated: {},
    noMods: [...new Set([...marks["no-mods"], "way-back"])].sort(),
  };

  // 5. Write it all down.
  const contractFile = path.join(into, "contract.json");
  const modsFile = path.join(app, "MODS.md");
  const agentsFile = path.join(app, "AGENTS.md");
  const hadContract = await exists(contractFile);
  const hadGuide = await exists(modsFile);
  const toPosix = (/** @type {string} */ file) => rel(file);

  const fill = (/** @type {string} */ text) => text
    .replaceAll("<App>", name)
    .replaceAll("<link to contract.json>", toPosix(contractFile))
    .replaceAll("<link to the plugin>", PLUGIN)
    .replaceAll("<link to the format>", `${PLUGIN}/blob/main/skills/moods/reference/format.md`)
    .replaceAll("<contract.json>", toPosix(contractFile))
    .replaceAll("<check.mjs>", `${PLUGIN}/blob/main/skills/moods/scripts/check.mjs`);

  const block = fill(await readFile(path.join(skill, "templates", "AGENTS-block.md"), "utf8")).trim();
  const agentsBefore = (await exists(agentsFile)) ? await readFile(agentsFile, "utf8") : "";
  const marker = /<!-- mods:start -->[\s\S]*?<!-- mods:end -->/;
  const agentsAfter = marker.test(agentsBefore)
    ? agentsBefore.replace(marker, block)
    : `${agentsBefore.trimEnd()}${agentsBefore.trim() ? "\n\n" : ""}${block}\n`;

  if (!dry) {
    await mkdir(into, { recursive: true });
    await cp(path.join(skill, "runtime"), into, { recursive: true });
    if (!hadContract) await writeFile(contractFile, `${JSON.stringify(contract, null, 2)}\n`);
    if (!hadGuide) await writeFile(modsFile, fill(await readFile(path.join(skill, "templates", "MODS.md"), "utf8")));
    if (agentsAfter !== agentsBefore) await writeFile(agentsFile, agentsAfter);
  }

  const say = console.log;
  const did = dry ? "Would write" : "Wrote";
  say(`${name}: ${variables.size} variables in ${files.length} files.`);
  say("");
  say(`${did} ${rel(into)}/ (the plugin).`);
  say(hadContract ? `Kept ${rel(contractFile)} as it was.` : `${did} ${rel(contractFile)} (a draft: every name in it is a promise, so take out what you would not keep).`);
  say(hadGuide ? `Kept MODS.md as it was.` : `${did} MODS.md (for the people who use the app; fill what is between < and >).`);
  say(agentsAfter === agentsBefore ? "AGENTS.md already tells agents to make a mod." : `${did} AGENTS.md (agents asked to change the app for one person make a mod instead of editing it).`);
  if (!hadContract) {
    say("");
    const mapped = Object.entries(roles).map(([role, r]) => `${role}: ${typeof r === "string" ? r : `${r.variable} (kept as ${r.as})`}`);
    if (mapped.length) say(`Mood roles found: ${mapped.join(", ")}.`);
    if (missing.length) {
      say(`No variable found for: ${missing.join(", ")}. A mood needs the seven: give each of those colors a variable in the app's styles and map it in "roles".`);
    }
    if (!marks.piece.size) say(`No piece is marked yet: put data-piece="name" on the parts people may restyle and list them in "pieces".`);
  }
  say("");
  say("Next, where the app starts its window:");
  say("");
  say(`  import { startMods } from "./${path.basename(into)}/index.js";`);
  say(`  import contract from "./${path.basename(into)}/contract.json";`);
  say("  await startMods({ contract });");
  say("");
  say("and where its settings are:");
  say("");
  say("  <moods-panel></moods-panel>");
  say("");
  say("Without a bundler, give startMods the address of contract.json instead of importing it.");
  if (await exists(path.join(app, "src-tauri"))) {
    say("This is a Tauri app: copy templates/read_mods.rs into src-tauri and pass `mods: () => invoke(\"read_mods\")`.");
  } else if ((await exists(path.join(app, "pyproject.toml"))) || (await exists(path.join(app, "requirements.txt")))) {
    say("This looks like a Python app: templates/read_mods.py reads the folder; expose it to the window and pass it as `mods`.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

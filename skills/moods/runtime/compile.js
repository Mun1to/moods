// From a mod (its manifest and its files) to a verdict and, when it passes, the CSS that applies it.
// Pure functions: no DOM here, so every rule can be tested in Node.
import { readManifest, FILE_FOR_TYPE } from "./manifest.js";
import { checkStyle, namesInStyle } from "./gate.js";
import { walkStyle } from "./css.js";
import { satisfies } from "./semver.js";
import { contrast } from "./color.js";

export const ROLES = ["background", "surface", "text", "muted", "accent", "accentText", "border"];
const HEX = /^#[0-9a-fA-F]{6}$/;
const NO_MODS = "[data-no-mods]";

/**
 * @typedef {{ contract: string, app?: string, root?: string, roles?: Record<string, string>,
 *   variables?: Record<string, { since?: string, about?: string }>,
 *   pieces?: Record<string, { since?: string, about?: string }>,
 *   zones?: Record<string, { since?: string, about?: string, pieces?: string[] }>,
 *   deprecated?: Record<string, { use: string, since?: string }>,
 *   noMods?: string[] }} Contract
 * @typedef {{ manifest: unknown, files?: Record<string, string>, enabled?: boolean, id?: string, error?: string }} ModInput
 * @typedef {"applied" | "deprecated" | "broken" | "rejected" | "off"} State
 * @typedef {{ id: string, name: string, type: string, state: State, notes: string[], request?: string,
 *   scheme?: "dark" | "light", css?: string }} Verdict
 * @typedef {{ state?: "broken" | "rejected", notes: string[], css?: string, deprecated?: boolean, scheme?: "dark" | "light" }} Compiled
 */

/**
 * Reviews one mod against the contract of the app.
 * @param {ModInput} mod
 * @param {Contract} contract
 * @param {{ off?: boolean, scope?: boolean }} [options] `off`: the app started without mods.
 *   `scope: false`: the window has no `@scope`, so style mods cannot be kept away from the zones without mods.
 * @returns {Verdict}
 */
export function review(mod, contract, { off = false, scope = true } = {}) {
  const read = readManifest(mod.manifest);
  if (!read.ok) {
    const id = guessId(mod);
    return { id, name: id, type: "unknown", state: "rejected", notes: mod.error ? [mod.error] : read.errors };
  }
  const m = read.manifest;
  const base = { id: m.id, name: m.name, type: m.type, request: m.request };
  if (off) return { ...base, state: "off", notes: ["the app started with every mod off"] };
  if (mod.enabled === false) return { ...base, state: "off", notes: [] };
  if (mod.error) return { ...base, state: "rejected", notes: [mod.error] };
  /** @type {string[]} */
  const notes = [];
  let deprecated = false;
  if (!satisfies(contract.contract, m.contract)) {
    deprecated = true;
    notes.push(`made for contract ${m.contract}, the app is on ${contract.contract}`);
  }
  const text = mod.files?.[FILE_FOR_TYPE[m.type]];
  if (typeof text !== "string") return { ...base, state: "rejected", notes: [`${FILE_FOR_TYPE[m.type]} is missing`] };

  const missing = missingTouches(m.touches, contract);
  if (missing.length) return { ...base, state: "broken", notes: missing.map((n) => `the app no longer has ${n}`) };
  if (m.type === "style" && !scope) {
    return { ...base, state: "broken", notes: ["this window is too old for style mods: it has no @scope to keep them out of the zones without mods"] };
  }

  /** @type {Compiled} */
  let out;
  if (m.type === "mood") out = compileMood(text, contract);
  else if (m.type === "style") out = compileStyle(text, contract);
  else out = compileStructure(text, contract);
  if (out.state) return { ...base, state: out.state, notes: [...notes, ...out.notes] };
  if (out.deprecated) deprecated = true;
  return {
    ...base,
    state: deprecated ? "deprecated" : "applied",
    notes: [...notes, ...out.notes],
    ...(out.scheme ? { scheme: out.scheme } : {}),
    css: out.css,
  };
}

/** @param {ModInput} mod */
function guessId(mod) {
  try {
    const data = typeof mod.manifest === "string" ? JSON.parse(mod.manifest) : mod.manifest;
    if (typeof data?.id === "string" && data.id) return data.id;
  } catch {
    // An unreadable manifest has no id: the folder name, when the loader gave one, is the next best.
  }
  return mod.id ?? "unknown";
}

/**
 * Names listed in `touches` that the contract does not know.
 * @param {string[]} touches
 * @param {Contract} contract
 */
function missingTouches(touches, contract) {
  return touches.filter((t) => {
    if (t.startsWith("piece:")) return !contract.pieces?.[t.slice(6)];
    if (t.startsWith("zone:")) return !contract.zones?.[t.slice(5)];
    if (t.startsWith("--")) return !knownVariable(t, contract) && !contract.deprecated?.[t];
    return false;
  });
}

/** @param {string} name @param {Contract} contract */
function knownVariable(name, contract) {
  return Boolean(contract.variables?.[name]) || Object.values(contract.roles ?? {}).includes(name) || name.startsWith("--mod-");
}

/**
 * A mood: one color per role, written onto the app's own variables. Every value is `!important`:
 * a mood has to win over whatever the app sets, also from a more specific selector or inline.
 * @param {string} text the text of mood.json
 * @param {Contract} contract
 * @returns {Compiled}
 */
export function compileMood(text, contract) {
  let mood;
  try {
    mood = JSON.parse(text);
  } catch {
    return { state: "rejected", notes: ["mood.json is not valid JSON"] };
  }
  const roles = contract.roles ?? {};
  const unmapped = ROLES.filter((r) => !roles[r]);
  if (unmapped.length) return { state: "broken", notes: [`the app does not map the roles ${unmapped.join(", ")}`] };
  const colors = mood?.colors ?? {};
  const bad = ROLES.filter((r) => typeof colors[r] !== "string" || !HEX.test(colors[r]));
  if (bad.length) return { state: "rejected", notes: [`mood.json needs a #RRGGBB color for ${bad.join(", ")}`] };
  if (mood.scheme !== "dark" && mood.scheme !== "light") return { state: "rejected", notes: ["scheme must be dark or light"] };
  const notes = moodContrastNotes(colors);
  const decls = ROLES.map((r) => `${roles[r]}: ${colors[r]} !important;`).join(" ");
  const root = contract.root ?? ":root";
  const css = root === ":root"
    ? `:root { color-scheme: ${mood.scheme} !important; ${decls} }`
    : `:root { color-scheme: ${mood.scheme} !important; }\n${root} { ${decls} }`;
  return { css, notes, scheme: mood.scheme };
}

/**
 * Contrast warnings for a mood, measured with the WCAG 2.2 formula.
 * @param {Record<string, string>} colors
 */
export function moodContrastNotes(colors) {
  /** @type {[string, string, number][]} */
  const checks = [
    ["text", "background", 4.5],
    ["muted", "background", 4.5],
    ["accentText", "accent", 4.5],
    ["accent", "background", 3],
  ];
  /** @type {string[]} */
  const notes = [];
  for (const [fg, bg, min] of checks) {
    const ratio = contrast(colors[fg], colors[bg]);
    if (ratio < min) notes.push(`${fg} on ${bg} is ${ratio.toFixed(2)}:1, under ${min}:1`);
  }
  return notes;
}

/**
 * A style: through the gate, deprecated names rewritten, every declaration made `!important` (the
 * person's choice wins over the app's own styles, also the inline ones) and the whole file scoped
 * away from the zones without mods.
 * @param {string} text the text of style.css
 * @param {Contract} contract
 * @returns {Compiled}
 */
export function compileStyle(text, contract) {
  const gate = checkStyle(text);
  if (!gate.ok) return { state: "rejected", notes: gate.errors };
  let css = gate.css;
  /** @type {string[]} */
  const notes = [];
  let deprecated = false;
  for (const [old, { use }] of Object.entries(contract.deprecated ?? {})) {
    const pattern = new RegExp(`${escapeRe(old)}(?![\\w-])`, "g");
    if (pattern.test(css)) {
      css = css.replace(pattern, use);
      deprecated = true;
      notes.push(`${old} is deprecated, use ${use}`);
    }
  }
  const names = namesInStyle(css);
  const unknown = [
    ...[...names.variables].filter((v) => !knownVariable(v, contract)),
    ...[...names.pieces].filter((p) => !contract.pieces?.[p]).map((p) => `piece:${p}`),
    ...[...names.zones].filter((z) => !contract.zones?.[z]).map((z) => `zone:${z}`),
  ];
  if (unknown.length) {
    return { state: "broken", notes: unknown.map((n) => `${n} is not in the app's contract (own helper variables start with --mod-)`) };
  }
  if (/data-no-mods/.test(css)) notes.push("it names a zone without mods, and no style reaches those");
  const walked = walkStyle(css, { selector: toScope, declaration: important });
  if (!walked.ok) return { state: "rejected", notes: walked.errors };
  const root = contract.root ?? ":root";
  const scoped = walked.css ? `@scope (${root}) to (${NO_MODS}) {\n${walked.css}\n}` : "";
  return { css: [walked.hoisted, scoped].filter(Boolean).join("\n"), notes, deprecated };
}

/**
 * Inside `@scope` a selector only matches below the scope root, so `:root` and `html` would never
 * match: they become `:scope`, which is the root itself.
 * @param {string} selector
 */
function toScope(selector) {
  return selector.replace(/:root(?![\w-])/g, ":scope").replace(/(^|,)\s*html(?=$|[\s,.:#[>+~])/g, "$1 :scope").trim();
}

/** @param {string} declaration */
const important = (declaration) => (/!\s*important\s*$/i.test(declaration) ? declaration : `${declaration} !important`);

/**
 * A structure: order and hide pieces of a zone with CSS, never moving the app's DOM.
 * @param {string} text the text of structure.json
 * @param {Contract} contract
 * @returns {Compiled}
 */
export function compileStructure(text, contract) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { state: "rejected", notes: ["structure.json is not valid JSON"] };
  }
  const zones = data?.zones;
  if (!zones || typeof zones !== "object") return { state: "rejected", notes: ["structure.json needs zones"] };
  /** @type {string[]} */
  const rules = [];
  /** @type {string[]} */
  const problems = [];
  for (const [zone, spec] of Object.entries(zones)) {
    const known = contract.zones?.[zone];
    if (!known) {
      problems.push(`zone:${zone} is not in the app's contract`);
      continue;
    }
    const allowed = new Set(known.pieces ?? []);
    /** @type {string[]} */
    const order = Array.isArray(spec?.order) ? spec.order : [];
    /** @type {string[]} */
    const hidden = Array.isArray(spec?.hidden) ? spec.hidden : [];
    for (const p of [...order, ...hidden]) if (!allowed.has(p)) problems.push(`piece:${p} is not in zone:${zone}`);
    // !important: these rules are written by the plugin from the person's choice, and they have
    // to win over the app's own CSS whatever its specificity.
    order.forEach((p, i) => rules.push(`[data-zone="${zone}"] > [data-piece="${p}"] { order: ${i + 1} !important; }`));
    // Pieces not named keep their place after the ordered ones.
    if (order.length) rules.push(`[data-zone="${zone}"] > [data-piece]:not(${order.map((p) => `[data-piece="${p}"]`).join(", ")}) { order: ${order.length + 1} !important; }`);
    hidden.forEach((p) => rules.push(`[data-zone="${zone}"] > [data-piece="${p}"] { display: none !important; }`));
  }
  if (problems.length) return { state: "broken", notes: problems };
  return { css: rules.join("\n"), notes: [] };
}

/** @param {string} s */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

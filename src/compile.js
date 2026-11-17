// From a mod (its manifest and its files) to a verdict and, when it passes, the CSS that applies it.
// Pure functions: no DOM here, so every rule can be tested in Node.
import { readManifest, FILE_FOR_TYPE } from "./manifest.js";
import { checkStyle, namesInStyle } from "./gate.js";
import { satisfies } from "./semver.js";
import { contrast } from "./color.js";

export const ROLES = ["background", "surface", "text", "muted", "accent", "accentText", "border"];
const HEX = /^#[0-9a-fA-F]{6}$/;
const NO_MODS = "[data-no-mods]";

/**
 * @typedef {{ contract: string, app?: string, roles?: Record<string, string>,
 *   variables?: Record<string, { since?: string, about?: string }>, pieces?: Record<string, object>,
 *   zones?: Record<string, { pieces?: string[] }>, deprecated?: Record<string, { use: string, since?: string }>,
 *   noMods?: string[] }} Contract
 * @typedef {{ manifest: unknown, files?: Record<string, string>, enabled?: boolean }} ModInput
 * @typedef {{ id: string, name: string, type: string, state: "applied" | "deprecated" | "broken" | "rejected" | "off",
 *   notes: string[], request?: string, css?: string }} Verdict
 */

/** @param {ModInput} mod @param {Contract} contract @returns {Verdict} */
export function review(mod, contract) {
  const read = readManifest(mod.manifest);
  if (!read.ok) return { id: guessId(mod.manifest), name: guessId(mod.manifest), type: "unknown", state: "rejected", notes: read.errors };
  const m = read.manifest;
  const base = { id: m.id, name: m.name, type: m.type, request: m.request };
  if (mod.enabled === false) return { ...base, state: "off", notes: [] };
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

  let out;
  if (m.type === "mood") out = compileMood(text, contract);
  else if (m.type === "style") out = compileStyle(text, contract);
  else out = compileStructure(text, contract);
  if (out.state) return { ...base, state: out.state, notes: [...notes, ...out.notes] };
  if (out.deprecated) deprecated = true;
  return { ...base, state: deprecated ? "deprecated" : "applied", notes: [...notes, ...out.notes], css: out.css };
}

function guessId(manifest) {
  try {
    const data = typeof manifest === "string" ? JSON.parse(manifest) : manifest;
    return typeof data?.id === "string" ? data.id : "unknown";
  } catch {
    return "unknown";
  }
}

/** Names listed in `touches` that the contract does not know. */
function missingTouches(touches, contract) {
  return touches.filter((t) => {
    if (t.startsWith("piece:")) return !contract.pieces?.[t.slice(6)];
    if (t.startsWith("zone:")) return !contract.zones?.[t.slice(5)];
    if (t.startsWith("--")) return !knownVariable(t, contract) && !contract.deprecated?.[t];
    return false;
  });
}

function knownVariable(name, contract) {
  return Boolean(contract.variables?.[name]) || Object.values(contract.roles ?? {}).includes(name) || name.startsWith("--mod-");
}

/** A mood: one color per role, written onto the app's own variables. */
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
  const decls = ROLES.map((r) => `${roles[r]}: ${colors[r]};`).join(" ");
  return { css: `:root { color-scheme: ${mood.scheme}; ${decls} }`, notes };
}

/** Contrast warnings for a mood, measured with the WCAG 2.2 formula. */
export function moodContrastNotes(colors) {
  const checks = [
    ["text", "background", 4.5],
    ["muted", "background", 4.5],
    ["accentText", "accent", 4.5],
    ["accent", "background", 3],
  ];
  return checks
    .map(([fg, bg, min]) => [fg, bg, min, contrast(colors[fg], colors[bg])])
    .filter(([, , min, ratio]) => ratio < min)
    .map(([fg, bg, min, ratio]) => `${fg} on ${bg} is ${ratio.toFixed(2)}:1, under ${min}:1`);
}

/** A style: through the gate, deprecated names rewritten, scoped away from the zones without mods. */
export function compileStyle(text, contract) {
  const gate = checkStyle(text);
  if (!gate.ok) return { state: "rejected", notes: gate.errors };
  let css = gate.css;
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
  const { hoisted, rest } = splitHoisted(css);
  // Inside @scope a selector only matches below the scope root, so `:root` would never match:
  // it becomes `:scope`, which is the root element itself.
  const body = rest.trim().replace(/:root(?![\w-])/g, ":scope");
  const scoped = body ? `@scope (:root) to (${NO_MODS}) {\n${body}\n}` : "";
  return { css: [hoisted, scoped].filter(Boolean).join("\n"), notes, deprecated };
}

/** A structure: order and hide pieces of a zone with CSS, never moving the app's DOM. */
export function compileStructure(text, contract) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { state: "rejected", notes: ["structure.json is not valid JSON"] };
  }
  const zones = data?.zones;
  if (!zones || typeof zones !== "object") return { state: "rejected", notes: ["structure.json needs zones"] };
  const rules = [];
  const problems = [];
  for (const [zone, spec] of Object.entries(zones)) {
    const known = contract.zones?.[zone];
    if (!known) {
      problems.push(`zone:${zone} is not in the app's contract`);
      continue;
    }
    const allowed = new Set(known.pieces ?? []);
    const order = Array.isArray(spec?.order) ? spec.order : [];
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

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Takes @font-face and @keyframes blocks out of the scope, where they would not work. */
export function splitHoisted(css) {
  const hoisted = [];
  let rest = "";
  let i = 0;
  while (i < css.length) {
    const at = /@(font-face|keyframes|-webkit-keyframes)\b/iy;
    at.lastIndex = i;
    if (css[i] === "@" && at.test(css)) {
      const open = css.indexOf("{", i);
      if (open === -1) break;
      let depth = 0;
      let j = open;
      for (; j < css.length; j++) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}" && --depth === 0) break;
      }
      hoisted.push(css.slice(i, j + 1).trim());
      i = j + 1;
      continue;
    }
    rest += css[i];
    i++;
  }
  return { hoisted: hoisted.join("\n"), rest };
}

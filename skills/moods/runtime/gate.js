// The gate for style mods: a style never loads anything and never runs code. See reference/format.md.
// The checks are strict on purpose: when in doubt, the file is refused and the person (or their
// agent) gets a reason they can act on.
import { walkStyle } from "./css.js";

export const MAX_STYLE_BYTES = 256 * 1024;

/** @type {[RegExp, string][]} */
const FORBIDDEN = [
  [/@import\b/i, "@import is not allowed: a style cannot load other files"],
  [/\bimage-set\s*\(/i, "image-set() is not allowed: it can load images from the network"],
  [/(^|[^-\w])src\s*\(/i, "src() is not allowed: it can load files"],
  [/\bexpression\s*\(/i, "expression() is not allowed"],
  [/javascript\s*:/i, "javascript: is not allowed"],
  [/\bbehavior\s*:/i, "behavior: is not allowed"],
  [/-moz-binding/i, "-moz-binding is not allowed"],
  [/<\//, "</ is not allowed inside a style"],
  [/@property\b/i, "@property is not allowed: it changes how the app's own variables behave"],
  [/@scope\b/i, "@scope is not allowed: the plugin already scopes every style away from the zones without mods"],
  [/@namespace\b/i, "@namespace is not allowed"],
];

/**
 * @param {unknown} css the text of style.css
 * @returns {{ ok: true, css: string } | { ok: false, errors: string[] }}
 */
export function checkStyle(css) {
  if (typeof css !== "string") return { ok: false, errors: ["style.css is missing"] };
  const bytes = new TextEncoder().encode(css).length;
  if (bytes > MAX_STYLE_BYTES) return { ok: false, errors: [`style.css is ${Math.round(bytes / 1024)} KB, the limit is 256 KB`] };
  /** @type {string[]} */
  const errors = [];
  if (css.includes("\\")) errors.push("backslashes are not allowed: CSS escapes could hide a forbidden word");
  // Comments separate tokens in CSS, so they are removed before looking for forbidden words.
  const text = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  if (text.includes("/*")) errors.push("a comment is not closed");
  for (const [pattern, reason] of FORBIDDEN) if (pattern.test(text)) errors.push(reason);
  for (const match of text.matchAll(/url\s*\(\s*(['"]?)\s*([^'")\s]*)/gi)) {
    const target = match[2].toLowerCase();
    if (!target.startsWith("data:") && !target.startsWith("#")) {
      errors.push(`url(${match[2] || "..."}) is not allowed: only data: URIs and #fragments`);
    }
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  // Well formed, read the way a browser reads it: no brace, string or parenthesis left open.
  const shape = walkStyle(text);
  return shape.ok ? { ok: true, css: text } : { ok: false, errors: shape.errors };
}

/**
 * The contract names a style uses: custom properties, pieces and zones.
 * @param {string} css
 */
export function namesInStyle(css) {
  const variables = new Set([...css.matchAll(/--[a-zA-Z0-9_-]+/g)].map((m) => m[0]));
  const pieces = new Set([...css.matchAll(/data-piece\s*[~|^$*]?=\s*(['"]?)([\w-]+)\1/g)].map((m) => m[2]));
  const zones = new Set([...css.matchAll(/data-zone\s*[~|^$*]?=\s*(['"]?)([\w-]+)\1/g)].map((m) => m[2]));
  return { variables, pieces, zones };
}

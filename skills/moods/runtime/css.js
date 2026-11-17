// A small reader for the CSS of a style mod. It runs after the gate has removed the comments and
// refused every backslash, so strings, parentheses and blocks are all there is to follow.
//
// It has to agree with the browser on where every block starts and ends: the plugin wraps each
// style in a scope that keeps it away from the zones without mods, and a brace the browser reads
// differently would close that scope early. Anything the two could read differently is refused.

const GROUP_RULES = new Set(["media", "supports", "container", "layer", "starting-style"]);
const HOISTED_RULES = new Set(["font-face", "keyframes", "-webkit-keyframes"]);
const LINE_BREAK = /[\n\r\f]/;
const URL_BODY = /^[ \t\n\r\f]*(?:"[^"\n\r\f]*"|'[^'\n\r\f]*'|[^ \t\n\r\f"'()]*)[ \t\n\r\f]*\)/;

/** @param {string} text */
const same = (text) => text;

/**
 * Reads a style and, on the way, lets the caller rewrite its selectors and its declarations.
 * `@font-face` and `@keyframes` come back apart, in `hoisted`: they only work outside a scope.
 *
 * @param {string} css text that already passed the gate's word checks
 * @param {{ selector?: (text: string) => string, declaration?: (text: string) => string }} [rewrite]
 * @returns {{ ok: true, css: string, hoisted: string } | { ok: false, errors: string[] }}
 */
export function walkStyle(css, { selector = same, declaration = same } = {}) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} closers of the ( and [ that are open, and of the { opened inside them */
  const open = [];
  /** @type {("style" | "group" | "raw")[]} the blocks open at rule level */
  const blocks = [];
  let out = "";
  let hoisted = "";
  let buf = "";
  /** Where a hoisted rule started in `out`, or -1. */
  let hoistFrom = -1;

  const raw = () => blocks.includes("raw");
  const inStyleRule = () => {
    for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i] !== "group") return blocks[i] === "style";
    return false;
  };
  const statement = () => {
    const text = buf.trim();
    buf = "";
    if (!text) return "";
    if (text.startsWith("@") || raw() || !inStyleRule() || !text.includes(":")) return text;
    return declaration(text);
  };
  const pad = () => "  ".repeat(blocks.length);

  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") {
      const end = css.indexOf(c, i + 1);
      const text = end === -1 ? "" : css.slice(i, end + 1);
      if (!text || LINE_BREAK.test(text)) return { ok: false, errors: ["a string is not closed on its own line"] };
      buf += text;
      i = end;
      continue;
    }
    if (c === "(") {
      // `url(` is the one function the browser reads with its own rules: only one plain value or
      // one quoted string is let through, so both readers see the same closing parenthesis.
      if (/(^|[^\w-])url$/i.test(css.slice(Math.max(0, i - 4), i))) {
        const body = URL_BODY.exec(css.slice(i + 1));
        if (!body) return { ok: false, errors: ["url() must hold one plain value or one quoted string"] };
        buf += c + body[0];
        i += body[0].length;
        continue;
      }
      open.push(")");
      buf += c;
      continue;
    }
    if (c === "[") {
      open.push("]");
      buf += c;
      continue;
    }
    if (open.length) {
      if (c === "{") open.push("}");
      else if (c === open[open.length - 1]) open.pop();
      buf += c;
      continue;
    }
    if (c === "{") {
      const head = buf.trim().replace(/\s+/g, " ");
      // A custom property may hold a whole block as its value: it stays part of the declaration.
      if (head.startsWith("--")) {
        open.push("}");
        buf += c;
        continue;
      }
      const at = /^@([\w-]+)/.exec(head);
      const name = at ? at[1].toLowerCase() : "";
      /** @type {"style" | "group" | "raw"} */
      const kind = !at ? "style" : GROUP_RULES.has(name) ? "group" : "raw";
      if (!blocks.length && HOISTED_RULES.has(name)) hoistFrom = out.length;
      out += `${pad()}${kind === "style" && !raw() ? selector(head) : head} {\n`;
      blocks.push(kind);
      buf = "";
      continue;
    }
    if (c === ";") {
      const text = statement();
      if (text) out += `${pad()}${text};\n`;
      continue;
    }
    if (c === "}") {
      if (!blocks.length) return { ok: false, errors: ["a } closes nothing"] };
      const text = statement();
      if (text) out += `${pad()}${text};\n`;
      blocks.pop();
      out += `${pad()}}\n`;
      if (!blocks.length && hoistFrom !== -1) {
        hoisted += out.slice(hoistFrom);
        out = out.slice(0, hoistFrom);
        hoistFrom = -1;
      }
      continue;
    }
    buf += c;
  }
  if (open.length) errors.push(`a ${open[open.length - 1] === ")" ? "(" : open[open.length - 1] === "]" ? "[" : "{"} is not closed`);
  if (blocks.length) errors.push("a { is not closed");
  if (errors.length) return { ok: false, errors };
  const tail = buf.trim();
  if (tail) out += `${tail}\n`;
  return { ok: true, css: out.trim(), hoisted: hoisted.trim() };
}

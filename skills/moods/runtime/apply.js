// Putting reviewed mods on a page. The only part of the plugin that touches the DOM.
import { review, roleVariables } from "./compile.js";

const ORDER = { mood: 0, style: 1, structure: 2 };
const MARK = "data-mods-runtime";

// What a zone without mods would otherwise inherit from an ancestor that a mod did change.
const INHERITED = [
  "color", "color-scheme", "accent-color", "caret-color", "cursor", "pointer-events", "visibility", "direction", "writing-mode",
  "font-family", "font-size", "font-weight", "font-style", "font-stretch", "font-variant-caps", "font-variant-numeric",
  "font-variant-ligatures", "font-kerning", "font-feature-settings", "font-variation-settings", "font-optical-sizing",
  "line-height", "letter-spacing", "word-spacing", "text-transform", "text-align", "text-indent", "text-shadow",
  "text-rendering", "white-space", "word-break", "overflow-wrap", "hyphens", "tab-size", "quotes", "list-style-type",
  "list-style-position", "-webkit-text-fill-color", "-webkit-text-stroke-width", "-webkit-text-stroke-color",
  "fill", "stroke", "stroke-width", "scrollbar-color",
];

/**
 * @typedef {import("./compile.js").Contract} Contract
 * @typedef {import("./compile.js").ModInput} ModInput
 * @typedef {import("./compile.js").Verdict} Verdict
 * @typedef {{ off?: boolean }} ApplyOptions `off`: review every mod but apply none (a start without mods).
 */

/**
 * Creates the mod host for one window.
 * @param {{ contract: Contract, document?: Document,
 *   onScheme?: (scheme: "dark" | "light" | null) => void }} options
 *   `onScheme` runs on every apply with the scheme of the mood that is on, or null: the app can put
 *   its own dark or light look underneath, so what the mood does not paint still matches.
 */
export function createModHost({ contract, document: doc = globalThis.document, onScheme }) {
  if (!doc) throw new Error("createModHost needs a document");
  const view = doc.defaultView;
  /** @type {{ mods: ModInput[], options: ApplyOptions } | null} */
  let last = null;
  /** @type {MutationObserver | null} */
  let observer = null;
  /** @type {MediaQueryList | null} */
  let media = null;
  let working = false;
  let timer = 0;
  let lastRefresh = 0;
  let inline = "";
  /** @type {Map<string, Verdict>} */
  let reviewed = new Map();

  const pinned = [...new Set([...Object.keys(contract.variables ?? {}), ...roleVariables(contract)])];

  function rootElement() {
    const selector = contract.root ?? ":root";
    return (selector === ":root" ? null : doc.querySelector(selector)) ?? doc.documentElement;
  }

  const ownStyles = () => /** @type {HTMLStyleElement[]} */ ([...doc.querySelectorAll(`style[${MARK}]`)]);

  function removeStyles() {
    for (const el of ownStyles()) el.remove();
  }

  /**
   * Puts these styles on the page, in this order. When they are the ones already there (the usual
   * case when the app only changed its own look), they are switched back on instead of parsed again.
   * @param {{ name: string, css: string }[]} wanted
   */
  function setStyles(wanted) {
    const current = ownStyles();
    const same = current.length === wanted.length
      && current.every((el, i) => el.getAttribute(MARK) === wanted[i].name && el.textContent === wanted[i].css);
    if (same) {
      for (const el of current) el.disabled = false;
      return;
    }
    removeStyles();
    for (const { name, css } of wanted) {
      const style = doc.createElement("style");
      style.setAttribute(MARK, name);
      style.textContent = css;
      doc.head.append(style);
    }
  }

  /**
   * What tells one review from another: the same mod, asked the same way, gets the same verdict,
   * so it is not reviewed twice.
   * @param {ModInput} mod
   * @param {boolean} off
   * @param {boolean} scope
   */
  function keyOf(mod, off, scope) {
    try {
      const manifest = typeof mod.manifest === "string" ? mod.manifest : JSON.stringify(mod.manifest);
      const files = Object.entries(mod.files ?? {}).map(([name, text]) => `${name}\n${text}`).join("\0");
      return [off ? 1 : 0, scope ? 1 : 0, mod.enabled === false ? 0 : 1, mod.error ?? "", mod.id ?? "", manifest, files].join("\0");
    } catch {
      return "";
    }
  }

  /**
   * The app's own values on each zone without mods, read while no mod is on the page: the
   * variables of the contract and what the zone inherits, so no mod reaches it through an ancestor.
   */
  function pinZonesWithoutMods() {
    if (!view) return "";
    const rules = [];
    for (const zone of contract.noMods ?? []) {
      for (const el of doc.querySelectorAll(`[data-no-mods="${zone}"]`)) {
        const computed = view.getComputedStyle(el);
        const decls = [];
        for (const name of [...pinned, ...INHERITED]) {
          const value = computed.getPropertyValue(name).trim();
          if (value) decls.push(`${name}: ${value};`);
        }
        rules.push(`[data-no-mods="${zone}"] { ${decls.join(" ")} }`);
        break;
      }
    }
    return rules.join("\n");
  }

  /** The inline values of the pinned variables on the root: when the app changes one, the pins are stale. */
  function inlineValues() {
    const style = /** @type {HTMLElement} */ (rootElement()).style;
    return style ? pinned.map((name) => style.getPropertyValue(name)).join("|") : "";
  }

  /** Looks again after the app changed its own look, at most four times a second. */
  function schedule() {
    if (working || timer || !last || !view) return;
    const wait = Math.max(0, 250 - (Date.now() - lastRefresh));
    timer = view.setTimeout(() => {
      timer = 0;
      refresh();
    }, wait);
  }

  function watch() {
    if (!view) return;
    if (!observer && typeof view.MutationObserver === "function") {
      observer = new view.MutationObserver((records) => {
        // A style attribute that changed nothing the pins hold (a scroll position, say) is skipped.
        const onlyStyle = records.every((r) => r.attributeName === "style");
        if (onlyStyle && inlineValues() === inline) return;
        schedule();
      });
      observer.observe(doc.documentElement, { attributes: true });
      const root = rootElement();
      if (root !== doc.documentElement) observer.observe(root, { attributes: true });
    }
    if (!media && typeof view.matchMedia === "function") {
      media = view.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", schedule);
    }
  }

  function unwatch() {
    observer?.disconnect();
    observer = null;
    media?.removeEventListener("change", schedule);
    media = null;
    if (timer && view) view.clearTimeout(timer);
    timer = 0;
  }

  /**
   * Reviews and applies a list of mods. Never throws because of a mod: a mod that fails is
   * skipped and reported.
   * @param {ModInput[]} mods
   * @param {ApplyOptions} [options]
   * @returns {Verdict[]}
   */
  function apply(mods, options = {}) {
    working = true;
    try {
      last = { mods, options };
      // Off, not out: the app shows its own look while the pins are read, and nothing is parsed twice.
      for (const el of ownStyles()) el.disabled = true;
      const scope = typeof (/** @type {any} */ (view)?.CSSScopeRule) === "function";
      /** @type {Map<string, Verdict>} */
      const seen = new Map();
      const verdicts = mods.map((mod) => {
        const key = keyOf(mod, Boolean(options.off), scope);
        let verdict = key ? reviewed.get(key) : undefined;
        if (!verdict) {
          try {
            verdict = review(mod, contract, { off: options.off, scope });
          } catch (error) {
            const id = typeof mod?.id === "string" ? mod.id : "unknown";
            const reason = error instanceof Error ? error.message : String(error);
            verdict = /** @type {Verdict} */ ({ id, name: id, type: "unknown", state: "rejected", notes: [`could not be read: ${reason}`] });
          }
        }
        if (key) seen.set(key, verdict);
        return verdict;
      });
      reviewed = seen;
      const live = verdicts
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => v.css && (v.state === "applied" || v.state === "deprecated"))
        .sort((a, b) => ORDER[/** @type {keyof typeof ORDER} */ (a.v.type)] - ORDER[/** @type {keyof typeof ORDER} */ (b.v.type)] || a.i - b.i);
      const scheme = live.filter(({ v }) => v.type === "mood").at(-1)?.v.scheme ?? null;
      if (onScheme) {
        try {
          onScheme(scheme);
        } catch {
          // The app's own callback failing is not a reason to leave the mods half applied.
        }
      }
      // The pins are read now: every mod is off the page and the app shows its own look.
      const pins = live.length ? pinZonesWithoutMods() : "";
      // One <style> per mod: nothing a mod holds can swallow the next one, or the pins.
      const wanted = live.map(({ v }) => ({ name: v.id, css: `/* ${v.type}: ${v.id} */\n${v.css}` }));
      if (pins) wanted.push({ name: "zones-without-mods", css: `/* zones without mods keep the app's own values */\n${pins}` });
      setStyles(wanted);
      inline = inlineValues();
      lastRefresh = Date.now();
      watch();
      return verdicts.map(({ css, ...rest }) => ({ ...rest, notes: [...rest.notes] }));
    } finally {
      observer?.takeRecords();
      working = false;
    }
  }

  /**
   * Applies the last list again. The plugin does it by itself when the system goes dark or light
   * and when the root element changes; call it after any other change to the app's own look.
   * @returns {Verdict[]}
   */
  function refresh() {
    return last ? apply(last.mods, last.options) : [];
  }

  /** Removes everything the plugin added: the app looks exactly as it ships. */
  function clear() {
    unwatch();
    last = null;
    reviewed = new Map();
    removeStyles();
    if (onScheme) {
      try {
        onScheme(null);
      } catch {
        // Same as in apply: the app's callback cannot break the way back.
      }
    }
  }

  return { apply, refresh, clear };
}

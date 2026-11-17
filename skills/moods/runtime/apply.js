// Putting reviewed mods on a page. The only part of the plugin that touches the DOM.
import { review } from "./compile.js";

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

  const pinned = [...new Set([...Object.keys(contract.variables ?? {}), ...Object.values(contract.roles ?? {})])];

  function rootElement() {
    const selector = contract.root ?? ":root";
    return (selector === ":root" ? null : doc.querySelector(selector)) ?? doc.documentElement;
  }

  function removeStyles() {
    for (const el of doc.querySelectorAll(`style[${MARK}]`)) el.remove();
  }

  /** @param {string} name @param {string} css */
  function addStyle(name, css) {
    const style = doc.createElement("style");
    style.setAttribute(MARK, name);
    style.textContent = css;
    doc.head.append(style);
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
      removeStyles();
      const scope = typeof (/** @type {any} */ (view)?.CSSScopeRule) === "function";
      const verdicts = mods.map((mod) => {
        try {
          return review(mod, contract, { off: options.off, scope });
        } catch (error) {
          const id = typeof mod?.id === "string" ? mod.id : "unknown";
          const reason = error instanceof Error ? error.message : String(error);
          return /** @type {Verdict} */ ({ id, name: id, type: "unknown", state: "rejected", notes: [`could not be read: ${reason}`] });
        }
      });
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
      for (const { v } of live) addStyle(v.id, `/* ${v.type}: ${v.id} */\n${v.css}`);
      if (pins) addStyle("zones-without-mods", `/* zones without mods keep the app's own values */\n${pins}`);
      inline = inlineValues();
      lastRefresh = Date.now();
      watch();
      return verdicts.map(({ css, ...rest }) => rest);
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

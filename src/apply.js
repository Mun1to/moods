// Putting reviewed mods on a page. The only part of the plugin that touches the DOM.
import { review } from "./compile.js";

const ORDER = { mood: 0, style: 1, structure: 2 };
const INHERITED = ["color", "color-scheme", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "word-spacing", "text-transform", "text-align", "direction", "visibility", "cursor"];

/**
 * Creates the mod host for one window.
 * @param {{ contract: import("./compile.js").Contract, document?: Document, styleId?: string }} options
 */
export function createModHost({ contract, document: doc = globalThis.document, styleId = "mods-runtime" }) {
  if (!doc) throw new Error("createModHost needs a document");

  /** Removes everything the plugin added: the app looks exactly as it ships. */
  function clear() {
    doc.getElementById(styleId)?.remove();
  }

  /**
   * The app's own values for every promised variable, read on each zone without mods, so no mod
   * reaches them, not even through inheritance.
   */
  function pinZonesWithoutMods() {
    const names = [...Object.keys(contract.variables ?? {}), ...Object.values(contract.roles ?? {})];
    const rules = [];
    for (const zone of contract.noMods ?? []) {
      const el = doc.querySelector(`[data-no-mods="${zone}"]`);
      if (!el) continue;
      const computed = doc.defaultView.getComputedStyle(el);
      const decls = names.map((n) => [n, computed.getPropertyValue(n).trim()]).filter(([, v]) => v).map(([n, v]) => `${n}: ${v};`);
      // Inherited properties arrive already computed from the ancestors a mod did change (the
      // text color of the body, for one), so they are pinned too, with the app's own values.
      for (const prop of INHERITED) {
        const value = computed.getPropertyValue(prop).trim();
        if (value) decls.push(`${prop}: ${value};`);
      }
      rules.push(`[data-no-mods="${zone}"] { ${decls.join(" ")} }`);
    }
    return rules.join("\n");
  }

  /**
   * Reviews and applies a list of mods. Never throws because of a mod: a mod that fails is
   * skipped and reported.
   * @param {import("./compile.js").ModInput[]} mods
   * @returns {import("./compile.js").Verdict[]}
   */
  function apply(mods) {
    clear();
    const verdicts = mods.map((mod) => {
      try {
        return review(mod, contract);
      } catch (error) {
        return { id: "unknown", name: "unknown", type: "unknown", state: "rejected", notes: [`could not be read: ${error?.message ?? error}`] };
      }
    });
    const live = verdicts
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v.css && (v.state === "applied" || v.state === "deprecated"))
      .sort((a, b) => ORDER[a.v.type] - ORDER[b.v.type] || a.i - b.i);
    const pins = pinZonesWithoutMods();
    if (live.length) {
      const style = doc.createElement("style");
      style.id = styleId;
      style.textContent = [
        ...live.map(({ v }) => `/* ${v.type}: ${v.id} */\n${v.css}`),
        pins ? `/* zones without mods keep the app's own values */\n${pins}` : "",
      ].filter(Boolean).join("\n\n");
      doc.head.append(style);
    }
    return verdicts.map(({ css, ...rest }) => rest);
  }

  return { apply, clear };
}

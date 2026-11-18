// <moods-panel>: the screen an app gives people for their mods. Pick a mood, switch each mod on or
// off, read why one does not apply, add one, and turn them all off. It finds the mods that
// `startMods` started in the same window, so the tag alone is enough.
import { modsOf } from "./start.js";
import { roleOf } from "./compile.js";
import { readManifest, FILE_FOR_TYPE } from "./manifest.js";

/** The words of the panel. An app in another language sets its own on `panel.words`. */
export const WORDS = {
  moods: "Mood",
  original: "Original",
  mods: "Mods",
  none: "No mods yet.",
  add: "Add a mod",
  remove: "Remove",
  reload: "Look again",
  openFolder: "Open the folder",
  folder: "Your mods live in",
  allOff: "Turn every mod off",
  allOn: "Turn mods back on",
  areOff: "Every mod is off.",
  safeStart: "The app started with every mod off.",
  deprecated: "On, but it needs an update:",
  broken: "Not applied, the app does not have that:",
  rejected: "Refused:",
  warning: "On, with a warning:",
  pick: "Choose mod.json and the file that goes with it.",
  added: "Added.",
};

const SWITCH_SIZE = "2.7em";
const SVG = "http://www.w3.org/2000/svg";

// The face of each built-in mood, in a 100 x 78 box: its eyes (a ring with a pupil, or a line) and
// its mouth. Any other mood gets the open eyes and the smile.
const FACES = /** @type {Record<string, { eyes: (string | [number, number])[], mouth: string | [number, number, number] }>} */ ({
  bright: { eyes: [[31.5, 30.5], [75.5, 30.5]], mouth: "M26 56 Q50 76 74 56" },
  calm: { eyes: ["M13 28 Q28 42 43 28", "M57 28 Q72 42 87 28"], mouth: "M36 58 Q50 67 64 58" },
  focus: { eyes: [[28, 28], [72, 28]], mouth: "M35 60 L65 60" },
  dream: { eyes: ["M13 32 Q28 22 43 32", "M57 32 Q72 22 87 32"], mouth: [50, 60, 7] },
});

/**
 * @param {string} id the mood
 * @param {string} ink the color of the eyes
 * @param {string} smile the color of the mouth
 */
function face(id, ink, smile) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "-6 -6 112 90");
  svg.setAttribute("aria-hidden", "true");
  /** @param {string} tag @param {Record<string, string | number>} attrs */
  const add = (tag, attrs) => {
    const el = document.createElementNS(SVG, tag);
    for (const [name, value] of Object.entries({ fill: "none", "stroke-width": 10, "stroke-linecap": "round", ...attrs })) el.setAttribute(name, String(value));
    svg.append(el);
  };
  const { eyes, mouth } = FACES[id] ?? FACES.bright;
  eyes.forEach((eye, i) => {
    if (typeof eye === "string") return add("path", { d: eye, stroke: ink });
    add("circle", { cx: i ? 72 : 28, cy: 28, r: 17, stroke: ink });
    add("circle", { cx: eye[0], cy: eye[1], r: 6.5, fill: ink, "stroke-width": 0 });
  });
  if (typeof mouth === "string") add("path", { d: mouth, stroke: smile });
  else add("circle", { cx: mouth[0], cy: mouth[1], r: mouth[2], stroke: smile, "stroke-width": 9 });
  return svg;
}

/**
 * @param {string} tag
 * @param {Record<string, string | boolean | ((event: Event) => void)>} [props]
 * @param {(Node | string | null | false)[]} children
 */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (typeof value === "function") el.addEventListener(name, value);
    else if (value === true) el.setAttribute(name, "");
    else if (value !== false) el.setAttribute(name, value);
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

/**
 * How the panel paints with a role of the app: through the app's own variable, so it follows the
 * app and the mood that is on.
 * @param {import("./compile.js").Contract} contract
 * @param {string} role
 * @param {string} fallback
 */
function paint(contract, role, fallback) {
  const found = roleOf(contract, role);
  if (!found) return fallback;
  if (found.as === "hsl") return `hsl(var(${found.variable}))`;
  if (found.as === "rgb" || found.as === "rgb-commas") return `rgb(var(${found.variable}))`;
  return `var(${found.variable}, ${fallback})`;
}

/** @param {import("./compile.js").Contract} contract */
function sheet(contract) {
  return `
:host { display: block; font: inherit; color: inherit; text-align: start;
  --_mp-line: ${paint(contract, "border", "color-mix(in srgb, currentColor 28%, transparent)")};
  --_mp-accent: ${paint(contract, "accent", "currentColor")};
  --_mp-on-accent: ${paint(contract, "accentText", "Canvas")}; }
* { box-sizing: border-box; }
h3 { margin: 0 0 .55em; font-size: 1.06em; font-weight: 700; }
p { margin: 0; }
button { font: inherit; color: inherit; cursor: pointer; }
button:focus-visible { outline: 3px solid var(--_mp-accent); outline-offset: 2px; }
.moods { display: flex; flex-wrap: wrap; gap: .6em; margin: 0 0 1.5em; }
.mood { flex: 1 1 calc((100% - (var(--columns, 5) - 1) * .6em) / var(--columns, 5)); min-width: 0; display: grid; gap: .45em; padding: .45em .45em .5em; text-align: start; font-weight: 600;
  background: none; border: 2px solid var(--_mp-line); border-radius: 6px; }
.mood[aria-pressed="true"] { border-color: var(--_mp-accent); }
.swatch { display: flex; align-items: center; height: 2.9em; padding: 0 .7em; border-radius: 3px; }
.swatch svg { height: 1.55em; width: auto; }
.own { background: linear-gradient(105deg, #fbfaf7 0 50%, #1c1b20 50% 100%); }
.list { margin: 0 0 1em; }
.mod { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .15em 1em; align-items: start;
  padding: .75em 0; border-top: 1px solid var(--_mp-line); }
.mod b { font-weight: 700; overflow-wrap: anywhere; }
.mod p { grid-column: 1; overflow-wrap: anywhere; }
.mod .side { grid-column: 2; grid-row: 1 / span 3; display: grid; gap: .5em; justify-items: end; }
.switch { position: relative; width: ${SWITCH_SIZE}; height: 1.55em; padding: 0; border-radius: 1em;
  border: 2px solid var(--_mp-line); background: none; }
.switch::after { content: ""; position: absolute; top: 50%; left: .2em; width: .9em; height: .9em;
  border-radius: 50%; background: currentColor; transform: translateY(-50%); transition: left .12s; }
.switch[aria-checked="true"] { background: var(--_mp-accent); border-color: var(--_mp-accent); }
.switch[aria-checked="true"]::after { left: calc(100% - 1.1em); background: var(--_mp-on-accent); }
.switch.idle { background: none; border-color: var(--_mp-line); }
.switch.idle::after { background: currentColor; }
.text { padding: 0; border: 0; background: none; text-decoration: underline; text-underline-offset: .2em; }
.foot { display: flex; flex-wrap: wrap; gap: .6em 1em; align-items: center; justify-content: space-between;
  padding-top: .9em; border-top: 1px solid var(--_mp-line); }
.foot .left { display: flex; flex-wrap: wrap; gap: .6em 1em; align-items: center; }
.plain { padding: .5em .9em; background: none; border: 2px solid var(--_mp-line); border-radius: 6px; font-weight: 600; }
.note { margin: 0 0 1em; font-weight: 600; }
.where { margin-top: .8em; overflow-wrap: anywhere; }
::slotted([slot="way-back"]) { padding: .5em .9em; border-radius: 6px; font: inherit; font-weight: 600; cursor: pointer;
  color: ${paint(contract, "text", "ButtonText")}; background: ${paint(contract, "surface", "ButtonFace")};
  border: 2px solid ${paint(contract, "border", "currentColor")}; }
input[type="file"] { display: none; }
`;
}

const Base = /** @type {typeof HTMLElement} */ (globalThis.HTMLElement ?? class {});

/** The panel. Use it as `<moods-panel></moods-panel>` once this file is imported. */
export class ModsPanel extends Base {
  constructor() {
    super();
    /** The words it shows: set any of them to translate the panel. */
    this.words = { ...WORDS };
    /** @type {import("./start.js").Mods | null} */
    this.mods = null;
    /** @type {(() => void) | null} */
    this.forget = null;
    this.message = "";
    this.ready = () => this.bind();
    /** @type {ResizeObserver | null} */
    this.sizes = null;
  }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.ownerDocument.addEventListener("mods:ready", this.ready);
    const Observer = this.ownerDocument.defaultView?.ResizeObserver;
    if (Observer && !this.sizes) {
      this.sizes = new Observer(() => this.fit());
      this.sizes.observe(this);
    }
    this.bind();
  }

  disconnectedCallback() {
    this.ownerDocument.removeEventListener("mods:ready", this.ready);
    this.sizes?.disconnect();
    this.sizes = null;
    this.forget?.();
    this.forget = null;
    this.mods = null;
  }

  /** How many moods go in a row: as many as fit, and never one left alone on the last row. */
  fit() {
    const row = /** @type {HTMLElement | null} */ (this.shadowRoot?.querySelector(".moods"));
    const view = this.ownerDocument.defaultView;
    if (!row || !view) return;
    const count = row.children.length;
    const em = parseFloat(view.getComputedStyle(row).fontSize) || 16;
    const fits = Math.max(1, Math.min(count, Math.floor((row.clientWidth + 0.6 * em) / (5.4 * em + 0.6 * em))));
    let columns = fits;
    while (columns > 2 && count % columns === 1) columns--;
    row.style.setProperty("--columns", String(columns));
  }

  bind() {
    const mods = modsOf(this.ownerDocument);
    if (mods === this.mods) return;
    this.forget?.();
    this.mods = mods;
    this.forget = mods ? mods.subscribe(() => this.render()) : null;
    this.render();
  }

  /** The button every mod is kept away from lives outside the shadow, where the app's pins reach it. */
  wayBack() {
    let button = /** @type {HTMLButtonElement | null} */ (this.querySelector('[slot="way-back"]'));
    if (!button) {
      button = /** @type {HTMLButtonElement} */ (h("button", { type: "button", slot: "way-back", "data-no-mods": "way-back" }));
      button.addEventListener("click", () => this.mods?.turnAllOff(!this.mods.allOff));
      this.append(button);
    }
    return button;
  }

  render() {
    const root = this.shadowRoot;
    const mods = this.mods;
    if (!root) return;
    if (!mods) {
      root.replaceChildren();
      return;
    }
    const w = this.words;
    const stopped = mods.allOff || mods.safeStart;
    const moods = mods.list.filter((m) => m.type === "mood");
    const others = mods.list.filter((m) => m.type !== "mood");

    const picker = h("div", { class: "moods", role: "group", "aria-label": w.moods },
      h("button", { class: "mood", type: "button", "data-key": "mood:", "aria-pressed": String(!mods.mood), click: () => mods.pickMood(null) },
        h("span", { class: "swatch own" }, face("", "#1c1b20", "#d9482b")), w.original),
      ...moods.map((mood) => {
        const c = mood.colors ?? {};
        const swatch = h("span", { class: "swatch" }, face(mood.id, c.text ?? "currentColor", c.accent ?? "currentColor"));
        swatch.style.background = c.background ?? "";
        return h("button", { class: "mood", type: "button", "data-key": `mood:${mood.id}`, "aria-pressed": String(mods.mood === mood.id),
          title: mood.notes.join(" "), click: () => mods.pickMood(mood.id) }, swatch, mood.name);
      }));

    const list = h("div", { class: "list" }, ...others.map((mod) => {
      // A mod that is simply on or off says nothing: the switch already shows it.
      const lead = mod.state === "applied" ? (mod.notes.length ? w.warning : "") : mod.state === "off" ? "" : w[mod.state];
      const says = lead && mod.notes.length ? `${lead} ${mod.notes.join("; ")}.` : lead;
      return h("div", { class: "mod" },
        h("b", {}, mod.name),
        mod.request ? h("p", {}, `“${mod.request}”`) : null,
        says ? h("p", { class: "says" }, says) : null,
        h("div", { class: "side" },
          // Switched on but not applied (the app changed, or the gate refused it): on, without the color.
          h("button", { class: mod.on && lead && mod.state !== "deprecated" && mod.state !== "applied" ? "switch idle" : "switch", type: "button",
            role: "switch", "data-key": `mod:${mod.id}`, "aria-checked": String(mod.on),
            "aria-label": mod.name, click: () => mods.turn(mod.id, !mod.on) }),
          mod.from === "browser"
            ? h("button", { class: "text", type: "button", "data-key": `remove:${mod.id}`, click: () => mods.remove(mod.id) }, w.remove)
            : null));
    }));

    const file = /** @type {HTMLInputElement} */ (h("input", { type: "file", multiple: true, accept: ".json,.css",
      change: () => void this.addFiles(file) }));
    const left = h("div", { class: "left" },
      mods.keeps ? h("button", { class: "plain", type: "button", "data-key": "add", click: () => file.click() }, w.add) : null,
      mods.keeps ? file : null,
      !mods.keeps ? h("button", { class: "plain", type: "button", "data-key": "reload", click: () => void mods.reload() }, w.reload) : null,
      mods.openFolder ? h("button", { class: "plain", type: "button", "data-key": "open", click: () => mods.openFolder?.() }, w.openFolder) : null);

    const button = this.wayBack();
    button.textContent = mods.allOff ? w.allOn : w.allOff;
    button.hidden = mods.safeStart;

    const status = [stopped ? (mods.safeStart ? w.safeStart : w.areOff) : "", this.message, mods.problem].filter(Boolean).join(" ");
    // Drawing again must not take the keyboard away from the control the person just used.
    const focused = /** @type {HTMLElement | null} */ (root.activeElement)?.dataset.key;
    root.replaceChildren(...[
      h("style", {}, sheet(mods.contract)),
      status ? h("p", { class: "note", role: "status" }, status) : null,
      h("h3", {}, w.moods), picker,
      h("h3", {}, w.mods),
      others.length ? list : h("p", { class: "list" }, w.none),
      h("div", { class: "foot" }, left, h("slot", { name: "way-back" })),
      mods.folder ? h("p", { class: "where" }, `${w.folder} ${mods.folder}`) : null,
    ].filter((node) => node !== null));
    this.fit();
    if (focused !== undefined) {
      [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll("[data-key]"))].find((el) => el.dataset.key === focused)?.focus();
    }
  }

  /**
   * Adds the mod in the files the person chose: its mod.json and the one file its type needs.
   * @param {HTMLInputElement} input
   */
  async addFiles(input) {
    const mods = this.mods;
    const chosen = [...(input.files ?? [])];
    input.value = "";
    if (!mods || !chosen.length) return;
    const texts = new Map(await Promise.all(chosen.map(async (f) => /** @type {[string, string]} */ ([f.name, await f.text()]))));
    const manifest = texts.get("mod.json");
    const read = readManifest(manifest ?? "");
    const name = read.ok ? FILE_FOR_TYPE[read.manifest.type] : "";
    if (!manifest || !read.ok || !texts.has(name)) {
      this.message = !manifest ? this.words.pick : read.ok ? `${this.words.rejected} ${name} is missing.` : `${this.words.rejected} ${read.errors.join("; ")}.`;
      this.render();
      return;
    }
    const row = mods.add({ id: read.manifest.id, manifest, files: { [name]: /** @type {string} */ (texts.get(name)) } });
    this.message = row && row.state === "rejected" ? `${this.words.rejected} ${row.notes.join("; ")}.` : this.words.added;
    this.render();
  }
}

if (globalThis.customElements && !globalThis.customElements.get("moods-panel")) {
  globalThis.customElements.define("moods-panel", ModsPanel);
}

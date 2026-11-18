// One call that does what every app needs: read the mods, remember what the person turned on and
// off, apply them, keep a way back, and tell the panel when something changes.
import { createModHost } from "./apply.js";
import { readManifest } from "./manifest.js";
import { MOODS } from "./moods.js";

/**
 * @typedef {import("./compile.js").Contract} Contract
 * @typedef {import("./compile.js").ModInput} ModInput
 * @typedef {import("./compile.js").Verdict} Verdict
 * @typedef {Verdict & { on: boolean, from: "app" | "folder" | "browser", colors?: Record<string, string>,
 *   family?: string, face?: string }} ModRow
 *   one mod as the panel shows it: its verdict, if it is switched on, where it comes from (shipped
 *   with the app, the person's folder, or kept in this browser) and, for a mood, its colors, the
 *   family it belongs to and its face
 * @typedef {{ list: ModRow[], mood: string | null, allOff: boolean, safeStart: boolean, keeps: boolean,
 *   problem: string, folder: string, contract: Contract,
 *   pickMood: (id: string | null) => void, turn: (id: string, on: boolean) => void,
 *   turnAllOff: (off: boolean) => void, add: (mod: ModInput) => ModRow | null, remove: (id: string) => void,
 *   reload: () => Promise<void>, openFolder?: () => void, subscribe: (fn: () => void) => () => void,
 *   stop: () => void }} Mods
 * @typedef {{ contract: Contract | string, mods?: ModInput[] | (() => ModInput[] | Promise<ModInput[]>),
 *   moods?: ModInput[], keep?: boolean, off?: boolean, folder?: string, openFolder?: () => void,
 *   onScheme?: (scheme: "dark" | "light" | null) => void, document?: Document,
 *   storage?: Pick<Storage, "getItem" | "setItem"> | null }} StartOptions
 */

/** @type {WeakMap<Document, Mods>} */
const started = new WeakMap();

/**
 * The mods of a window, once `startMods` ran in it. The panel finds them here.
 * @param {Document} [doc]
 * @returns {Mods | null}
 */
export function modsOf(doc = globalThis.document) {
  return (doc && started.get(doc)) || null;
}

/**
 * Starts mods in a window.
 *
 * @param {StartOptions} options
 *   `contract`: the app's contract, or the address of its `contract.json`.
 *   `mods`: the person's mods, read from their data folder by the app, as a list or as a function
 *   that reads them again (it runs at the start, on `reload()` and when the window gets the focus
 *   back). Leave it out in an app with no folder of its own: people then add mods in the panel and
 *   the browser keeps them.
 *   `moods`: the moods the app ships. The whole library unless told otherwise; `moodsFrom("Moods",
 *   "Catppuccin")` gives the ones of some families.
 *   `off`: start with every mod off, for the flag or the menu that is the way back. A web app gets
 *   the same from `?mods=off` in its address.
 *   `folder` and `openFolder`: where the person's mods live, for the panel to say and to open.
 * @returns {Promise<Mods>}
 */
export async function startMods(options) {
  const doc = options.document ?? globalThis.document;
  if (!doc) throw new Error("startMods needs a document");
  const view = doc.defaultView;
  const given = typeof options.contract === "string"
    ? /** @type {Contract} */ (await (await fetch(options.contract)).json())
    : options.contract;
  // The button that turns every mod off is always out of reach for every mod.
  const contract = { ...given, noMods: [...new Set([...(given.noMods ?? []), "way-back"])] };
  const source = options.mods;
  const keeps = options.keep ?? source === undefined;
  const moods = options.moods ?? MOODS;
  const key = `mods:${contract.app ?? "app"}`;
  const storage = options.storage === undefined ? safeStorage(view) : options.storage;
  const safeStart = Boolean(options.off) || flagInAddress(view);

  /** @type {{ mood: string | null, off: string[], allOff: boolean, own: ModInput[] }} */
  const saved = { mood: null, off: [], allOff: false, own: [] };
  try {
    const text = storage?.getItem(key);
    const data = text ? JSON.parse(text) : null;
    if (data && typeof data === "object") {
      if (typeof data.mood === "string") saved.mood = data.mood;
      if (Array.isArray(data.off)) saved.off = data.off.filter((/** @type {unknown} */ id) => typeof id === "string");
      saved.allOff = data.allOff === true;
      if (keeps && Array.isArray(data.own)) saved.own = data.own.filter((/** @type {unknown} */ m) => m && typeof m === "object");
    }
  } catch {
    // What was saved cannot be read: start as the first time.
  }

  const host = createModHost({ contract, document: doc, onScheme: options.onScheme });
  /** @type {Set<() => void>} */
  const listeners = new Set();
  /** @type {ModInput[]} */
  let fromFolder = [];
  /** @type {ModRow[]} */
  let rows = [];
  let problem = "";
  let stopped = false;

  function save() {
    try {
      storage?.setItem(key, JSON.stringify(saved));
    } catch {
      problem = "this browser has no room left to keep your mods";
    }
  }

  async function read() {
    if (typeof source !== "function") {
      fromFolder = source ?? [];
      return;
    }
    try {
      const list = await source();
      fromFolder = Array.isArray(list) ? list : [];
      problem = "";
    } catch (error) {
      problem = `the mods folder could not be read: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  function render() {
    // A mod of the person replaces one of the app with the same name: their choice wins.
    /** @type {Map<string, { mod: ModInput, from: ModRow["from"] }>} */
    const byId = new Map();
    for (const mod of moods) byId.set(idOf(mod), { mod, from: "app" });
    for (const mod of fromFolder) byId.set(idOf(mod), { mod, from: "folder" });
    for (const mod of saved.own) byId.set(idOf(mod), { mod, from: "browser" });
    const entries = [...byId].map(([id, entry]) => {
      const on = typeOf(entry.mod) === "mood" ? saved.mood === id : !saved.off.includes(id);
      return { ...entry, on };
    });
    const verdicts = host.apply(entries.map(({ mod, on }) => ({ ...mod, enabled: on })), { off: safeStart || saved.allOff });
    rows = verdicts.map((verdict, i) => {
      const { mod, from, on } = entries[i];
      const look = verdict.type === "mood" ? moodLook(mod) : {};
      return { ...verdict, on, from, ...look };
    });
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // One listener failing does not stop the others.
      }
    }
  }

  const onFocus = () => {
    if (!stopped && typeof source === "function" && doc.visibilityState !== "hidden") void mods.reload();
  };

  /** @type {Mods} */
  const mods = {
    get list() { return rows; },
    get mood() { return rows.some((r) => r.type === "mood" && r.id === saved.mood) ? saved.mood : null; },
    get allOff() { return saved.allOff; },
    get problem() { return problem; },
    safeStart,
    keeps,
    folder: options.folder ?? "",
    contract,
    ...(options.openFolder ? { openFolder: options.openFolder } : {}),
    pickMood(id) {
      saved.mood = id;
      save();
      render();
    },
    turn(id, on) {
      saved.off = saved.off.filter((other) => other !== id);
      if (!on) saved.off.push(id);
      save();
      render();
    },
    turnAllOff(off) {
      saved.allOff = off;
      save();
      render();
    },
    add(mod) {
      if (!keeps) return null;
      const id = idOf(mod);
      const before = saved.own;
      saved.own = [...before.filter((other) => idOf(other) !== id), mod];
      saved.off = saved.off.filter((other) => other !== id);
      render();
      const row = rows.find((r) => r.id === id) ?? null;
      // A mod the gate refuses is not kept: the person gets the reason and nothing stays behind.
      if (!row || row.state === "rejected") {
        saved.own = before;
        render();
        return row;
      }
      save();
      return row;
    },
    remove(id) {
      saved.own = saved.own.filter((mod) => idOf(mod) !== id);
      saved.off = saved.off.filter((other) => other !== id);
      if (saved.mood === id && !rows.some((r) => r.id === id && r.from !== "browser")) saved.mood = null;
      save();
      render();
    },
    async reload() {
      await read();
      if (!stopped) render();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    stop() {
      stopped = true;
      view?.removeEventListener("focus", onFocus);
      listeners.clear();
      host.clear();
      if (started.get(doc) === mods) started.delete(doc);
    },
  };

  await read();
  render();
  // The person's agent writes a mod while the app is open: coming back to the window shows it.
  view?.addEventListener("focus", onFocus);
  started.get(doc)?.stop();
  started.set(doc, mods);
  doc.dispatchEvent(new (view?.CustomEvent ?? CustomEvent)("mods:ready"));
  return mods;
}

/** @param {ModInput} mod */
function manifestOf(mod) {
  const read = readManifest(mod.manifest);
  return read.ok ? read.manifest : null;
}

/** @param {ModInput} mod */
function idOf(mod) {
  return manifestOf(mod)?.id ?? mod.id ?? "unknown";
}

/** @param {ModInput} mod */
function typeOf(mod) {
  return manifestOf(mod)?.type ?? "unknown";
}

/**
 * What the panel needs to draw a mood: its seven colors, its family and its face.
 * @param {ModInput} mod
 * @returns {{ colors?: Record<string, string>, family?: string, face?: string }}
 */
function moodLook(mod) {
  /** @type {{ colors?: Record<string, string>, family?: string, face?: string }} */
  const look = {};
  const family = manifestOf(mod)?.family;
  if (family) look.family = family;
  try {
    const mood = JSON.parse(mod.files?.["mood.json"] ?? "");
    if (typeof mood?.face === "string") look.face = mood.face;
    if (mood?.colors && typeof mood.colors === "object") {
      /** @type {Record<string, string>} */
      const safe = {};
      for (const [role, value] of Object.entries(mood.colors)) if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) safe[role] = value;
      look.colors = safe;
    }
  } catch {
    // A mood that cannot be read is drawn without its colors; its verdict already says why.
  }
  return look;
}

/** @param {(Window & typeof globalThis) | null} view */
function safeStorage(view) {
  try {
    return view?.localStorage ?? null;
  } catch {
    return null;
  }
}

/** @param {(Window & typeof globalThis) | null} view */
function flagInAddress(view) {
  try {
    return new URLSearchParams(view?.location.search ?? "").get("mods") === "off";
  } catch {
    return false;
  }
}

---
name: moods
description: Adds user mods to an open source app (moods, style mods and structure mods that survive every update), or makes a mod for an app that already supports them. Use it when a maintainer asks to "let users mod this app", "add themes or mods", "make the app customizable without forks", or when someone asks for a change to an app they use ("make the buttons rounder", "hide this", "a darker theme") and the app has a contract.json for mods.
---

# Mods for open source apps

Two jobs, one format. Everything they need is in this folder:

- `reference/format.md`: the format, the contract of an app and every rule. Read it first.
- `runtime/`: the plugin. Plain JavaScript modules, no dependencies, no build step. `index.js` is
  for the window; `node.js` reads and watches the mods folder from Node.
- `moods/`: four moods (Calm, Focus, Dream and Bright) to ship with the app.
- `templates/`: a starting `contract.json` and `MODS.md`, the guide an app gives to its users.
- `scripts/check.mjs`: checks mods against a contract without opening the app.

## Job 1: a maintainer wants their app to accept mods

1. **Find where the app paints.** The plugin works in any web window: Tauri, Electron, pywebview,
   an extension or a web app. Look at how the app sets its colors and sizes today (CSS variables,
   a theme attribute, inline styles): the plugin copes with all three.
2. **Copy `runtime/` into the app's source**, for example `src/mods/`. Do not edit it: an update
   of the plugin is copying the folder again.
3. **Write `contract.json`**, starting from `templates/contract.json`. List only what you promise
   to keep:
   - the seven mood roles (`background`, `surface`, `text`, `muted`, `accent`, `accentText`,
     `border`) mapped to the app's own variables, so every mood works;
   - the variables people may change, each with `since` and one line of `about`;
   - pieces: mark elements with `data-piece="name"`, never rely on class names;
   - zones: a flex or grid container with `data-zone="name"` whose children are pieces;
   - `noMods`: what no mod may touch (keys, permissions, payments, and the button that turns
     every mod off), each marked with `data-no-mods="name"`;
   - `root`, only if the app keeps its variables on an element that is not the page root.
   Version it with semver: adding is minor, deprecating is minor plus an alias, removing is major.
4. **Read the mods from the person's data folder, never the install folder.** One sub-folder per
   mod: read `mod.json` (64 KB at most) and the one file its type needs (256 KB at most), do not
   follow links, and hand the window `{ id, manifest, files }` for each.
   - On Node or Electron this is `readModsFolder(dir)` from `runtime/node.js`, and
     `watchModsFolder(dir, onChange)` tells you when to read again.
   - On Tauri, pywebview or anything else, read the folder in the backend and pass the same shape.
5. **Apply them after the first render:**
   ```js
   import { createModHost } from "./mods/index.js";

   const host = createModHost({
     contract,
     // Optional: put the app's own dark or light look under the mood that is on.
     onScheme: (scheme) => setAppTheme(scheme ?? systemTheme()),
   });
   const verdicts = host.apply(mods.map((mod) => ({ ...mod, enabled: !turnedOff.has(mod.id) })));
   ```
   `apply` never throws because of a mod. Call it again when a file changes. It looks again by
   itself when the system goes dark or light and when the root element changes; after any other
   change to the app's own look, call `host.refresh()`.
6. **Give people a screen for it:** a mood picker, every mod with its switch, its `request`, its
   state in words and its `notes` as they come (they say what to fix), and one button that turns
   every mod off. `examples/demo` in the plugin's repository is a full example.
7. **Give them a way back that no mod can break:** a start without mods from outside the window
   (a command-line flag, a menu or a tray item) that calls `host.apply(mods, { off: true })`.
8. **Ship the four moods** from `moods/` as built-in mods, and write `MODS.md` in the app's
   repository from `templates/MODS.md`, so anyone's agent can make a mod for the app.
9. **Close the network:** a Content Security Policy without remote images or fonts, as a second
   lock behind the plugin's gate.
10. **Check it:** `node scripts/check.mjs contract.json <a folder of example mods>`, try the four
    moods and one style mod in the running app, and update the app once with them on.

## Job 2: someone wants a mod for an app that supports them

1. **Read the app's `contract.json`** (and its `MODS.md`, if it has one). Only those names are
   safe to use.
2. **Pick the type:** `mood` for colors only, `style` for variables and pieces, `structure` to order
   or hide pieces of a zone.
3. **Create `<the app's data folder>/mods/<id>/`** with `mod.json`:
   ```json
   { "format": 1, "id": "rounder-corners", "name": "Rounder corners", "type": "style",
     "request": "<what the person asked, in their words>", "contract": "^1.1",
     "madeFor": "<app version>", "touches": ["--radius-button"] }
   ```
   and the file of its type: `mood.json`, `style.css` or `structure.json`. The folder name is the id.
4. **In `style.css`:** set variables on `:root`, select pieces with `[data-piece="name"]`, name your
   own helper variables `--mod-*`. No `!important` needed: a mod already wins over the app. Never
   `url()` (only `data:`), never `@import`, never a backslash: the gate refuses the whole file.
5. **Check it before opening the app:** `node scripts/check.mjs <contract.json> <the mod folder>`.
   `does not apply` and `refused` come with the reason: fix that and check again.
6. **After an app update,** if the mod `needs an update`, make it again from its `request` against
   the new contract.

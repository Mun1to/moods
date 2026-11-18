---
name: moods
description: Adds user mods to an open source app (moods, style mods and structure mods that survive every update), makes a mod for an app that already supports them, or turns the changes of a fork into mods. Use it when a maintainer asks to "let users mod this app", "add themes or mods", "make the app customizable without forks", when someone asks for a change to an app they use ("make the buttons rounder", "hide this", "a darker theme") and the app has a contract.json for mods, or when someone edited or forked such an app and wants to keep getting its updates.
---

# Mods for open source apps

Three jobs, one format. Everything they need is in this folder:

- `reference/format.md`: the format, the contract of an app and every rule. Read it first.
- `runtime/`: the plugin. Plain JavaScript modules, no dependencies, no build step. `index.js` is
  for the window; `node.js` reads and watches the mods folder from Node.
- `scripts/init.mjs`: gets an app ready in one go. `scripts/check.mjs`: checks mods against a
  contract without opening the app. `scripts/forks.mjs`: what the forks of an app changed.
- `templates/`: the folder readers for Tauri (`read_mods.rs`) and Python (`read_mods.py`), `MODS.md`
  (the guide an app gives its users), the note for coding agents and the text of a contract request.
- `library/`: example moods, one file per family (Catppuccin, Kanagawa and more), each with its
  source and its license. They are examples and nothing else: the plugin puts no mood in an app by
  itself. An app offers the ones it passes, changes them or brings its own. `CREDITS.md` there
  lists them all.

## Job 1: a maintainer wants their app to accept mods

1. **Run `node scripts/init.mjs <the app's folder>`** and read what it prints. It copies `runtime/`
   into the app (`src/mods/`), reads the app's styles to draft `contract.json`, writes `MODS.md`
   and adds a note to the app's `AGENTS.md` (and a `CLAUDE.md` that brings it in, because Claude
   Code does not read `AGENTS.md` by itself). Running it again updates the plugin and keeps what
   the maintainer edited. `--dry-run` only says what it would do.
2. **Go through the drafted `contract.json` with the maintainer.** Every name in it is a promise:
   take out what they would not keep.
   - The seven mood roles (`background`, `surface`, `text`, `muted`, `accent`, `accentText`,
     `border`) must all be mapped, or no mood works. For a role `init` could not find, give that
     color a variable in the app's styles, use it where the color is painted, and map it. If the
     app keeps only channels (`--background: 0 0% 100%`), the role says so: see the format.
   - Pieces: put `data-piece="name"` on the parts people may restyle, never rely on class names.
   - Zones: a flex or grid container with `data-zone="name"` whose children are pieces.
   - `noMods`: what no mod may touch (keys, permissions, payments), each marked with
     `data-no-mods="name"`.
   - `root`, only if the app keeps its variables on an element that is not the page root.
   Version it with semver: adding is minor, deprecating is minor plus an alias, removing is major.
3. **Start it where the app starts its window**, after the first render:
   ```js
   import { startMods } from "./mods/index.js";
   import contract from "./mods/contract.json";

   await startMods({ contract });
   ```
   That loads the person's mods, remembers what they turned on and applies it. The plugin has no
   moods of its own, so the app offers none until it passes some in `moods`: its own (a mood is
   seven colors), or the examples that come along, with `moods: EXAMPLES` for all of them or
   `moods: moodsFrom("Moods", "Catppuccin")` for some families. Ask the maintainer which, if any:
   do not decide the look of their app for them. With more than one family the panel shows one at
   a time, and with no moods it has no mood section. Add
   `onScheme: (scheme) => setAppTheme(scheme ?? systemTheme())` when the app has its own dark and
   light looks, so the right one sits under the mood that is on.
4. **Give it the person's mods folder**, in their data folder, never in the install folder:
   - Tauri: copy `templates/read_mods.rs` (its first lines say how) and pass
     `mods: () => invoke("read_mods")`.
   - Python (pywebview): `templates/read_mods.py`, exposed to the window, passed the same way.
   - Node or Electron: `readModsFolder(dir)` from `runtime/node.js`; `watchModsFolder(dir, onChange)`
     says when to call `mods.reload()`.
   - A web app with no folder: nothing to do. People add mods in the panel and the browser keeps them.
   Pass `folder` (and `openFolder`) too, so the panel can say where the mods live. The plugin reads
   the folder again when the window gets the focus back: an agent writes a mod, the person returns
   to the app and it is on.
5. **Put the panel in the app's settings:** `<moods-panel></moods-panel>`. It lists the moods the
   app offers and the mods with their switches, says in words why one does not apply, and has the button that
   turns them all off. Its words are in `panel.words`, to translate.
6. **Give people a way back that no mod can break:** a start without mods from outside the window
   (a command-line flag, a menu or a tray item) that passes `off: true` to `startMods`. A web app
   already has one: `?mods=off` in its address.
7. **Fill the blanks of `MODS.md`** (they are between `<` and `>`), above all where the mods
   folder is, and leave the note in `AGENTS.md`: it is what makes the agent of someone who wants
   the app their way write a mod instead of editing the app. Try it: in a fresh session of an
   agent inside the app, ask for "rounder corners for me" and see that it writes a mod.
8. **Close the network:** a Content Security Policy without remote images or fonts, as a second
   lock behind the plugin's gate.
9. **Check it:** `node scripts/check.mjs <contract.json> <a folder of example mods>`, try a light
   mood, a dark one and one style mod in the running app, and update the app once with them on.

To choose what the contract offers first, `node scripts/forks.mjs <owner/repo>` lists what the
forks of the app changed most: the style files and the variables they kept editing.

## Job 2: someone wants a mod for an app that supports them

1. **Read the app's `contract.json`** (and its `MODS.md`, if it has one). Only those names are
   safe to use.
2. **Pick the type:** `mood` for colors only, `style` for variables and pieces, `structure` to order
   or hide pieces of a zone.
3. **Create `<the app's mods folder>/<id>/`** with `mod.json`:
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
6. **If the contract has no name for what they want, do not edit the app.** Say what is missing and
   write the request for the maintainer from `templates/contract-request.md`. Editing the source is
   a fork: it works today and loses every update.
7. **After an app update,** if the mod `needs an update`, make it again from its `request` against
   the new contract.

## Job 3: someone edited or forked the app, and wants its updates back

1. **See what they changed:** the diff of their copy against the app it came from
   (`git diff <upstream>...HEAD --stat`, then the style and screen files).
2. **Sort every change.** Colors, letter, sizes and corners become a mood or a style mod, with the
   names of the contract. Order and what shows become a structure mod. Behavior cannot be a mod
   yet: say so plainly. For what has no name in the contract, write a contract request.
3. **Write the mods and check them** with `scripts/check.mjs`.
4. **Ask before touching their copy.** With their yes, put it back on the app's own code, turn the
   mods on, and compare with them what looks the same and what did not make it.

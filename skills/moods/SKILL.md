---
name: moods
description: Adds user mods to an open source app (moods, style mods and structure mods that survive every update), or makes a mod for an app that already supports them. Use it when a maintainer asks to "let users mod this app", "add themes or mods", "make the app customizable without forks", or when someone asks for a change to an app they use ("make the buttons rounder", "hide this", "a darker theme") and the app has a contract.json for mods.
---

# Mods for open source apps

Two jobs, one format (`docs/format.md` in the plugin). Read that page first: it is the contract.

## Job 1: a maintainer wants their app to accept mods

1. **Find where the app paints.** The plugin works in any web window: Tauri, Electron, pywebview,
   an extension or a web app.
2. **Write `contract.json`.** List only what you promise to keep:
   - the CSS variables people may change, each with `since` and one line of `about`;
   - the seven mood roles (`background`, `surface`, `text`, `muted`, `accent`, `accentText`,
     `border`) mapped to your own variables, so every mood works in your app;
   - pieces: mark elements with `data-piece="name"`, never rely on class names;
   - zones: a flex or grid container with `data-zone="name"` whose children are pieces;
   - `noMods`: mark what no mod may touch (keys, permissions, payments) with `data-no-mods="name"`.
   Version it with semver: adding is minor, deprecating is minor plus an alias, removing is major.
3. **Load the mods from the user's data folder, never the install folder.** For each folder read
   `mod.json` and the one file its type needs, then, after the first render:
   ```js
   import { createModHost } from "<the plugin>";
   const host = createModHost({ contract });
   const verdicts = host.apply(mods); // [{ id, state, notes }]
   ```
   Call `apply` again when a file changes. It never throws because of a mod.
4. **Give people a screen for it:** a mood picker, every mod with its switch, its `request` and its
   state in words, and one button that turns every mod off. Show `notes` as they come: they say
   what to fix.
5. **Close the network:** a Content Security Policy without remote images or fonts, as a second lock
   behind the plugin's gate.
6. **Check it:** run the plugin's tests, put the four built-in moods and one style mod in, and
   update the app once with them on.

## Job 2: someone wants a mod for an app that supports them

1. **Read the app's `contract.json`.** Only those names are safe to use.
2. **Pick the type:** `mood` for colors only, `style` for variables and pieces, `structure` to order
   or hide pieces of a zone.
3. **Create `<the app's data folder>/mods/<id>/`** with `mod.json`:
   ```json
   { "format": 1, "id": "rounder-corners", "name": "Rounder corners", "type": "style",
     "request": "<what the person asked, in their words>", "contract": "^1.1",
     "madeFor": "<app version>", "touches": ["--radius-button"] }
   ```
   and the file of its type: `mood.json`, `style.css` or `structure.json`.
4. **In `style.css`:** set variables on `:root`, select pieces with `[data-piece="name"]`, name your
   own helper variables `--mod-*`. Never `url()` (only `data:`), never `@import`, never a backslash:
   the gate refuses the whole file.
5. **Check the state the app shows.** `broken` or `rejected` come with the reason: fix that and save
   again. `deprecated` still works; update it when there is time.
6. **After an app update,** if the mod needs an update, redo it from its `request` against the new
   contract.

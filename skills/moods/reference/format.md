# The mod format, version 1

A mod is a folder that a person keeps next to an app, outside its install folder, so updates
never touch it. The app reads the folder, checks every mod and applies the ones that pass.
This page is the contract between three parties: the app that adopts the plugin, the person
who makes a mod (usually by asking their coding agent), and the plugin in between.

Draft: nothing here is frozen until the first mod is published.

## Where mods live

```
<the app's data folder>/mods/
  calm/                 type "mood":      mod.json + mood.json
  rounder-buttons/      type "style":     mod.json + style.css
  sidebar-order/        type "structure": mod.json + structure.json
```

The app decides the data folder (for example `%APPDATA%\<app>` on Windows). Never the install
folder: an update replaces it.

## `mod.json`

```json
{
  "format": 1,
  "id": "rounder-buttons",
  "name": "Rounder buttons",
  "type": "style",
  "request": "make the buttons rounder",
  "contract": "^1.0",
  "madeFor": "3.9.0",
  "touches": ["--radius-button", "piece:toolbar"]
}
```

| Key | Required | What it is |
|---|---|---|
| `format` | yes | The version of this file's shape. Always `1` for now. |
| `id` | yes | Lowercase letters, digits and dashes, the same as the folder name. |
| `type` | yes | `mood`, `style` or `structure`. One mod, one type. `function` is reserved for later. |
| `request` | yes | What the person asked for, in their words. An agent can redo the mod from it when the app changes. |
| `contract` | yes | The range of the app contract the mod was made against, in semver (`^1.0`, `~1.2`, `1.2.0`, `>=1.1`). |
| `name` | no | The name shown in the app. Defaults to the id. |
| `family` | no | For a mood: the family it belongs to, as the app shows it (`"Catppuccin"`). The panel groups moods by it. |
| `madeFor` | no | The app version it was made on. Information only. |
| `touches` | no | The contract names the mod relies on: variables (`--name`), pieces (`piece:name`) and zones (`zone:name`). |

## The three types

### `mood`: a palette, no code

`mood.json` gives a color to each role. Every app that adopts the plugin maps these roles to its
own variables, so one mood works in every app.

```json
{
  "scheme": "dark",
  "colors": {
    "background": "#102126",
    "surface": "#17323B",
    "text": "#DCEFEF",
    "muted": "#7FA3A6",
    "accent": "#6FD3C5",
    "accentText": "#0B1F1D",
    "border": "#24464F"
  }
}
```

All seven roles are required and every value is `#RRGGBB`. The plugin measures contrast with the
WCAG 2.2 formula and warns when `text` or `muted` on `background`, or `accentText` on `accent`,
falls under 4.5:1, or `accent` on `background` under 3:1.

`scheme` says if the mood is `dark` or `light`. The app can put its own dark or light look under
the mood, so what the seven colors do not paint (shadows, pictures, the zones without mods) still
matches.

A mood can also say `"face"`: `bright`, `calm`, `focus` or `dream`, the face the panel draws on it.

The plugin comes with example moods, grouped in families: the files in `library/`, one per
family, each with its source and its license. They are examples, not a fixed set. `MOODS` is the
four of the plugin, `EXAMPLES` every example and `moodsFrom("Moods", "Catppuccin")` the ones of some
families, for `startMods({ contract, moods })`.

### `style`: CSS against names the app promises

`style.css` changes the app through the variables and pieces of its contract:

```css
:root { --radius-button: 14px; }
[data-piece="toolbar"] { gap: 12px; }
```

Set variables on `:root` and select pieces with `[data-piece="name"]`. Your own helper variables
start with `--mod-`. Any other name the contract does not have stops the mod, with the reason.

It never loads anything and never runs code. The plugin refuses the whole file if it finds:

- `@import`, or `url(` with anything but a `data:` URI or a `#fragment`;
- `image-set(`, `src(`, `expression(`, `javascript:`, `behavior:` or `-moz-binding`;
- `@property`, `@scope` or `@namespace`;
- a backslash (CSS escapes could hide any of the above) or `</`;
- a brace, a parenthesis, a string or a comment left open, a `}` that closes nothing, or a `url()`
  that holds more than one plain value or one quoted string;
- more than 256 KB.

The file has to be well formed because the plugin wraps every style in a scope that keeps it out
of the zones without mods, and a stray brace would close that scope early.

A style mod wins over the app's own styles: the plugin makes each of its declarations
`!important`, so a more specific selector or an inline style in the app does not beat it.
`@font-face` and `@keyframes` are kept as they are, outside the scope.

A style mod that uses a deprecated name still works: the plugin rewrites it to the new name and
marks the mod `deprecated`, so the person (or their agent) can update it calmly.

### `structure`: order and hide pieces, no CSS

```json
{ "zones": { "sidebar": { "order": ["agenda", "projects"], "hidden": ["usage"] } } }
```

A zone is an element marked `data-zone="sidebar"` whose children are marked
`data-piece="agenda"` and so on. The plugin turns this into CSS `order` and `display: none`, so
the app's own DOM is never moved. Zones must be flex or grid containers.

## The contract of an app

The app ships a `contract.json`. It lists the names it promises to keep, each with the contract
version that added it:

```json
{
  "contract": "1.2.0",
  "app": "Example",
  "roles": {
    "background": "--bg", "surface": "--panel", "text": "--fg", "muted": "--fg-muted",
    "accent": "--accent", "accentText": "--on-accent", "border": "--line"
  },
  "variables": { "--radius-button": { "since": "1.0.0", "about": "corner of every button" } },
  "pieces": { "toolbar": { "since": "1.0.0" } },
  "zones": { "sidebar": { "since": "1.1.0", "pieces": ["projects", "agenda", "usage"] } },
  "deprecated": { "--r-button": { "use": "--radius-button", "since": "1.1.0" } },
  "noMods": ["keys"]
}
```

Versioning follows semver: adding a name is a minor version; deprecating one is a minor version
and keeps an alias for a whole major version; removing or changing one is a major version.

A role is the name of the app's variable. Many apps keep only the channels of a color in a variable
and wrap them where they use it, as in `hsl(var(--background))`. Those apps say how, and every mood
is written that way:

```json
"background": { "variable": "--background", "as": "hsl" }
```

| `as` | What the plugin writes for `#102126` | For an app that uses it as |
|---|---|---|
| `hex`, or nothing | `#102126` | `var(--background)` |
| `hsl` | `193.6 40.7% 10.6%` | `hsl(var(--background))` |
| `rgb` | `16 33 38` | `rgb(var(--background))` |
| `rgb-commas` | `16, 33, 38` | `rgba(var(--background), 1)` |

`root` is optional: the selector of the element that carries the app's variables, when it is not
the root of the page (`"root": "body"`, for example). Moods are written there and styles are
scoped from there.

`noMods` lists zones no mod can reach (`data-no-mods="keys"` on their root element): the plugin
keeps their variables and what they inherit (color, letter, cursor) at the app's own values, and
scopes every style mod away from them. Inside such a zone, use the variables of the contract or
plain values. This protects against accidents. A hostile style can still hide or cover things around a protected
zone, so what a person must never be tricked about (keys, permissions, payments) also needs to be
checked outside the window.

## What the plugin reports for each mod

| State | Meaning |
|---|---|
| `applied` | Passed every check and is on. |
| `deprecated` | On, but it uses a deprecated name or was made for another contract range: it should be updated. |
| `broken` | It touches a name the contract does not have. Not applied. |
| `rejected` | Invalid file or refused by the gate. Not applied. |
| `off` | The person turned it off. |

Each state comes with notes in plain words: what was refused and why, which name is deprecated
and what to use, or a contrast warning for a mood.

The app never breaks because of a mod: a mod that fails is skipped and reported, and the person
can always start the app with every mod off.

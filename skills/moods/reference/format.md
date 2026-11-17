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

### `style`: CSS against names the app promises

`style.css` changes the app through the variables and pieces of its contract:

```css
:root { --radius-button: 14px; }
[data-piece="toolbar"] { gap: 12px; }
```

It never loads anything and never runs code. The plugin refuses the whole file if it finds:

- `@import`, or `url(` with anything but a `data:` URI or a `#fragment`;
- `image-set(`, `src(`, `expression(`, `javascript:`, `behavior:` or `-moz-binding`;
- a backslash (CSS escapes could hide any of the above) or `</`;
- more than 256 KB.

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

`noMods` lists zones no mod can reach (`data-no-mods="keys"` on their root element): the plugin
keeps their variables at the app's own values and scopes every style mod away from them. This
protects against accidents. A hostile style can still hide or cover things around a protected
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

The app never breaks because of a mod: a mod that fails is skipped and reported, and the person
can always start the app with every mod off.

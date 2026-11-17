# Mods for <App>

<App> can be changed without touching its code: its colors, its letter, its corners and the order
of some of its parts. A change is a mod, a small folder you keep next to the app. Updates never
touch it.

## Where mods live

`<the data folder of the app, for example %APPDATA%\App\mods on Windows>`

One folder per mod. In the app, **<Settings > Mods>** lists them, says if each one is on and why
not when it is not, and has a button that turns them all off.

## The easy way: ask your coding agent

Open your agent in the mods folder and say what you want in your own words, for example
"make the buttons rounder". Give it this file and the app's
[`contract.json`](<link to contract.json>): together they are all it needs.

## By hand

A mod is a `mod.json` and one more file. This one makes the buttons rounder:

`rounder-buttons/mod.json`

```json
{
  "format": 1,
  "id": "rounder-buttons",
  "name": "Rounder buttons",
  "type": "style",
  "request": "Make the buttons rounder.",
  "contract": "^<the contract version, for example 1.0>"
}
```

`rounder-buttons/style.css`

```css
:root {
  --radius-button: 14px;
}
```

There are three kinds: `mood` (seven colors, in `mood.json`), `style` (CSS, in `style.css`) and
`structure` (order or hide parts, in `structure.json`). The names a mod may use are the ones in
`contract.json`: any other name stops the mod, and the app says which one.

## What a mod cannot do

- Load anything from the internet or run code.
- Touch <the parts the app keeps for itself: keys, permissions, payments>.

## If something looks wrong

Turn every mod off in **<Settings > Mods>**, or start the app with <the flag or menu that starts
it without mods>.

<App> uses [the mods plugin](<link to the plugin>) and its
[mod format](<link to the format>).

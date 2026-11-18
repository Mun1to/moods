# Contributing

The easiest way in is a mood: seven colors in a file. The moods here are examples, not a fixed
set, so nobody has to approve your taste. A check reads the colors, and what passes can ship.

## Add a mood

1. **Open [`skills/moods/library/`](skills/moods/library).** There is one file per family. Add your
   mood to the family it belongs to, or make a new file for a new family (the file name is the
   family in lowercase, like `catppuccin.json`).

   ```json
   {
     "name": "Catppuccin",
     "about": "Soothing pastel colors: one light flavor and three dark ones.",
     "source": "https://github.com/catppuccin/palette",
     "license": "MIT",
     "copyright": "Copyright (c) 2021 Catppuccin",
     "moods": [
       {
         "id": "catppuccin-latte",
         "name": "Latte",
         "scheme": "light",
         "face": "bright",
         "colors": {
           "background": "#eff1f5", "surface": "#e6e9ef", "text": "#4c4f69", "muted": "#5c5f77",
           "accent": "#8839ef", "accentText": "#eff1f5", "border": "#bcc0cc"
         }
       }
     ]
   }
   ```

2. **Run `pnpm moods`.** It checks every mood and writes what the plugin ships. When a mood does
   not pass, it says which one and why, and writes nothing.
3. **Look at it:** `pnpm demo`, then open `/examples/library/` at the address it prints. Click your
   mood and the whole page wears it.
4. **Open a pull request.** `pnpm test` runs the same check there.

### The seven colors

| Role | What it paints |
|---|---|
| `background` | The page behind everything. |
| `surface` | Panels, cards and fields. |
| `text` | What people read. |
| `muted` | Quieter text: a hint, a date, a task that is done. |
| `accent` | The main button, a link, the switch that is on. |
| `accentText` | The text on top of the accent. |
| `border` | Lines and the edge of a field. |

`scheme` is `light` or `dark`. `face` is the face the panel draws on the mood: `bright`, `calm`,
`focus` or `dream`. Pick the one that feels like your colors.

### What the check asks for

| It measures | It needs |
|---|---|
| `text` on `background`, and on `surface` | 4.5:1 or more |
| `muted` on `background`, and on `surface` | 4.5:1 or more |
| `accentText` on `accent` | 4.5:1 or more |
| `accent` on `background` | 3:1 or more |
| `border` on `background` | 1.2:1 or more, so the lines show |

Contrast is the WCAG 2.2 formula. The check also wants an `id` that starts with the family (as in
`catppuccin-latte`), a `scheme` that tells the truth, and seven colors no other mood already has.

### Colors that come from another project

Many good palettes are open. To bring one in:

- `source` is the address of the project itself, not of a copy.
- `license` is what the project says there, read in its license file. Today the library takes
  `MIT`. For another open license, open an issue with the link and it gets added.
- `copyright` is the copyright line of that license file, letter by letter.

`pnpm moods` writes them into [`CREDITS.md`](skills/moods/library/CREDITS.md) and into the file
every app copies, so the notice travels with the colors. The colors of a company's brand are not
a palette to bring in: make your own mood instead.

## Everything else

```sh
pnpm install
pnpm test     # the rules of the format and the tests in a real browser
pnpm check    # the types
pnpm demo     # the example apps and the library, on this computer
```

The plugin is plain JavaScript with JSDoc: no dependencies and nothing to build. A change to what
a mod can do starts in [`skills/moods/reference/format.md`](skills/moods/reference/format.md), with
a test for each rule in [`test/`](test).

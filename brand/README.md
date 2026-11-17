# Brand

The wordmark, the faces and the app icon. Open [index.html](index.html) in a browser to see every mark at real size.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="wordmark/wordmark-dark.svg">
  <img src="wordmark/wordmark.svg" alt="The wordmark" height="96">
</picture>

## Colors

| Name | Hex | Use |
|---|---|---|
| Ink | `#1E1B24` | Letters and eyes on light backgrounds |
| Coral | `#F0603F` | The smile, on every background |
| Cream | `#FFF8EF` | Light background |
| Night | `#15131B` | Dark background |
| Snow | `#F7F4FA` | Letters and eyes on dark backgrounds |

Contrast, measured with the WCAG 2.2 formula:

- Ink on Cream: **16.1:1**, good for any text
- Snow on Night: **16.8:1**, good for any text
- Coral on Night: **5.6:1**, good for body text
- Coral on Cream: **3.0:1**, good for large text and shapes

## Use it well

- Keep the smile coral. Only a one-ink print changes it.
- Leave clear space around the logo: at least the height of an “o” on every side.
- Never put the logo in a box, a circle or a badge. It stands on its own.
- Never stretch, rotate or redraw it. Use the files.
- Smallest sizes: the wordmark 24 px tall, the icon 16 px.
- On dark backgrounds use the dark files. On a photo, use the one that stands out more.

## Files

### Wordmark

- [`wordmark/wordmark.svg`](wordmark/wordmark.svg): Wordmark for light backgrounds (4.0 KB)
- [`wordmark/wordmark-dark.svg`](wordmark/wordmark-dark.svg): Wordmark for dark backgrounds (4.0 KB)
- [`wordmark/wordmark-black.svg`](wordmark/wordmark-black.svg): Wordmark one ink, black (4.0 KB)
- [`wordmark/wordmark-white.svg`](wordmark/wordmark-white.svg): Wordmark one ink, white (4.0 KB)

### Symbol

- [`symbol/symbol.svg`](symbol/symbol.svg): Symbol for light backgrounds (529 B)
- [`symbol/symbol-dark.svg`](symbol/symbol-dark.svg): Symbol for dark backgrounds (529 B)
- [`symbol/symbol-black.svg`](symbol/symbol-black.svg): Symbol one ink, black (529 B)
- [`symbol/symbol-white.svg`](symbol/symbol-white.svg): Symbol one ink, white (529 B)

### Faces

- [`faces/bright.svg`](faces/bright.svg): Bright face for light backgrounds (541 B)
- [`faces/bright-dark.svg`](faces/bright-dark.svg): Bright face for dark backgrounds (541 B)
- [`faces/calm.svg`](faces/calm.svg): Calm face for light backgrounds (525 B)
- [`faces/calm-dark.svg`](faces/calm-dark.svg): Calm face for dark backgrounds (525 B)
- [`faces/focus.svg`](faces/focus.svg): Focus face for light backgrounds (525 B)
- [`faces/focus-dark.svg`](faces/focus-dark.svg): Focus face for dark backgrounds (525 B)
- [`faces/dream.svg`](faces/dream.svg): Dream face for light backgrounds (479 B)
- [`faces/dream-dark.svg`](faces/dream-dark.svg): Dream face for dark backgrounds (479 B)

### App icon

- [`icons/icon.svg`](icons/icon.svg): App icon, any background (627 B)
- [`icons/icon-16.png`](icons/icon-16.png): App icon, 16 × 16 (516 B)
- [`icons/icon-24.png`](icons/icon-24.png): App icon, 24 × 24 (886 B)
- [`icons/icon-32.png`](icons/icon-32.png): App icon, 32 × 32 (1.1 KB)
- [`icons/icon-48.png`](icons/icon-48.png): App icon, 48 × 48 (1.7 KB)
- [`icons/icon-64.png`](icons/icon-64.png): App icon, 64 × 64 (2.0 KB)
- [`icons/icon-128.png`](icons/icon-128.png): App icon, 128 × 128 (3.9 KB)
- [`icons/icon-256.png`](icons/icon-256.png): App icon, 256 × 256 (7.6 KB)
- [`icons/icon-512.png`](icons/icon-512.png): App icon, 512 × 512 (15.3 KB)
- [`icons/favicon.ico`](icons/favicon.ico): Favicon with 16, 24, 32, 48, 64, 256 px inside (13.8 KB)

## Build them again

`pnpm brand` writes every file here from two sources: the font in [`fonts/`](fonts/) and the faces in
[`scripts/lib/faces.mjs`](../scripts/lib/faces.mjs). Don't edit the generated files by hand.

## Font

Nunito, Copyright 2014 The Nunito Project Authors, under the SIL Open Font License 1.1
([`fonts/OFL.txt`](fonts/OFL.txt)).

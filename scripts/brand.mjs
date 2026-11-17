// Builds every file in brand/ from two sources: the Nunito font in brand/fonts (the letters) and
// scripts/lib/faces.mjs (the faces). Run it with `pnpm brand`. The files it writes are not edited
// by hand: change this script or its sources and run it again.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { FACES, FACE_BOX, FACE_NAMES, SQUARE_BOX, faceSVG } from "./lib/faces.mjs";
import { measureWordmark, wordmarkSVG } from "./lib/wordmark.mjs";
import { packIco } from "./lib/ico.mjs";
import { contrast, contrastUse, ratio } from "./lib/color.mjs";
import { renderSheet, renderReadme } from "./lib/sheet.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "brand");
const FONT = path.join(brandDir, "fonts", "Nunito[wght].ttf");

export const COLORS = {
  ink: { name: "Ink", hex: "#1E1B24", use: "Letters and eyes on light backgrounds" },
  coral: { name: "Coral", hex: "#F0603F", use: "The smile, on every background" },
  cream: { name: "Cream", hex: "#FFF8EF", use: "Light background" },
  night: { name: "Night", hex: "#15131B", use: "Dark background" },
  snow: { name: "Snow", hex: "#F7F4FA", use: "Letters and eyes on dark backgrounds" },
};
const C = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, v.hex]));

// The four ways the marks are painted.
const PAINT = {
  light: { ink: C.ink, smile: C.coral },
  dark: { ink: C.snow, smile: C.coral },
  black: { ink: "#000000", smile: "#000000" },
  white: { ink: "#FFFFFF", smile: "#FFFFFF" },
};
// The app icon keeps the whites of the eyes filled, so it still reads on a dark taskbar.
const ICON_PAINT = { ink: C.ink, smile: C.coral, sclera: "#FFFFFF" };
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512];
const ICO_SIZES = [16, 24, 32, 48, 64, 256];

const files = [];
function write(rel, data, about) {
  const full = path.join(brandDir, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, data);
  files.push({ path: rel.replaceAll("\\", "/"), about, bytes: Buffer.byteLength(data) });
}

// Start clean, so a renamed file never lingers. The font and its licence are sources: kept.
for (const dir of ["wordmark", "symbol", "faces", "icons"]) rmSync(path.join(brandDir, dir), { recursive: true, force: true });

// 1. The wordmark.
const mark = measureWordmark(FONT, { size: 100 });
const ABOUT = {
  light: "for light backgrounds",
  dark: "for dark backgrounds",
  black: "one ink, black",
  white: "one ink, white",
};
for (const [key, paint] of Object.entries(PAINT)) {
  const suffix = key === "light" ? "" : `-${key}`;
  write(`wordmark/wordmark${suffix}.svg`, wordmarkSVG(mark, paint, { height: 96 }), `Wordmark ${ABOUT[key]}`);
}

// 2. The symbol: the Bright face on its own.
for (const [key, paint] of Object.entries(PAINT)) {
  const suffix = key === "light" ? "" : `-${key}`;
  write(`symbol/symbol${suffix}.svg`, faceSVG("bright", paint, { box: FACE_BOX, title: "moods" }), `Symbol ${ABOUT[key]}`);
}

// 3. One face per mood, for light and dark backgrounds.
for (const name of FACE_NAMES) {
  write(`faces/${name}.svg`, faceSVG(name, PAINT.light), `${FACES[name].name} face ${ABOUT.light}`);
  write(`faces/${name}-dark.svg`, faceSVG(name, PAINT.dark), `${FACES[name].name} face ${ABOUT.dark}`);
}

// 4. The app icon: SVG, PNG at every size apps ask for, and a favicon.ico.
const iconSvg = faceSVG("bright", ICON_PAINT, { box: SQUARE_BOX, size: 512, title: "moods" });
write("icons/icon.svg", iconSvg, "App icon, any background");
const pngs = new Map();
for (const size of ICON_SIZES) {
  const png = new Resvg(iconSvg, { fitTo: { mode: "width", value: size } }).render().asPng();
  pngs.set(size, png);
  write(`icons/icon-${size}.png`, png, `App icon, ${size} × ${size}`);
}
write("icons/favicon.ico", packIco(ICO_SIZES.map((size) => ({ size, png: pngs.get(size) }))), `Favicon with ${ICO_SIZES.join(", ")} px inside`);

// 5. The sheet and the README, with the contrast measured here rather than typed by hand.
const pairs = [
  ["ink", "cream"],
  ["snow", "night"],
  ["coral", "night"],
  ["coral", "cream"],
].map(([fg, bg]) => {
  const r = contrast(C[fg], C[bg]);
  return { fg: COLORS[fg], bg: COLORS[bg], ratio: ratio(r), use: contrastUse(r) };
});
const data = { colors: COLORS, pairs, faces: FACES, faceNames: FACE_NAMES, files: [...files], mark };
write("index.html", renderSheet(data), "This sheet");
write("README.md", renderReadme(data), "How to use the brand");

console.log(`brand: ${files.length} files written in brand/`);

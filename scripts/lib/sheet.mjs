// The brand sheet (brand/index.html) and the brand README, written from the same data as the files.
import { faceShapes, FACE_BOX } from "./faces.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fileName = (p) => p.split("/").pop();
const kb = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

const GROUPS = [
  { title: "Wordmark", dir: "wordmark/", column: 1 },
  { title: "Symbol", dir: "symbol/", column: 1 },
  { title: "Faces", dir: "faces/", column: 2 },
  { title: "App icon", dir: "icons/", column: 3 },
];

const RULES = [
  "Keep the smile coral. Only a one-ink print changes it.",
  "Leave clear space around the logo: at least the height of an “o” on every side.",
  "Never put the logo in a box, a circle or a badge. It stands on its own.",
  "Never stretch, rotate or redraw it. Use the files.",
  "Smallest sizes: the wordmark 24 px tall, the icon 16 px.",
  "On dark backgrounds use the dark files. On a photo, use the one that stands out more.",
];

function inlineFace(name) {
  const box = FACE_BOX;
  return (
    `<svg viewBox="${box.x} ${box.y} ${box.width} ${box.height}" aria-hidden="true">` +
    faceShapes(name, { ink: "currentColor", smile: "#F0603F" }, { groups: true }) +
    `</svg>`
  );
}

export function renderSheet({ colors, pairs, faces, faceNames, files }) {
  const ICONS = [16, 24, 32, 48, 64];
  const WORDS = [24, 32, 48];
  const sizeRow = (dark) =>
    `<div class="icons">` +
    ICONS.map((s) => `<figure><img src="icons/icon.svg" width="${s}" height="${s}" alt=""><figcaption>${s} px</figcaption></figure>`).join("") +
    `</div><div class="words">` +
    WORDS.map((h) => `<figure><img src="wordmark/wordmark${dark ? "-dark" : ""}.svg" style="height:${h}px;width:auto" alt=""><figcaption>${h} px tall</figcaption></figure>`).join("") +
    `</div>`;

  const swatches = Object.values(colors)
    .map(
      (c) =>
        `<button class="swatch" type="button" data-copy="${c.hex}" aria-label="Copy ${c.name} ${c.hex}">` +
        `<span class="chip" style="background:${c.hex}"></span><strong>${c.name}</strong>` +
        `<span class="value">${c.hex}</span><span class="use">${esc(c.use)}</span></button>`,
    )
    .join("");

  const pairRows = pairs
    .map(
      (p) =>
        `<div class="pair-c"><span class="sample" style="background:${p.bg.hex};color:${p.fg.hex}">Aa</span>` +
        `<span><strong>${p.fg.name} on ${p.bg.name}</strong><b>${p.ratio}</b><span>${p.use}</span></span></div>`,
    )
    .join("");

  const faceCards = faceNames
    .map(
      (name) =>
        `<a class="face" href="faces/${name}.svg" data-name="${name}"${faces[name].pupils.length ? " data-blink" : ""}>` +
        `${inlineFace(name)}<strong>${faces[name].name}</strong><span>${esc(faces[name].says)}</span></a>`,
    )
    .join("");

  const groupHtml = (g) => {
    const items = files
      .filter((f) => f.path.startsWith(g.dir))
      .map((f) => `<li><a href="${f.path}"><strong>${fileName(f.path)}</strong><span>${esc(f.about)}</span></a></li>`)
      .join("");
    return `<div class="group"><h3>${g.title}</h3><ul>${items}</ul></div>`;
  };
  const groups = [1, 2, 3].map((c) => `<div class="column">${GROUPS.filter((g) => g.column === c).map(groupHtml).join("")}</div>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>moods brand</title>
<meta name="description" content="The wordmark, the faces and the app icon, at real size.">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<style>
@font-face { font-family: "Nunito"; src: url("fonts/Nunito%5Bwght%5D.ttf") format("truetype"); font-weight: 200 1000; font-display: swap; }
:root {
  color-scheme: light dark;
  --page: #FFF8EF; --text: #1E1B24; --quiet: #5B5163; --line: #E7DACB; --hover: #F7EADB; --coral: #F0603F;
  --gutter: clamp(16px, 4vw, 56px);
}
@media (prefers-color-scheme: dark) {
  :root { --page: #15131B; --text: #F7F4FA; --quiet: #BDB5C9; --line: #312B3D; --hover: #1F1B29; }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--page); color: var(--text); font: 650 17px/1.5 Nunito, system-ui, sans-serif; }
main { width: min(1600px, 100% - 2 * var(--gutter)); margin: 0 auto; padding: 56px 0 80px; }
h1 { font-weight: 900; font-size: clamp(36px, 4vw, 52px); line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 12px; }
h2 { font-weight: 900; font-size: clamp(26px, 2.4vw, 34px); line-height: 1.1; letter-spacing: -0.01em; margin: 0 0 22px; }
h3 { font-weight: 900; font-size: 21px; margin: 0 0 10px; }
.top p { margin: 0; font-size: 19px; max-width: 64ch; }
code { font: 700 0.92em/1 ui-monospace, "Cascadia Code", Consolas, monospace; }
section { margin-top: 72px; }
a { color: inherit; }

/* Plates: a mark on the background it is made for. */
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.plate { position: relative; display: grid; place-items: center; min-height: clamp(220px, 24vw, 380px); padding: 48px 32px 64px;
  border-radius: 8px; border: 2px solid var(--line); text-decoration: none; transition: border-color .18s; }
a.plate:hover { border-color: var(--coral); }
.plate img.word { width: min(80%, 560px); height: auto; }
.plate .file { position: absolute; left: 22px; bottom: 16px; font-weight: 800; font-size: 15px; }
.on-cream { background: #FFF8EF; color: #1E1B24; }
.on-night { background: #15131B; color: #F7F4FA; }
.on-white { background: #FFFFFF; color: #000000; }
.on-black { background: #000000; color: #FFFFFF; }
.ink-pair { display: flex; align-items: center; justify-content: center; gap: clamp(28px, 4vw, 64px); width: 100%; }
.ink-pair .word { width: min(60%, 420px); height: auto; }
.ink-pair .sym { width: min(22%, 150px); height: auto; }

/* The faces, loose on the page. */
.faces { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.face { display: grid; justify-items: center; gap: 6px; padding: 28px 16px 24px; border-radius: 8px; text-decoration: none; text-align: center; transition: background-color .18s; }
.face:hover { background: var(--hover); }
.face svg { width: min(100%, 210px); height: auto; color: var(--text); margin-bottom: 14px; overflow: visible; }
.face strong { font-weight: 900; font-size: 26px; line-height: 1.1; }
.face span { font-size: 17px; }
.face[data-blink] .eyes { transform-box: fill-box; transform-origin: 50% 50%; animation: blink 5.8s infinite; }
.face[data-name="focus"] .eyes { animation-delay: 2.4s; }
.face[data-name="dream"] .mouth { transform-box: fill-box; transform-origin: 50% 50%; animation: breathe 3.8s ease-in-out infinite; }
@keyframes blink { 0%, 93%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.08); } }
@keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
html[data-motion="off"] * { animation: none !important; }

/* Real sizes. */
.sizes { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 28px 32px 22px; border-radius: 8px; border: 2px solid var(--line); }
.sizes + .sizes { margin-top: 16px; }
.sizes figure { margin: 0; display: grid; justify-items: center; gap: 10px; }
.sizes img { display: block; }
.sizes .icons, .sizes .words { display: contents; }
.sizes figcaption { font-weight: 800; font-size: 15px; }

/* Colors. */
.swatches { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; }
.swatch { all: unset; cursor: pointer; display: grid; gap: 4px; align-content: start; border-radius: 8px; padding: 0 0 6px; }
.swatch:focus-visible { outline: 3px solid var(--coral); outline-offset: 4px; }
.chip { display: block; height: clamp(96px, 9vw, 140px); border-radius: 8px; border: 2px solid var(--line); margin-bottom: 10px; transition: transform .18s; }
.swatch:hover .chip { transform: translateY(-3px); }
.swatch strong { font-weight: 900; font-size: 22px; line-height: 1.15; }
.swatch .value { font-weight: 800; font-size: 17px; font-variant-numeric: tabular-nums; }
.swatch .use { font-size: 15px; }
.pairs { margin-top: 36px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.pair-c { display: flex; align-items: center; gap: 16px; }
.pair-c > span:last-child { display: grid; line-height: 1.3; }
.pair-c strong { font-weight: 800; font-size: 17px; }
.pair-c b { font-weight: 900; font-size: 22px; font-variant-numeric: tabular-nums; }
.pair-c > span:last-child span { font-size: 15px; }
.sample { flex: none; display: grid; place-items: center; width: 76px; height: 64px; border-radius: 8px; font-weight: 900; font-size: 28px; border: 2px solid var(--line); }

/* Type. */
.type { display: grid; grid-template-columns: 1.35fr 1fr; gap: 48px; align-items: center; }
.weights { display: grid; gap: 18px; }
.weights p { margin: 0; font-size: clamp(28px, 2.6vw, 40px); line-height: 1.1; }
.weights span { display: block; font-weight: 700; font-size: 15px; color: var(--quiet); margin-top: 4px; }
.type-big { margin: 0; font-weight: 900; font-size: clamp(40px, 5.4vw, 84px); line-height: 1.02; letter-spacing: -0.02em; }
.type-body { margin: 14px 0 0; font-weight: 700; font-size: clamp(19px, 1.6vw, 24px); }
.type-note { margin: 18px 0 0; font-size: 15px; color: var(--quiet); max-width: 80ch; }

/* Files. */
.files { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px 48px; }
.files .group + .group { margin-top: 28px; }
.files ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.files a { display: grid; padding: 7px 10px; margin: 0 -10px; border-radius: 6px; text-decoration: none; transition: background-color .18s; }
.files a:hover { background: var(--hover); }
.files a strong { font-weight: 800; font-size: 16px; }
.files a span { font-size: 15px; color: var(--quiet); }
.rebuild { margin-top: 28px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; font-size: 17px; }
.command { all: unset; cursor: pointer; font: 700 16px/1 ui-monospace, "Cascadia Code", Consolas, monospace; padding: 12px 16px; border-radius: 8px; border: 2px solid var(--line); background: var(--hover); }
.command:hover { border-color: var(--coral); }
.command:focus-visible { outline: 3px solid var(--coral); outline-offset: 3px; }

/* Rules, each with a little coral smile. */
.rules { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 14px 48px; font-size: 18px; }
.rules li { position: relative; padding-left: 38px; }
.rules li::before { content: ""; position: absolute; left: 0; top: 0.42em; width: 24px; height: 12px;
  background: no-repeat center / contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 12'%3E%3Cpath d='M3 3 Q12 13 21 3' fill='none' stroke='%23F0603F' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E"); }
footer { margin-top: 72px; font-size: 15px; color: var(--quiet); }

@media (max-width: 1100px) {
  .files { grid-template-columns: 1fr 1fr; }
  .pairs { grid-template-columns: 1fr 1fr; }
  .type { grid-template-columns: 1fr; }
  .swatches { grid-template-columns: repeat(3, 1fr); }
  .sizes { flex-wrap: wrap; justify-content: flex-start; gap: 22px 30px; }
}
@media (max-width: 760px) {
  main { padding-top: 32px; }
  section { margin-top: 52px; }
  .pair, .rules, .files, .pairs { grid-template-columns: 1fr; }
  .faces { grid-template-columns: 1fr 1fr; gap: 8px; }
  .swatches { grid-template-columns: 1fr; gap: 14px; }
  .swatch { grid-template-columns: 72px 1fr; column-gap: 16px; align-items: center; }
  .chip { grid-row: span 3; height: 72px; margin: 0; }
  .swatch .use { grid-column: 2; }
  .pairs td { padding-right: 14px; }
  .sizes { display: grid; justify-content: normal; gap: 24px; padding: 22px 20px 20px; }
  .sizes .icons { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
  .sizes .words { display: grid; justify-items: start; gap: 14px; }
  .sizes .words figure { display: flex; align-items: center; gap: 14px; }
}
</style>
</head>
<body>
<main>
<header class="top">
<h1>Brand kit</h1>
<p>Every mark on this page is a file, built by <code>pnpm brand</code> from the Nunito font and the faces. Click one to open it.</p>
</header>

<section>
<h2>The wordmark</h2>
<div class="pair">
<a class="plate on-cream" href="wordmark/wordmark.svg"><img class="word" src="wordmark/wordmark.svg" alt="The wordmark on cream"><span class="file">wordmark.svg</span></a>
<a class="plate on-night" href="wordmark/wordmark-dark.svg"><img class="word" src="wordmark/wordmark-dark.svg" alt="The wordmark on night"><span class="file">wordmark-dark.svg</span></a>
</div>
</section>

<section>
<h2>One face per mood</h2>
<div class="faces">${faceCards}</div>
</section>

<section>
<h2>At real size</h2>
<div class="sizes on-cream">${sizeRow(false)}</div>
<div class="sizes on-night">${sizeRow(true)}</div>
</section>

<section>
<h2>One ink</h2>
<div class="pair">
<div class="plate on-white"><div class="ink-pair"><img class="word" src="wordmark/wordmark-black.svg" alt="The wordmark in black"><img class="sym" src="symbol/symbol-black.svg" alt="The symbol in black"></div></div>
<div class="plate on-black"><div class="ink-pair"><img class="word" src="wordmark/wordmark-white.svg" alt="The wordmark in white"><img class="sym" src="symbol/symbol-white.svg" alt="The symbol in white"></div></div>
</div>
</section>

<section>
<h2>Colors</h2>
<div class="swatches">${swatches}</div>
<div class="pairs">${pairRows}</div>
</section>

<section>
<h2>Type</h2>
<div class="type"><div>
<p class="type-big">Make the app yours.</p>
<p class="type-body">Mods for any open source app. They survive every update.</p>
<p class="type-note">Nunito, from The Nunito Project Authors, free under the SIL Open Font License 1.1. The wordmark is Nunito Black (900) with a tracking of -0.02 em, turned into outlines. Headings use Nunito Black and text uses Nunito Bold.</p>
</div><div class="weights"><p style="font-weight:900">Nunito Black <span>900, wordmark and headings</span></p><p style="font-weight:700">Nunito Bold <span>700, text</span></p><p style="font-weight:400">Nunito Regular <span>400, long reading</span></p></div></div>
</section>

<section>
<h2>Files</h2>
<div class="files">${groups}</div>
<div class="rebuild"><button class="command" type="button" data-copy="pnpm brand"><span class="value">pnpm brand</span></button><span>builds all of them again. Don't edit them by hand.</span></div>
</section>

<section>
<h2>Use it well</h2>
<ul class="rules">${RULES.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
</section>

<footer>Generated by scripts/brand.mjs. Nunito: Copyright 2014 The Nunito Project Authors, SIL Open Font License 1.1.</footer>
</main>
<script>
if (new URLSearchParams(location.search).get("motion") === "off") document.documentElement.dataset.motion = "off";
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy]");
  if (!button) return;
  const value = button.querySelector(".value");
  try { await navigator.clipboard.writeText(button.dataset.copy); } catch { return; }
  if (!value) return;
  value.textContent = "Copied";
  setTimeout(() => { value.textContent = button.dataset.copy; }, 1400);
});
</script>
</body>
</html>
`;
}

export function renderReadme({ colors, pairs, files }) {
  const colorRows = Object.values(colors).map((c) => `| ${c.name} | \`${c.hex}\` | ${c.use} |`).join("\n");
  const pairLines = pairs.map((p) => `- ${p.fg.name} on ${p.bg.name}: **${p.ratio}**, good for ${p.use}`).join("\n");
  const groups = GROUPS.map((g) => {
    const items = files.filter((f) => f.path.startsWith(g.dir)).map((f) => `- [\`${f.path}\`](${f.path}): ${f.about} (${kb(f.bytes)})`);
    return `### ${g.title}\n\n${items.join("\n")}`;
  }).join("\n\n");
  return `# Brand

The wordmark, the faces and the app icon. Open [index.html](index.html) in a browser to see every mark at real size.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="wordmark/wordmark-dark.svg">
  <img src="wordmark/wordmark.svg" alt="The wordmark" height="96">
</picture>

## Colors

| Name | Hex | Use |
|---|---|---|
${colorRows}

Contrast, measured with the WCAG 2.2 formula:

${pairLines}

## Use it well

${RULES.map((r) => `- ${r}`).join("\n")}

## Files

${groups}

## Build them again

\`pnpm brand\` writes every file here from two sources: the font in [\`fonts/\`](fonts/) and the faces in
[\`scripts/lib/faces.mjs\`](../scripts/lib/faces.mjs). Don't edit the generated files by hand.

## Font

Nunito, Copyright 2014 The Nunito Project Authors, under the SIL Open Font License 1.1
([\`fonts/OFL.txt\`](fonts/OFL.txt)).
`;
}

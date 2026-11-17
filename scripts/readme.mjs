// Everything the README shows, made again from the real thing: `pnpm readme`.
//  - the "how it works" drawing, wide and narrow, light and dark;
//  - the screenshots of the demo app, taken in a browser without a window.
// The pictures land in .github/readme/. Pass --drawing to skip the screenshots.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./lib/browser.mjs";
import { startServer } from "./serve.mjs";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".github", "readme");
await mkdir(out, { recursive: true });

// ---------- the drawing ----------

const STEPS = [
  { icon: "plug", title: "Add the plugin", text: "The app promises the names it will keep." },
  { icon: "message", title: "Ask for a mod", text: "By hand or through your coding agent." },
  { icon: "shield", title: "The gate checks it", text: "A mod never loads anything or runs code." },
  { icon: "download", title: "Update, mods stay", text: "Mods live outside the install folder." },
];

// Stroke icons from Lucide (https://lucide.dev), ISC License, Copyright (c) Lucide Contributors.
const ICONS = {
  plug: '<path d="M12 22v-5m3-9V2m2 6a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1zM9 8V2"/>',
  message: '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2zM7 11h10M7 15h6M7 7h8"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12l2 2l4-4"/>',
  download: '<path d="M12 15V3m9 12v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10l5 5l5-5"/>',
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";
const ACCENT = "#F0603F";
// The colors of a README on GitHub, light and dark.
const THEME = {
  light: { ink: "#1f2328", soft: "#59636e", line: "#d1d9e0" },
  dark: { ink: "#f0f6fc", soft: "#9198a1", line: "#3d444d" },
};

/** @param {string} text @param {number} max characters per line */
function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (`${line} ${word}`.trim().length > max && line) {
      lines.push(line);
      line = word;
    } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}
/** @param {string} name @param {number} x @param {number} y @param {number} scale */
const icon = (name, x, y, scale) =>
  `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${ACCENT}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[/** @type {keyof typeof ICONS} */ (name)]}</g>`;
const alt = STEPS.map((s) => `${s.title}: ${s.text}`).join(" ");

/** The steps side by side, for a computer. @param {"light" | "dark"} theme */
function wide(theme) {
  const t = THEME[theme];
  const W = 960;
  const col = W / STEPS.length;
  let body = "";
  let bottom = 0;
  STEPS.forEach((step, i) => {
    const cx = col * i + col / 2;
    body += icon(step.icon, cx - 26, 8, 2.1667);
    let y = 100;
    for (const line of wrap(step.title, Math.floor(col / 12.5))) {
      body += `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="23" font-weight="600" fill="${t.ink}">${line}</text>`;
      y += 30;
    }
    y += 4;
    for (const line of wrap(step.text, Math.floor(col / 9.2))) {
      body += `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="17" fill="${t.soft}">${line}</text>`;
      y += 25;
    }
    bottom = Math.max(bottom, y);
    if (i < STEPS.length - 1) {
      const x1 = cx + 46;
      const x2 = cx + col - 46;
      body += `<path d="M${x1} 34 H${x2 - 2}" stroke="${t.line}" stroke-width="2" fill="none"/><path d="M${x2 - 9} 28 L${x2} 34 L${x2 - 9} 40" stroke="${t.line}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  });
  const H = Math.ceil(bottom + 6);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${alt}">${body}</svg>\n`;
}

/** The same steps one under another, for a phone. @param {"light" | "dark"} theme */
function narrow(theme) {
  const t = THEME[theme];
  const W = 520;
  let y = 8;
  let body = "";
  STEPS.forEach((step, i) => {
    const top = y;
    body += icon(step.icon, 8, top, 2);
    let ty = top + 26;
    for (const line of wrap(step.title, 30)) {
      body += `<text x="80" y="${ty}" font-family="${FONT}" font-size="26" font-weight="600" fill="${t.ink}">${line}</text>`;
      ty += 34;
    }
    for (const line of wrap(step.text, 36)) {
      body += `<text x="80" y="${ty}" font-family="${FONT}" font-size="21" fill="${t.soft}">${line}</text>`;
      ty += 29;
    }
    y = ty + 26;
    if (i < STEPS.length - 1) {
      body += `<path d="M32 ${top + 60} V${y - 12}" stroke="${t.line}" stroke-width="2" fill="none"/><path d="M26 ${y - 20} L32 ${y - 12} L38 ${y - 20}" stroke="${t.line}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  });
  const H = Math.ceil(y - 20);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${alt}">${body}</svg>\n`;
}

for (const theme of /** @type {const} */ (["light", "dark"])) {
  await writeFile(path.join(out, `how-it-works-${theme}.svg`), wide(theme));
  await writeFile(path.join(out, `how-it-works-${theme}-narrow.svg`), narrow(theme));
}
console.log("Drawing: how-it-works-{light,dark}{,-narrow}.svg");

// ---------- the screenshots ----------

if (!process.argv.includes("--drawing")) {
  const server = await startServer({ port: 0 });
  const browser = await launch();
  try {
    /**
     * @param {string} name @param {string} query
     * @param {{ width?: number, height?: number, scheme?: "light" | "dark", before?: string }} [options]
     */
    const shot = async (name, query, { width = 1280, height = 860, scheme = "light", before } = {}) => {
      const page = await browser.newPage({ width, height, deviceScaleFactor: 2, colorScheme: scheme });
      await page.goto(`${server.url}/examples/demo/${query}`);
      await page.waitFor("document.body.dataset.ready === '1'");
      if (before) await page.evaluate(before);
      await page.evaluate("document.fonts.ready.then(() => true)");
      await new Promise((r) => setTimeout(r, 400));
      if (page.errors.length) throw new Error(`${name}: ${page.errors.join("; ")}`);
      await page.screenshot({ path: path.join(out, `${name}.png`) });
      await page.close();
      console.log(`Screenshot: ${name}.png`);
    };
    // The app with a mood and the mods panel: what a person sees.
    const all = "rounder-corners,sneaky-tracker,square-buttons,bigger-text,today-first";
    await shot("demo-light", `?mood=bright&on=${all}`, { scheme: "light" });
    await shot("demo-dark", `?mood=calm&on=${all}`, { scheme: "dark" });
    // One per mood, the app alone.
    for (const mood of ["calm", "focus", "dream", "bright"]) {
      await shot(`mood-${mood}`, `?panel=off&mood=${mood}&on=rounder-corners`, { width: 1000, height: 640 });
    }
    // Writing a mod live: one that passes, one the gate stops.
    await shot("make-a-mod", "?tab=make&mood=focus&on=", { width: 1000, height: 760, scheme: "dark" });
    await shot("refused", "?tab=make&on=", { width: 1000, height: 760, before: `document.querySelector('[data-example="1"]').click()` });
  } finally {
    await browser.close();
    await server.close();
  }
}

// The wordmark: the name set in Nunito Black, turned into outlines so it never depends on the
// font being installed. The two "o" become eyes (a pupil in each counter) and a smile hangs below.
import * as fontkit from "fontkit";

const WORD = "moods";
const n = (v) => Number(v.toFixed(2));

/**
 * Lays out the word and measures everything the logo needs, in units where the font size is
 * `size` and the baseline sits at y = 0 (y grows downwards, like SVG).
 */
export function measureWordmark(fontPath, { size = 100, weight = 900, tracking = -0.02 } = {}) {
  const font = fontkit.openSync(fontPath).getVariation({ wght: weight });
  const k = size / font.unitsPerEm;
  const run = font.layout(WORD);
  let pen = 0;
  const letters = run.glyphs.map((glyph, i) => {
    const pos = run.positions[i];
    const path = glyph.path.scale(k, -k).translate(pen + pos.xOffset * k, -pos.yOffset * k);
    pen += pos.xAdvance * k + tracking * size;
    const b = path.bbox;
    return { name: glyph.name, d: path.toSVG(), box: { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY } };
  });
  const eyes = letters.filter((l) => l.name === "o");
  if (eyes.length !== 2) throw new Error(`Expected two "o" glyphs, found ${eyes.length}`);

  // The centre of each eye is the centre of its letter cell once the tracking is taken off, which
  // is how the chosen design was drawn in the browser (half the tracking left of the ink centre).
  const centre = ({ box }) => (box.minX + box.maxX) / 2 + (tracking * size) / 2;

  // Pupils: in each "o", nudged down and right so the word looks at the reader's side.
  const pupils = eyes.map((eye) => ({
    cx: centre(eye) + 0.028 * size,
    cy: (eye.box.minY + eye.box.maxY) / 2 + 0.02 * size,
    r: 0.083 * size,
  }));

  // The smile: a quadratic curve from just left of the first eye to just right of the second.
  const c1 = centre(eyes[0]);
  const c2 = centre(eyes[1]);
  const smile = {
    x1: c1 - 0.13 * size,
    x2: c2 + 0.13 * size,
    y: 0.1 * size,
    dip: 0.24 * size,
    width: 0.085 * size,
  };
  smile.d = `M${n(smile.x1)} ${n(smile.y)} Q${n((smile.x1 + smile.x2) / 2)} ${n(smile.y + smile.dip)} ${n(smile.x2)} ${n(smile.y)}`;

  // Tight box around the ink: letters, plus the smile with its round caps.
  const half = smile.width / 2;
  const box = {
    minX: Math.min(...letters.map((l) => l.box.minX), smile.x1 - half),
    minY: Math.min(...letters.map((l) => l.box.minY), smile.y - half),
    maxX: Math.max(...letters.map((l) => l.box.maxX), smile.x2 + half),
    maxY: Math.max(...letters.map((l) => l.box.maxY), smile.y + smile.dip / 2 + half),
  };
  return { size, letters, pupils, smile, box, xHeight: (font["OS/2"].xHeight ?? 484) * k };
}

/** A standalone SVG of the wordmark. colors: { ink, smile, pupil = ink }. */
export function wordmarkSVG(m, { ink, smile, pupil = ink }, { pad = 0, height } = {}) {
  const x = Math.floor(m.box.minX - pad);
  const y = Math.floor(m.box.minY - pad);
  const w = Math.ceil(m.box.maxX + pad) - x;
  const h = Math.ceil(m.box.maxY + pad) - y;
  const outH = height ?? h;
  const outW = (outH * w) / h;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${n(outW)}" height="${n(outH)}" ` +
    `role="img" aria-label="moods"><title>moods</title>` +
    `<path fill="${ink}" d="${m.letters.map((l) => l.d).join("")}"/>` +
    m.pupils.map((p) => `<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" fill="${pupil}"/>`).join("") +
    `<path d="${m.smile.d}" fill="none" stroke="${smile}" stroke-width="${n(m.smile.width)}" stroke-linecap="round"/>` +
    `</svg>\n`
  );
}

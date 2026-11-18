// Color helpers shared by the runtime (mood checks) and the brand tools. Contrast follows WCAG 2.2:
// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio and #dfn-relative-luminance

/** @param {string} hex @returns {[number, number, number]} */
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a #RRGGBB color: ${hex}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** The ways an app can keep a color in a variable. See `colorAs`. */
export const COLOR_FORMATS = ["hex", "hsl", "rgb", "rgb-commas"];

/**
 * A #RRGGBB color written the way an app keeps its own variables. Many apps keep only the
 * channels and wrap them where they use them, as in `hsl(var(--background))`.
 * @param {string} hex
 * @param {string} [as] `hex` (`#102126`), `hsl` (`191 41% 11%`), `rgb` (`16 33 38`) or `rgb-commas` (`16, 33, 38`)
 */
export function colorAs(hex, as = "hex") {
  if (as === "hex") return hex;
  const [r, g, b] = hexToRgb(hex);
  if (as === "rgb") return `${r} ${g} ${b}`;
  if (as === "rgb-commas") return `${r}, ${g}, ${b}`;
  if (as !== "hsl") throw new Error(`Not a color format: ${as}`);
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const light = (max + min) / 2;
  const spread = max - min;
  let hue = 0;
  if (spread) {
    if (max === rr) hue = ((gg - bb) / spread) % 6;
    else if (max === gg) hue = (bb - rr) / spread + 2;
    else hue = (rr - gg) / spread + 4;
    hue = (hue * 60 + 360) % 360;
  }
  const saturation = spread ? spread / (1 - Math.abs(2 * light - 1)) : 0;
  /** @param {number} n */
  const round = (n) => Math.round(n * 10) / 10;
  return `${round(hue)} ${round(saturation * 100)}% ${round(light * 100)}%`;
}

/** @param {string} hex */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {string} a @param {string} b the two colors, as #RRGGBB */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * What a contrast ratio is good for, in plain words.
 * @param {number} ratio
 */
export function contrastUse(ratio) {
  if (ratio >= 7) return "any text";
  if (ratio >= 4.5) return "body text";
  if (ratio >= 3) return "large text and shapes";
  return "decoration only";
}

/** @param {number} r */
export const ratio = (r) => `${(Math.floor(r * 10) / 10).toFixed(1)}:1`;

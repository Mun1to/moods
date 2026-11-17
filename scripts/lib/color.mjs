// Color helpers shared by the brand and the palette checks. Contrast follows WCAG 2.2:
// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio and #dfn-relative-luminance

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a #RRGGBB color: ${hex}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** What a contrast ratio is good for, in plain words. */
export function contrastUse(ratio) {
  if (ratio >= 7) return "any text";
  if (ratio >= 4.5) return "body text";
  if (ratio >= 3) return "large text and shapes";
  return "decoration only";
}

export const ratio = (r) => `${(Math.floor(r * 10) / 10).toFixed(1)}:1`;

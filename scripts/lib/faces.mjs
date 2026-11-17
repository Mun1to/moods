// The faces of the brand, one per mood. Every shape lives in a 100 × 78 box and is drawn with
// round 10-unit strokes, so the faces read as one family at any size.

export const FACE_BOX = { x: 0, y: 0, width: 100, height: 78 };

// A square box around the same faces, for icons: the face sits in the middle.
export const SQUARE_BOX = { x: 0, y: -11, width: 100, height: 100 };

const STROKE = 10;
const ring = (cx) => ({ ring: { cx, cy: 28, r: 17 } });

export const FACES = {
  bright: {
    name: "Bright",
    says: "Eyes open, big smile",
    eyes: [ring(28), ring(72)],
    pupils: [{ cx: 31.5, cy: 30.5, r: 6.5 }, { cx: 75.5, cy: 30.5, r: 6.5 }],
    mouth: { d: "M26 56 Q50 76 74 56" },
  },
  calm: {
    name: "Calm",
    says: "Eyes closed, soft smile",
    eyes: [{ d: "M13 28 Q28 42 43 28" }, { d: "M57 28 Q72 42 87 28" }],
    pupils: [],
    mouth: { d: "M36 58 Q50 67 64 58" },
  },
  focus: {
    name: "Focus",
    says: "Eyes wide open, straight mouth",
    eyes: [ring(28), ring(72)],
    pupils: [{ cx: 28, cy: 28, r: 6.5 }, { cx: 72, cy: 28, r: 6.5 }],
    mouth: { d: "M35 60 L65 60" },
  },
  dream: {
    name: "Dream",
    says: "Sleepy eyes, little round mouth",
    eyes: [{ d: "M13 32 Q28 22 43 32" }, { d: "M57 32 Q72 22 87 32" }],
    pupils: [],
    mouth: { circle: { cx: 50, cy: 60, r: 7 }, stroke: 9 },
  },
};

export const FACE_NAMES = Object.keys(FACES);

const n = (v) => Number(v.toFixed(2));

/**
 * The shapes of one face, ready to drop inside an <svg>.
 * colors: { ink, smile, pupil = ink, sclera = none }. `sclera` fills the open eyes, which keeps
 * the face readable on dark backgrounds when the ink is dark.
 */
export function faceShapes(name, { ink, smile, pupil = ink, sclera = null }, { stroke = STROKE, groups = false } = {}) {
  const face = FACES[name];
  if (!face) throw new Error(`Unknown face: ${name}`);
  const line = (d, color, width = stroke) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n(width)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const eyes = [];
  for (const eye of face.eyes) {
    if (eye.ring) {
      const { cx, cy, r } = eye.ring;
      if (sclera) eyes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${sclera}"/>`);
      eyes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ink}" stroke-width="${n(stroke)}"/>`);
    } else {
      eyes.push(line(eye.d, ink));
    }
  }
  for (const p of face.pupils) eyes.push(`<circle cx="${p.cx}" cy="${p.cy}" r="${n(p.r * (stroke / STROKE))}" fill="${pupil}"/>`);
  const m = face.mouth;
  const mouth = m.circle
    ? `<circle cx="${m.circle.cx}" cy="${m.circle.cy}" r="${m.circle.r}" fill="none" stroke="${smile}" stroke-width="${n((m.stroke ?? stroke) * (stroke / STROKE))}"/>`
    : line(m.d, smile);
  // `groups` wraps the eyes and the mouth so a page can animate them (a blink, a breath).
  return groups
    ? `<g class="eyes">${eyes.join("")}</g><g class="mouth">${mouth}</g>`
    : eyes.join("") + mouth;
}

/** A whole standalone SVG file for one face. */
export function faceSVG(name, colors, { box = FACE_BOX, size, title, stroke } = {}) {
  const width = size ?? box.width;
  const height = size ? (size * box.height) / box.width : box.height;
  const label = title ?? `${FACES[name].name} face`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" ` +
    `width="${n(width)}" height="${n(height)}" role="img" aria-label="${label}">` +
    `<title>${label}</title>${faceShapes(name, colors, { stroke })}</svg>\n`
  );
}

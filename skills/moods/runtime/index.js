// The plugin: everything a window needs to load the mods of the people who use an app.
// reference/format.md describes the files; these modules check and apply them.
// Plain JavaScript modules with no dependencies: copy this folder into an app and import it.
export { readManifest, TYPES, FILE_FOR_TYPE } from "./manifest.js";
export { checkStyle, namesInStyle, MAX_STYLE_BYTES } from "./gate.js";
export { walkStyle } from "./css.js";
export { review, compileMood, compileStyle, compileStructure, moodContrastNotes, ROLES } from "./compile.js";
export { createModHost } from "./apply.js";
export { satisfies, parseVersion } from "./semver.js";
export { contrast, luminance } from "./color.js";

/** The version of this runtime. */
export const VERSION = "0.2.0";
/** The version of the mod format it reads. */
export const FORMAT = 1;

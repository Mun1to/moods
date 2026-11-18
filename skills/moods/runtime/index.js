// The plugin: everything a window needs to load the mods of the people who use an app.
// reference/format.md describes the files; these modules check and apply them.
// Plain JavaScript modules with no dependencies: copy this folder into an app and import it.
export { readManifest, TYPES, FILE_FOR_TYPE } from "./manifest.js";
export { checkStyle, namesInStyle, MAX_STYLE_BYTES } from "./gate.js";
export { walkStyle } from "./css.js";
export { review, compileMood, compileStyle, compileStructure, moodContrastNotes, roleOf, roleVariables, ROLES } from "./compile.js";
export { createModHost } from "./apply.js";
export { startMods, modsOf } from "./start.js";
export { ModsPanel, WORDS } from "./panel.js";
export { MOODS } from "./moods.js";
export { satisfies, parseVersion } from "./semver.js";
export { contrast, luminance, colorAs, COLOR_FORMATS } from "./color.js";

/** The version of this runtime. */
export const VERSION = "0.3.0";
/** The version of the mod format it reads. */
export const FORMAT = 1;

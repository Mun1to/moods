// The plugin: everything an app needs to load the mods of the people who use it.
// docs/format.md describes the files; this module checks and applies them.
export { readManifest, TYPES, FILE_FOR_TYPE } from "./manifest.js";
export { checkStyle, namesInStyle, MAX_STYLE_BYTES } from "./gate.js";
export { review, compileMood, compileStyle, compileStructure, moodContrastNotes, ROLES } from "./compile.js";
export { createModHost } from "./apply.js";
export { satisfies, parseVersion } from "./semver.js";
export { contrast, luminance } from "./color.js";

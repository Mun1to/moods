// Reading and checking `mod.json` (format 1). See reference/format.md.
import { parseVersion } from "./semver.js";

export const TYPES = ["mood", "style", "structure"];
export const FILE_FOR_TYPE = { mood: "mood.json", style: "style.css", structure: "structure.json" };
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RANGE = /^(\^|~|>=)?\s*\d+(\.\d+){0,2}$/;

/**
 * @typedef {{ format: 1, id: string, name: string, type: "mood" | "style" | "structure",
 *   request: string, contract: string, madeFor?: string, touches: string[] }} Manifest
 */

/**
 * @param {unknown} input the parsed JSON, or the raw text of mod.json
 * @returns {{ ok: true, manifest: Manifest } | { ok: false, errors: string[] }}
 */
export function readManifest(input) {
  let data = input;
  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch {
      return { ok: false, errors: ["mod.json is not valid JSON"] };
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, errors: ["mod.json must be an object"] };
  const m = /** @type {Record<string, unknown>} */ (data);
  const errors = [];
  if (m.format !== 1) errors.push(m.format === 2 || (typeof m.format === "number" && m.format > 1)
    ? `format ${m.format} is newer than this plugin understands`
    : "format must be 1");
  if (typeof m.id !== "string" || !ID.test(m.id)) errors.push("id must use lowercase letters, digits and dashes");
  if (typeof m.type !== "string" || !TYPES.includes(m.type)) {
    errors.push(m.type === "function" ? "type function is not supported yet" : `type must be one of ${TYPES.join(", ")}`);
  }
  if (typeof m.request !== "string" || !m.request.trim()) errors.push("request must say what the person asked for");
  if (typeof m.contract !== "string" || !RANGE.test(m.contract.trim())) errors.push("contract must be a semver range like ^1.0");
  if (m.madeFor !== undefined && (typeof m.madeFor !== "string" || !parseVersion(m.madeFor))) errors.push("madeFor must be a version like 3.9.0");
  if (m.name !== undefined && typeof m.name !== "string") errors.push("name must be text");
  if (m.touches !== undefined && (!Array.isArray(m.touches) || m.touches.some((t) => typeof t !== "string"))) {
    errors.push("touches must be a list of names");
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    manifest: {
      format: 1,
      id: /** @type {string} */ (m.id),
      name: typeof m.name === "string" && m.name.trim() ? m.name.trim() : /** @type {string} */ (m.id),
      type: /** @type {Manifest["type"]} */ (m.type),
      request: /** @type {string} */ (m.request).trim(),
      contract: /** @type {string} */ (m.contract).trim(),
      ...(m.madeFor ? { madeFor: /** @type {string} */ (m.madeFor) } : {}),
      touches: /** @type {string[] | undefined} */ (m.touches) ?? [],
    },
  };
}

// Just enough semver to check a mod's `contract` range against an app's contract version.
// Ranges: "1.2.3", "1.2", "^1.2", "~1.2.3", ">=1.1". Rules from https://semver.org and npm's caret/tilde.

/** @param {string} v @returns {[number, number, number] | null} */
export function parseVersion(v) {
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(String(v).trim());
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

/** @param {number[]} a @param {number[]} b */
function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

/**
 * True when `version` falls inside `range`. An unreadable range never matches.
 * @param {string} version
 * @param {string} range
 */
export function satisfies(version, range) {
  const v = parseVersion(version);
  const r = String(range).trim();
  const op = /^(\^|~|>=)?\s*(.+)$/.exec(r);
  if (!v || !op) return false;
  const base = parseVersion(op[2]);
  if (!base) return false;
  const parts = op[2].split(".").length;
  if (op[1] === ">=") return compare(v, base) >= 0;
  if (compare(v, base) < 0) return false;
  if (op[1] === "^") {
    if (base[0] > 0) return v[0] === base[0];
    if (base[1] > 0 || parts < 3) return v[0] === 0 && v[1] === base[1];
    return compare(v, base) === 0;
  }
  if (op[1] === "~") return v[0] === base[0] && (parts < 2 ? true : v[1] === base[1]);
  // A bare version: "1.2" means any 1.2.x, "1.2.3" means exactly that one.
  if (parts === 1) return v[0] === base[0];
  if (parts === 2) return v[0] === base[0] && v[1] === base[1];
  return compare(v, base) === 0;
}

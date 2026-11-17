// The rules of docs/format.md, one test each. Run with `pnpm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { checkStyle, review, satisfies, compileStyle, compileStructure } from "../src/index.js";

const contract = JSON.parse(readFileSync(new URL("../examples/demo/contract.json", import.meta.url), "utf8"));
const manifest = (extra) => ({ format: 1, id: "a-mod", type: "style", request: "a test mod", contract: "^1.0", ...extra });

test("semver ranges", () => {
  assert.ok(satisfies("1.4.2", "^1.0"));
  assert.ok(!satisfies("2.0.0", "^1.0"));
  assert.ok(satisfies("1.2.9", "~1.2"));
  assert.ok(!satisfies("1.3.0", "~1.2"));
  assert.ok(satisfies("1.2.0", "1.2"));
  assert.ok(satisfies("3.0.0", ">=1.1"));
  assert.ok(!satisfies("0.3.0", "^0.2"));
  assert.ok(!satisfies("1.0.0", "nonsense"));
});

test("the gate refuses anything that loads or runs", () => {
  for (const css of [
    '@import "x.css";',
    "a { background: url(https://example.com/x.png) }",
    "a { background: url( 'http://example.com' ) }",
    "a { background: URL(//example.com/x) }",
    "a { background: image-set('x.png' 1x) }",
    "a { background: \\75 rl(https://example.com) }",
    "a { width: expression(alert(1)) }",
    "a { background: url(javascript:alert(1)) }",
    "/* not closed",
    "</style><script>alert(1)</script>",
    "@property --x { syntax: '*'; inherits: false; }",
  ]) {
    assert.equal(checkStyle(css).ok, false, css);
  }
});

test("the gate lets data URIs, fragments and comments through", () => {
  const css = "/* round */ :root { --radius-button: 14px; } a { background: url(data:image/png;base64,AAAA); filter: url(#soft); }";
  assert.equal(checkStyle(css).ok, true);
});

test("a style mod is scoped away from the zones without mods", () => {
  const out = compileStyle(":root { --radius-button: 14px; }", contract);
  assert.match(out.css, /^@scope \(:root\) to \(\[data-no-mods\]\)/);
  // :root never matches inside @scope, so it is rewritten to :scope (the root element).
  assert.match(out.css, /:scope \{ --radius-button: 14px; \}/);
});

test("@font-face and @keyframes stay outside the scope", () => {
  const out = compileStyle("@keyframes spin { to { rotate: 1turn } } [data-piece=\"toolbar\"] { animation: spin 2s; }", contract);
  assert.ok(out.css.startsWith("@keyframes spin"));
  assert.match(out.css, /@scope[\s\S]*toolbar/);
});

test("a deprecated name still works, rewritten, and the mod says so", () => {
  const v = review({ manifest: manifest(), files: { "style.css": ":root { --r-button: 20px; }" } }, contract);
  assert.equal(v.state, "deprecated");
  assert.match(v.css, /--radius-button: 20px/);
});

test("a name the contract does not have breaks the mod instead of failing silently", () => {
  const v = review({ manifest: manifest(), files: { "style.css": ":root { --made-up: 1px; }" } }, contract);
  assert.equal(v.state, "broken");
  const helper = review({ manifest: manifest(), files: { "style.css": ":root { --mod-gap: 4px; } [data-piece=\"toolbar\"] { gap: var(--mod-gap); }" } }, contract);
  assert.equal(helper.state, "applied");
});

test("touches lists what the mod needs; a missing piece breaks it", () => {
  const v = review({ manifest: manifest({ touches: ["piece:gone"] }), files: { "style.css": "" } }, contract);
  assert.equal(v.state, "broken");
});

test("another contract range applies, but asks for an update", () => {
  const v = review({ manifest: manifest({ contract: "^2.0" }), files: { "style.css": ":root { --radius-button: 2px; }" } }, contract);
  assert.equal(v.state, "deprecated");
});

test("a bad manifest is rejected with a reason, never thrown", () => {
  assert.equal(review({ manifest: "{ nope", files: {} }, contract).state, "rejected");
  assert.equal(review({ manifest: manifest({ type: "function" }), files: {} }, contract).state, "rejected");
  assert.equal(review({ manifest: manifest({ format: 2 }), files: {} }, contract).notes[0], "format 2 is newer than this plugin understands");
});

test("a mod that is off stays off", () => {
  assert.equal(review({ manifest: manifest(), files: { "style.css": "" }, enabled: false }, contract).state, "off");
});

test("structure orders and hides with CSS, only inside known zones", () => {
  const ok = compileStructure(JSON.stringify({ zones: { sidebar: { order: ["today", "inbox"], hidden: ["usage"] } } }), contract);
  assert.match(ok.css, /\[data-zone="sidebar"\] > \[data-piece="today"\] \{ order: 1 !important; \}/);
  assert.match(ok.css, /display: none !important/);
  const bad = compileStructure(JSON.stringify({ zones: { sidebar: { hidden: ["keys"] } } }), contract);
  assert.equal(bad.state, "broken");
});

test("the four built-in moods pass every check, with no contrast warning", () => {
  const dir = new URL("../mods/", import.meta.url);
  const ids = readdirSync(dir);
  assert.deepEqual(ids.sort(), ["bright", "calm", "dream", "focus"]);
  for (const id of ids) {
    const read = (f) => readFileSync(new URL(`${id}/${f}`, dir), "utf8");
    const v = review({ manifest: read("mod.json"), files: { "mood.json": read("mood.json") } }, contract);
    assert.equal(v.state, "applied", `${id}: ${v.notes.join("; ")}`);
    assert.deepEqual(v.notes, [], id);
  }
});

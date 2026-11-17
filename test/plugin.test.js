// The rules of the mod format, one test each. Run with `pnpm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkStyle, review, satisfies, compileStyle, compileStructure, compileMood, walkStyle } from "../skills/moods/runtime/index.js";
import { readModsFolder, watchModsFolder } from "../skills/moods/runtime/node.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const contract = JSON.parse(readFileSync(here("../examples/demo/contract.json"), "utf8"));
const manifest = (extra) => ({ format: 1, id: "a-mod", type: "style", request: "a test mod", contract: "^1.0", ...extra });
const style = (css, extra) => review({ manifest: manifest(extra), files: { "style.css": css } }, contract);

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
  assert.equal(checkStyle('a { background: url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'/>") }').ok, true);
});

test("a style that is not well formed is refused, so it cannot close the scope around it", () => {
  for (const css of [
    "} [data-no-mods] * { display: none }",
    "a { color: red } } b { color: blue }",
    "a { color: red",
    "a { content: 'not closed }",
    'a { content: "two\nlines" }',
    "a { width: calc(1px + (2px) }",
    // A quote inside a bare url() is read differently by browsers: it could hide a closing brace.
    "a { background: url(data:x') } } [data-no-mods] * { display: none } b { c: d ') }",
    "a { color: red } /* b */ */ /* c",
    // The plugin scopes every style itself: a scope inside it could reach past the limit.
    '@scope ([data-piece="note"]) { * { display: none } }',
  ]) {
    assert.equal(checkStyle(css).ok, false, css);
  }
  // Braces inside strings and parentheses are text, not structure.
  assert.equal(checkStyle('a::before { content: "}"; } b { width: calc((1px + 2px) * 2) }').ok, true);
});

test("@font-face and @keyframes are taken out exactly, even with braces inside strings", () => {
  const css = '@keyframes x { from { content: "{" } } [data-piece="note"] { animation: x 1s } a { content: "}" }';
  const walked = walkStyle(css);
  assert.ok(walked.ok);
  assert.match(walked.hoisted, /^@keyframes x \{[\s\S]*\}$/);
  assert.doesNotMatch(walked.hoisted, /data-piece/);
  assert.match(walked.css, /\[data-piece="note"\]/);
});

test("a style mod is scoped away from the zones without mods", () => {
  const out = compileStyle(":root { --radius-button: 14px; }", contract);
  assert.match(out.css, /^@scope \(:root\) to \(\[data-no-mods\]\)/);
  // :root never matches inside @scope, so it is rewritten to :scope (the root element).
  assert.match(out.css, /:scope \{\s*--radius-button: 14px !important;/);
  const more = compileStyle('html { --radius-card: 0 } html [data-piece="note"], :root.dark { color: red }', contract);
  assert.match(more.css, /:scope \{[\s\S]*:scope \[data-piece="note"\], :scope\.dark \{/);
});

test("a mod wins over the app's own styles: every declaration is !important", () => {
  const out = compileStyle('[data-piece="note"] { color: red; margin: 0 !important } @media (min-width: 600px) { [data-piece="note"] { padding: 0 } }', contract);
  assert.match(out.css, /color: red !important;/);
  assert.match(out.css, /margin: 0 !important;/);
  assert.doesNotMatch(out.css, /!important\s*!important/);
  assert.match(out.css, /@media \(min-width: 600px\) \{\s*\[data-piece="note"\] \{\s*padding: 0 !important;/);
  // Inside @keyframes an !important declaration would be dropped by the browser: they stay as written.
  const frames = compileStyle('@keyframes spin { to { rotate: 1turn } } [data-piece="toolbar"] { animation: spin 2s; }', contract);
  assert.ok(frames.css.startsWith("@keyframes spin"));
  assert.match(frames.css, /rotate: 1turn;/);
  assert.match(frames.css, /@scope[\s\S]*toolbar[\s\S]*animation: spin 2s !important/);
});

test("a deprecated name still works, rewritten, and the mod says so", () => {
  const v = style(":root { --r-button: 20px; }");
  assert.equal(v.state, "deprecated");
  assert.match(v.css, /--radius-button: 20px/);
});

test("a name the contract does not have breaks the mod instead of failing silently", () => {
  assert.equal(style(":root { --made-up: 1px; }").state, "broken");
  assert.equal(style(':root { --mod-gap: 4px; } [data-piece="toolbar"] { gap: var(--mod-gap); }').state, "applied");
  assert.equal(style('[data-piece="nope"] { gap: 0 }').state, "broken");
});

test("touches lists what the mod needs; a missing piece breaks it", () => {
  assert.equal(style("", { touches: ["piece:gone"] }).state, "broken");
});

test("another contract range applies, but asks for an update", () => {
  assert.equal(style(":root { --radius-button: 2px; }", { contract: "^2.0" }).state, "deprecated");
});

test("a bad manifest is rejected with a reason, never thrown", () => {
  assert.equal(review({ manifest: "{ nope", files: {} }, contract).state, "rejected");
  assert.equal(review({ manifest: manifest({ type: "function" }), files: {} }, contract).state, "rejected");
  assert.equal(review({ manifest: manifest({ format: 2 }), files: {} }, contract).notes[0], "format 2 is newer than this plugin understands");
});

test("a mod that is off stays off, and the app can start with every mod off", () => {
  assert.equal(review({ manifest: manifest(), files: { "style.css": "" }, enabled: false }, contract).state, "off");
  const safe = review({ manifest: manifest(), files: { "style.css": ":root { --radius-button: 2px }" } }, contract, { off: true });
  assert.equal(safe.state, "off");
  assert.equal(safe.css, undefined);
});

test("a window without @scope reports style mods instead of applying them unscoped", () => {
  const v = review({ manifest: manifest(), files: { "style.css": ":root { --radius-button: 2px }" } }, contract, { scope: false });
  assert.equal(v.state, "broken");
  assert.equal(v.css, undefined);
});

test("structure orders and hides with CSS, only inside known zones", () => {
  const ok = compileStructure(JSON.stringify({ zones: { sidebar: { order: ["today", "inbox"], hidden: ["usage"] } } }), contract);
  assert.match(ok.css, /\[data-zone="sidebar"\] > \[data-piece="today"\] \{ order: 1 !important; \}/);
  assert.match(ok.css, /display: none !important/);
  const bad = compileStructure(JSON.stringify({ zones: { sidebar: { hidden: ["keys"] } } }), contract);
  assert.equal(bad.state, "broken");
});

test("a mood wins over the app's own colors and says if it is dark or light", () => {
  const colors = { background: "#102126", surface: "#17323B", text: "#DCEFEF", muted: "#8FB3B6", accent: "#6FD3C5", accentText: "#0B1F1D", border: "#28505A" };
  const out = compileMood(JSON.stringify({ scheme: "dark", colors }), contract);
  assert.equal(out.scheme, "dark");
  assert.match(out.css, /^:root \{ color-scheme: dark !important; --bg: #102126 !important;/);
  // An app that keeps its variables below the root says where, and the mood goes there.
  const onBody = compileMood(JSON.stringify({ scheme: "dark", colors }), { ...contract, root: "body" });
  assert.match(onBody.css, /\nbody \{ --bg: #102126 !important;/);
  assert.match(compileStyle(":root { --radius-button: 1px }", { ...contract, root: "body" }).css, /^@scope \(body\) to/);
  const low = compileMood(JSON.stringify({ scheme: "dark", colors: { ...colors, text: "#17323B" } }), contract);
  assert.match(low.notes[0], /text on background is .* under 4\.5:1/);
});

test("the four built-in moods pass every check, with no contrast warning", () => {
  const dir = here("../skills/moods/moods/");
  const ids = readdirSync(dir);
  assert.deepEqual(ids.sort(), ["bright", "calm", "dream", "focus"]);
  for (const id of ids) {
    const read = (f) => readFileSync(path.join(dir, id, f), "utf8");
    const v = review({ manifest: read("mod.json"), files: { "mood.json": read("mood.json") } }, contract);
    assert.equal(v.state, "applied", `${id}: ${v.notes.join("; ")}`);
    assert.deepEqual(v.notes, [], id);
  }
});

test("the folder reader brings every mod, and a broken folder comes back with its reason", async () => {
  const mods = await readModsFolder(here("../examples/demo/user-mods/"));
  const states = Object.fromEntries(mods.map((m) => [m.id, review(m, contract).state]));
  assert.deepEqual(states, {
    "bigger-text": "applied", "rounder-corners": "applied", "sneaky-tracker": "rejected", "square-buttons": "deprecated", "today-first": "applied",
  });

  const dir = await mkdtemp(path.join(tmpdir(), "mods-test-"));
  try {
    await mkdir(path.join(dir, "renamed"));
    await writeFile(path.join(dir, "renamed", "mod.json"), JSON.stringify(manifest({ id: "another-name" })));
    await mkdir(path.join(dir, "empty"));
    await mkdir(path.join(dir, "huge"));
    await writeFile(path.join(dir, "huge", "mod.json"), JSON.stringify(manifest({ id: "huge" })));
    await writeFile(path.join(dir, "huge", "style.css"), "a{}".repeat(100_000));
    const byId = Object.fromEntries((await readModsFolder(dir)).map((m) => [m.id, review(m, contract)]));
    assert.match(byId.renamed.notes[0], /the folder is called renamed but mod.json says the id is another-name/);
    assert.deepEqual([byId.empty.state, byId.empty.notes[0]], ["rejected", "mod.json is missing"]);
    assert.match(byId.huge.notes[0], /style.css is 293 KB, the limit is 256 KB/);
    assert.deepEqual(await readModsFolder(path.join(dir, "not-there")), []);

    // Saving a file inside the folder tells the app to read it again.
    let stop = () => {};
    const changed = new Promise((resolve) => {
      stop = watchModsFolder(dir, () => resolve(true), { delay: 20 });
    });
    await writeFile(path.join(dir, "huge", "style.css"), "a { color: red }");
    assert.equal(await Promise.race([changed, new Promise((r) => setTimeout(() => r(false), 3000))]), true);
    stop();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the command-line check says the same as the app and fails when a mod does", () => {
  const run = (...args) => spawnSync(process.execPath, [here("../skills/moods/scripts/check.mjs"), ...args], { encoding: "utf8" });
  const all = run(here("../examples/demo/contract.json"), here("../examples/demo/user-mods"));
  assert.equal(all.status, 1);
  assert.match(all.stdout, /rounder-corners: applies\n/);
  assert.match(all.stdout, /square-buttons: applies, but needs an update\n {2}--r-button is deprecated, use --radius-button/);
  assert.match(all.stdout, /sneaky-tracker: refused\n {2}url\(https:\/\/tracker\.example\/pixel\.png\) is not allowed/);
  const one = run(here("../examples/demo/contract.json"), here("../examples/demo/user-mods/rounder-corners"), "--json");
  assert.equal(one.status, 0);
  assert.equal(JSON.parse(one.stdout)[0].state, "applied");
});

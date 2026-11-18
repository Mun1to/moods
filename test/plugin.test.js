// The rules of the mod format, one test each. Run with `pnpm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkStyle, review, satisfies, compileStyle, compileStructure, compileMood, walkStyle, colorAs, MOODS } from "../skills/moods/runtime/index.js";
import { moodsModule } from "../scripts/moods.mjs";
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

test("a mood is written the way the app keeps its colors: plain, or only the channels", () => {
  assert.equal(colorAs("#102126", "rgb"), "16 33 38");
  assert.equal(colorAs("#102126", "rgb-commas"), "16, 33, 38");
  assert.equal(colorAs("#ffffff", "hsl"), "0 0% 100%");
  assert.equal(colorAs("#ff0000", "hsl"), "0 100% 50%");
  const colors = { background: "#102126", surface: "#17323B", text: "#DCEFEF", muted: "#8FB3B6", accent: "#6FD3C5", accentText: "#0B1F1D", border: "#28505A" };
  const mood = JSON.stringify({ scheme: "dark", colors });
  // The way many apps do it: `--background: 0 0% 100%`, used as `hsl(var(--background))`.
  const channels = { ...contract, roles: { ...contract.roles, background: { variable: "--background", as: "hsl" }, accent: { variable: "--brand", as: "rgb" } } };
  const out = compileMood(mood, channels);
  assert.match(out.css, /--background: [\d.]+ [\d.]+% [\d.]+% !important;/);
  assert.match(out.css, /--brand: 111 211 197 !important;/);
  assert.match(out.css, /--panel: #17323B !important;/);
  // A style mod may set those variables too: they are names of the contract.
  assert.equal(review({ manifest: manifest(), files: { "style.css": ":root { --background: 0 0% 0% }" } }, channels).state, "applied");
  const odd = compileMood(mood, { ...contract, roles: { ...contract.roles, text: { variable: "--fg", as: "oklch" } } });
  assert.deepEqual([odd.state, odd.notes[0]], ["broken", "the app keeps text as oklch, and this plugin writes hex, hsl, rgb, rgb-commas"]);
});

test("the moods a window ships are the mood folders, letter by letter", async () => {
  assert.equal(await readFile(here("../skills/moods/runtime/moods.js"), "utf8"), await moodsModule(), "run `pnpm moods`");
  assert.deepEqual(MOODS.map((m) => m.id), ["calm", "focus", "dream", "bright"]);
  for (const mood of MOODS) assert.equal(review(mood, contract).state, "applied", mood.id);
});

test("one command gets an app ready: the plugin, a drafted contract, the guide and the note for agents", async () => {
  const app = await mkdtemp(path.join(tmpdir(), "mods-init-"));
  const forAgents = path.join(app, "AGENTS.md");
  const init = () => spawnSync(process.execPath, [here("../skills/moods/scripts/init.mjs"), app], { encoding: "utf8" });
  try {
    await mkdir(path.join(app, "src"));
    await mkdir(path.join(app, "node_modules", "other"), { recursive: true });
    await writeFile(path.join(app, "package.json"), JSON.stringify({ name: "tiny-app", version: "2.0.0" }));
    await writeFile(path.join(app, "node_modules", "other", "x.css"), ":root { --bg: red; --text: blue }");
    await writeFile(forAgents, "# Tiny app\n\nUse pnpm.\n");
    await writeFile(path.join(app, "src", "index.html"), '<header data-piece="toolbar"></header><section data-no-mods="keys"></section>');
    // The way an app made with a popular component kit keeps its colors: only the channels.
    await writeFile(path.join(app, "src", "styles.css"), `:root {
  --background: 0 0% 100%; --foreground: 222.2 47.4% 11.2%; --card: 0 0% 98%; --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%; --primary: 222.2 47.4% 11.2%; --primary-foreground: 210 40% 98%;
  --accent: 210 40% 96.1%; --border: 214.3 31.8% 91.4%; --radius: 0.5rem; --tw-ring: 1px;
}
body { background: hsl(var(--background)); color: hsl(var(--foreground)); border-radius: var(--radius); }`);
    const first = init();
    assert.equal(first.status, 0, first.stderr);
    const drafted = JSON.parse(await readFile(path.join(app, "src", "mods", "contract.json"), "utf8"));
    assert.equal(drafted.app, "tiny-app");
    assert.deepEqual(drafted.roles, {
      background: { variable: "--background", as: "hsl" }, surface: { variable: "--card", as: "hsl" },
      text: { variable: "--foreground", as: "hsl" }, muted: { variable: "--muted-foreground", as: "hsl" },
      accent: { variable: "--primary", as: "hsl" }, accentText: { variable: "--primary-foreground", as: "hsl" },
      border: { variable: "--border", as: "hsl" },
    });
    assert.ok(drafted.variables["--radius"], "the corner is offered");
    assert.equal(drafted.variables["--tw-ring"], undefined);
    assert.deepEqual([Object.keys(drafted.pieces), drafted.noMods], [["toolbar"], ["keys", "way-back"]]);
    // The draft is good enough for every built-in mood to apply.
    for (const mood of MOODS) assert.equal(review(mood, drafted).state, "applied", mood.id);
    assert.match(await readFile(path.join(app, "src", "mods", "index.js"), "utf8"), /startMods/);
    assert.match(await readFile(path.join(app, "MODS.md"), "utf8"), /^# Mods for tiny-app/);
    const note = await readFile(forAgents, "utf8");
    assert.match(note, /^# Tiny app\n\nUse pnpm\.\n\n<!-- mods:start -->\n## Changing how tiny-app looks: make a mod, do not edit the app/);
    assert.match(note, /The names a mod may use are in `src\/mods\/contract\.json`/);

    // Again: the plugin is copied again, and what the maintainer wrote is left alone.
    await writeFile(path.join(app, "src", "mods", "contract.json"), JSON.stringify({ ...drafted, app: "Edited by hand" }));
    const second = init();
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /Kept src\/mods\/contract\.json as it was/);
    assert.equal(JSON.parse(await readFile(path.join(app, "src", "mods", "contract.json"), "utf8")).app, "Edited by hand");
    assert.equal((await readFile(forAgents, "utf8")).match(/mods:start/g).length, 1);
  } finally {
    await rm(app, { recursive: true, force: true });
  }
});

test("the folder readers for Node, Python and Rust say the same about the same folder", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "mods-readers-"));
  const crate = await mkdtemp(path.join(tmpdir(), "mods-reader-crate-"));
  try {
    const put = async (name, files) => {
      await mkdir(path.join(dir, name));
      for (const [file, text] of Object.entries(files)) await writeFile(path.join(dir, name, file), text);
    };
    await put("good", { "mod.json": JSON.stringify(manifest({ id: "good", name: "Añil" })), "style.css": ":root { --radius-button: 2px }\n" });
    await put("mood", { "mod.json": JSON.stringify(manifest({ id: "mood", type: "mood" })), "mood.json": "{}" });
    await put("renamed", { "mod.json": JSON.stringify(manifest({ id: "another-name" })) });
    await put("no-file", { "mod.json": JSON.stringify(manifest({ id: "no-file" })) });
    await put("not-json", { "mod.json": "{ nope" });
    await put("odd-type", { "mod.json": JSON.stringify(manifest({ id: "odd-type", type: "function" })) });
    await put("empty", {});
    await put(".hidden", { "mod.json": JSON.stringify(manifest({ id: "hidden" })) });
    await put("huge", { "mod.json": JSON.stringify(manifest({ id: "huge" })), "style.css": "a{}".repeat(100_000) });
    await put("linked", { "mod.json": JSON.stringify(manifest({ id: "linked" })) });
    // A link in place of the file: no reader follows it. Where the system does not allow links, the file is just missing.
    await symlink(path.join(dir, "good", "style.css"), path.join(dir, "linked", "style.css")).catch(() => {});
    await writeFile(path.join(dir, "a-file.txt"), "not a mod");

    const node = JSON.parse(JSON.stringify(await readModsFolder(dir)));
    assert.deepEqual(node.map((m) => m.id), ["empty", "good", "huge", "linked", "mood", "no-file", "not-json", "odd-type", "renamed"]);
    assert.deepEqual(node.find((m) => m.id === "linked").files, {}, "a link is not read");

    const python = ["python3", "python", "py"].find((bin) => /^Python 3/.test(spawnSync(bin, ["--version"], { encoding: "utf8" }).stdout ?? ""));
    if (python) {
      const run = spawnSync(python, [here("../skills/moods/templates/read_mods.py"), dir], { encoding: "utf8" });
      assert.equal(run.status, 0, run.stderr);
      assert.deepEqual(JSON.parse(run.stdout), node, "Python");
    } else {
      t.diagnostic("Python is not on this computer: its reader was not compared");
    }

    if (spawnSync("cargo", ["--version"], { encoding: "utf8" }).status === 0) {
      await mkdir(path.join(crate, "src"));
      await writeFile(path.join(crate, "Cargo.toml"), '[package]\nname = "reader"\nversion = "0.0.0"\nedition = "2021"\n\n[dependencies]\nserde = { version = "1", features = ["derive"] }\nserde_json = "1"\n');
      await writeFile(path.join(crate, "src", "main.rs"), `#[path = ${JSON.stringify(here("../skills/moods/templates/read_mods.rs"))}]
mod read_mods;
fn main() {
    let dir = std::env::args().nth(1).unwrap();
    println!("{}", serde_json::to_string(&read_mods::read_mods_folder(std::path::Path::new(&dir))).unwrap());
}
`);
      const run = spawnSync("cargo", ["run", "--quiet", "--manifest-path", path.join(crate, "Cargo.toml"), "--", dir], {
        encoding: "utf8", env: { ...process.env, CARGO_TARGET_DIR: path.join(tmpdir(), "mods-reader-target") },
      });
      if (run.status !== 0 && /failed to (download|get|fetch)|could not resolve|network/i.test(run.stderr)) {
        t.diagnostic("cargo could not download serde: the Rust reader was not compared");
      } else {
        assert.equal(run.status, 0, run.stderr);
        assert.deepEqual(JSON.parse(run.stdout), node, "Rust");
      }
    } else {
      t.diagnostic("Rust is not on this computer: its reader was not compared");
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(crate, { recursive: true, force: true });
  }
});

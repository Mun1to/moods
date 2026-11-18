// What the plugin promises on a real page, measured in a real browser without a window.
// Skipped when the computer has no Chrome, Edge or Chromium (set CHROME_PATH to point at one).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { findBrowser, launch } from "../scripts/lib/browser.mjs";
import { startServer } from "../scripts/serve.mjs";
import { MOODS } from "../skills/moods/runtime/index.js";

const MOODS_BRIGHT = /** @type {string} */ (MOODS.find((m) => m.id === "bright")?.files?.["mood.json"]);

const skip = findBrowser() ? false : "no Chrome, Edge or Chromium on this computer";
/** @type {Awaited<ReturnType<typeof launch>>} */
let browser;
/** @type {Awaited<ReturnType<typeof startServer>>} */
let server;

before(async () => {
  if (skip) return;
  server = await startServer({ port: 0 });
  browser = await launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const DARK = { scheme: "dark", colors: { background: "#102126", surface: "#17323B", text: "#DCEFEF", muted: "#8FB3B6", accent: "#6FD3C5", accentText: "#0B1F1D", border: "#28505A" } };
const ZONE = ["--bg", "--panel", "--fg", "--accent", "--radius", "color", "background-color", "border-top-color", "border-top-left-radius", "letter-spacing"];
const BUTTON = ["background-color", "color", "border-top-left-radius", "outline-style"];

async function open() {
  const page = await browser.newPage();
  await page.goto(`${server.url}/test/fixtures/app.html`);
  await page.waitFor("window.ready");
  return page;
}

test("a mood and a style mod win over the app's own rules, also the inline ones", { skip }, async () => {
  const page = await open();
  try {
    const verdicts = await page.evaluate((mood) => host.apply([
      mod("calm", "mood", JSON.stringify(mood)),
      mod("round", "style", ':root { --radius: 20px } [data-piece="note"] { padding: 30px }'),
    ]), DARK);
    assert.deepEqual(verdicts.map((v) => v.state), ["applied", "applied"]);
    // The app sets its colors on :root[data-theme] and the accent inline: the mood still wins.
    const body = await page.evaluate(() => look("body", ["background-color", "color", "--accent"]));
    assert.deepEqual(body, { "background-color": "rgb(16, 33, 38)", color: "rgb(220, 239, 239)", "--accent": "#6FD3C5" });
    // The app's own rule for the note has three classes and an id: the mod still wins.
    const note = await page.evaluate(() => look('[data-piece="note"]', ["border-top-left-radius", "padding-top", "border-top-color"]));
    assert.deepEqual(note, { "border-top-left-radius": "20px", "padding-top": "30px", "border-top-color": "rgb(40, 80, 90)" });
    // One <style> per mod, and one for the zones without mods.
    assert.equal(await page.evaluate(() => document.querySelectorAll("style[data-mods-runtime]").length), 3);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test("a zone without mods keeps the app's own look, whatever is on", { skip }, async () => {
  const page = await open();
  try {
    // The app's own dark look, with no mod: what the zone has to keep under a dark mood.
    const own = await page.evaluate((zoneProps, buttonProps) => {
      document.documentElement.dataset.theme = "dark";
      const out = { zone: look("[data-no-mods]", zoneProps), button: look("#keys-button", buttonProps) };
      document.documentElement.dataset.theme = "light";
      return out;
    }, ZONE, BUTTON);
    const seen = await page.evaluate((mood, zoneProps, buttonProps) => {
      host.apply([
        mod("calm", "mood", JSON.stringify(mood)),
        mod("loud", "style", ":root { --radius: 20px; letter-spacing: 3px } * { outline: 3px solid red } [data-no-mods] { display: none } [data-no-mods] button { background: red }"),
      ]);
      return {
        zone: look("[data-no-mods]", zoneProps),
        button: look("#keys-button", buttonProps),
        outside: look('[data-piece="note"]', ["outline-style", "letter-spacing"]),
        display: look("[data-no-mods]", ["display"]).display,
        schemes: window.schemes,
      };
    }, DARK, ZONE, BUTTON);
    assert.deepEqual(seen.zone, own.zone);
    assert.deepEqual(seen.button, own.button);
    assert.equal(seen.display, "block");
    // The same mod does reach everything outside the zone.
    assert.deepEqual(seen.outside, { "outline-style": "solid", "letter-spacing": "3px" });
    assert.deepEqual(seen.schemes, ["dark"]);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test("when the app changes its own look, the zone follows and the mods stay", { skip }, async () => {
  const page = await open();
  try {
    await page.evaluate(() => host.apply([mod("round", "style", ":root { --radius: 20px; --accent: #aa0000 }")]));
    assert.equal((await page.evaluate(() => look("[data-no-mods]", ["--accent"])))["--accent"], "#0066ff");
    // The person picks another accent in the app's own settings.
    await page.evaluate(() => document.documentElement.style.setProperty("--accent", "#00aa55"));
    await page.waitFor(`look("[data-no-mods]", ["--accent"])["--accent"] === "#00aa55"`, 3000);
    assert.equal((await page.evaluate(() => look("body", ["--accent"])))["--accent"], "#aa0000");
    // A change the pins do not hold (a scroll position, say) does not make the plugin work again.
    await page.evaluate(() => {
      window.firstStyle = document.querySelector("style[data-mods-runtime]");
      document.documentElement.style.setProperty("--scroll", "42px");
    });
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(await page.evaluate(() => window.firstStyle === document.querySelector("style[data-mods-runtime]")), true);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

test("structure, a refused mod, a start without mods and the way back", { skip }, async () => {
  const page = await open();
  try {
    const verdicts = await page.evaluate(() => host.apply([
      mod("today-first", "structure", JSON.stringify({ zones: { sidebar: { order: ["today"], hidden: ["usage"] } } })),
      mod("tracker", "style", "a { background: url(https://tracker.example/pixel.png) }"),
      mod("escape", "style", "} [data-no-mods] * { display: none }"),
    ]));
    assert.deepEqual(verdicts.map((v) => v.state), ["applied", "rejected", "rejected"]);
    const order = await page.evaluate(() => ["today", "inbox", "usage"].map((p) => look(`[data-piece="${p}"]`, ["order", "display"])));
    assert.deepEqual(order, [{ order: "1", display: "block" }, { order: "2", display: "block" }, { order: "2", display: "none" }]);
    assert.equal(await page.evaluate(() => look("#keys-text", ["display"]).display), "block");

    const off = await page.evaluate((mood) => host.apply([mod("calm", "mood", JSON.stringify(mood))], { off: true }), DARK);
    assert.deepEqual([off[0].state, off[0].notes[0]], ["off", "the app started with every mod off"]);
    assert.equal(await page.evaluate(() => document.querySelectorAll("style[data-mods-runtime]").length), 0);

    await page.evaluate((mood) => host.apply([mod("calm", "mood", JSON.stringify(mood))]), DARK);
    await page.evaluate(() => host.clear());
    const back = await page.evaluate(() => ({
      styles: document.querySelectorAll("style[data-mods-runtime]").length,
      theme: document.documentElement.dataset.theme,
      bg: look("body", ["background-color"])["background-color"],
    }));
    assert.deepEqual(back, { styles: 0, theme: "light", bg: "rgb(255, 255, 255)" });
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

// The quickstart app is the whole integration: `startMods({ contract })` and the <moods-panel> tag.
const QUICK = "/examples/quickstart/";
const inPanel = (/** @type {string} */ code) => `(() => { const panel = document.querySelector("moods-panel"); const root = panel.shadowRoot; ${code} })()`;

async function quick(query = "") {
  const page = await browser.newPage({ width: 1280, height: 900, colorScheme: "light" });
  await page.goto(`${server.url}${QUICK}${query}`);
  await page.waitFor("window.ready");
  return page;
}

test("two lines and a tag: the moods, the person's mods, what is remembered and the way back", { skip }, async () => {
  const page = await quick();
  try {
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto(`${server.url}${QUICK}`);
    await page.waitFor("window.ready");
    const own = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.equal(own, "rgb(251, 250, 247)");
    // The panel offers the app's own look and the four moods, and a click on one changes the app.
    assert.deepEqual(await page.evaluate(inPanel('return [...root.querySelectorAll(".mood")].map((b) => b.textContent)')),
      ["Original", "Calm", "Focus", "Dream", "Bright"]);
    await page.evaluate(inPanel('root.querySelectorAll(".mood")[1].click()'));
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(16, 33, 38)");
    assert.equal(await page.evaluate(inPanel('return root.querySelector(\'.mood[aria-pressed="true"]\').textContent')), "Calm");
    // The button that turns every mod off keeps the app's own colors under any mood.
    const wayBack = await page.evaluate(() => {
      const c = getComputedStyle(document.querySelector('[data-no-mods="way-back"]'));
      return [c.color, c.backgroundColor];
    });
    assert.deepEqual(wayBack, ["rgb(30, 27, 36)", "rgb(255, 255, 255)"]);

    // A mod of the person: kept in this browser, applied at once, listed with its switch.
    const added = await page.evaluate(async () => {
      const get = async (/** @type {string} */ file) => (await fetch(file)).text();
      const row = window.mods.add({ id: "rounder-corners", manifest: await get("mods/rounder-corners/mod.json"), files: { "style.css": await get("mods/rounder-corners/style.css") } });
      return [row.state, getComputedStyle(document.querySelector(".go")).borderTopLeftRadius];
    });
    assert.deepEqual(added, ["applied", "16px"]);
    // One that the gate refuses is not kept, and the person gets the reason.
    const refused = await page.evaluate(() => {
      const row = window.mods.add({ manifest: { format: 1, id: "tracker", type: "style", request: "x", contract: "^1.0" }, files: { "style.css": "a { background: url(https://tracker.example/p.png) }" } });
      return [row.state, row.notes[0], window.mods.list.some((m) => m.id === "tracker")];
    });
    assert.deepEqual(refused, ["rejected", "url(https://tracker.example/p.png) is not allowed: only data: URIs and #fragments", false]);
    assert.deepEqual(await page.evaluate(inPanel('return [...root.querySelectorAll(".mod b")].map((b) => b.textContent)')), ["Rounder corners"]);

    // It is all still there after closing and opening the app.
    await page.goto(`${server.url}${QUICK}`);
    await page.waitFor("window.ready");
    assert.deepEqual(await page.evaluate(() => [window.mods.mood, getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector(".go")).borderTopLeftRadius]),
      ["calm", "rgb(16, 33, 38)", "16px"]);
    // The switch of a mod, and then the button that turns them all off and back on.
    await page.evaluate(inPanel('root.querySelector(".switch").click()'));
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".go")).borderTopLeftRadius), "6px");
    await page.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('[data-no-mods="way-back"]')).click());
    assert.deepEqual(await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, document.querySelector('[data-no-mods="way-back"]').textContent, document.querySelectorAll("style[data-mods-runtime]").length]),
      [own, "Turn mods back on", 0]);
    await page.evaluate(() => /** @type {HTMLElement} */ (document.querySelector('[data-no-mods="way-back"]')).click());
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(16, 33, 38)");

    // From outside the window: the address that starts the app with every mod off.
    await page.goto(`${server.url}${QUICK}?mods=off`);
    await page.waitFor("window.ready");
    assert.deepEqual(await page.evaluate(() => [window.mods.safeStart, getComputedStyle(document.body).backgroundColor, window.mods.list.every((m) => m.state === "off")]),
      [true, own, true]);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.evaluate(() => { localStorage.clear(); });
    await page.close();
  }
});

test("a mood reaches an app that keeps only the channels of its colors, and looking again costs nothing", { skip }, async () => {
  const page = await quick("?mods=off");
  try {
    const result = await page.evaluate(async () => {
      window.mods.stop();
      const { createModHost, MOODS } = await import("/skills/moods/runtime/index.js");
      const box = document.createElement("div");
      box.style.cssText = "background: hsl(var(--kit-bg)); color: rgb(var(--kit-fg)); border: 1px solid rgb(var(--kit-line))";
      document.body.append(box);
      document.documentElement.style.setProperty("--kit-bg", "0 0% 100%");
      document.documentElement.style.setProperty("--kit-fg", "0 0 0");
      document.documentElement.style.setProperty("--kit-line", "0, 0, 0");
      const plain = (/** @type {string} */ variable) => variable;
      const host = createModHost({
        contract: {
          contract: "1.0.0",
          roles: {
            background: { variable: "--kit-bg", as: "hsl" }, text: { variable: "--kit-fg", as: "rgb" }, border: { variable: "--kit-line", as: "rgb-commas" },
            surface: plain("--panel"), muted: plain("--fg-quiet"), accent: plain("--accent"), accentText: plain("--on-accent"),
          },
        },
      });
      const states = host.apply(MOODS).map((v) => v.state);
      const look = getComputedStyle(box);
      const painted = [look.backgroundColor, look.color, look.borderTopColor];
      // Applying the same mods again reviews nothing and leaves the same <style> elements in place.
      const before = [...document.querySelectorAll("style[data-mods-runtime]")];
      host.refresh();
      const after = [...document.querySelectorAll("style[data-mods-runtime]")];
      return { states, painted, kept: before.length > 0 && before.every((el, i) => el === after[i] && !el.disabled) };
    });
    assert.deepEqual(result.states, ["applied", "applied", "applied", "applied"]);
    // The last mood of the list is on top: Bright. Its colors, whatever way the app keeps them.
    const near = (/** @type {string} */ got, /** @type {number[]} */ want) => (got.match(/[\d.]+/g) ?? []).slice(0, 3).every((n, i) => Math.abs(Number(n) - want[i]) <= 1);
    const bright = JSON.parse(MOODS_BRIGHT).colors;
    const rgb = (/** @type {string} */ hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(near(result.painted[0], rgb(bright.background)), `background ${result.painted[0]}`);
    assert.ok(near(result.painted[1], rgb(bright.text)), `text ${result.painted[1]}`);
    assert.ok(near(result.painted[2], rgb(bright.border)), `border ${result.painted[2]}`);
    assert.equal(result.kept, true);
    assert.deepEqual(page.errors, []);
  } finally {
    await page.close();
  }
});

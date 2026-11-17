// What the plugin promises on a real page, measured in a real browser without a window.
// Skipped when the computer has no Chrome, Edge or Chromium (set CHROME_PATH to point at one).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { findBrowser, launch } from "../scripts/lib/browser.mjs";
import { startServer } from "../scripts/serve.mjs";

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

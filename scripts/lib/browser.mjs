// A real browser without a window and without dependencies: it starts the Chrome, Edge or
// Chromium already on the computer and drives it over the DevTools protocol. The tests use it to
// measure what a mod does on a real page, and `pnpm shots` uses it for the README screenshots.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** The browser to use: `CHROME_PATH` if set, or the first one found in the usual places. */
export function findBrowser() {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const places = process.platform === "win32"
    ? [
        "Google/Chrome/Application/chrome.exe",
        "Microsoft/Edge/Application/msedge.exe",
        "Chromium/Application/chrome.exe",
      ].flatMap((p) => [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean).map((base) => path.join(String(base), p)))
    : process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : [];
  for (const place of places) if (existsSync(place)) return place;
  if (process.platform !== "win32") {
    for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]) {
      const found = spawnSync("which", [name], { encoding: "utf8" });
      if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
    }
  }
  return null;
}

/**
 * Starts the browser. Always call `close()` on what comes back, also when something fails.
 * @param {{ executable?: string }} [options]
 */
export async function launch({ executable = findBrowser() ?? "" } = {}) {
  if (!executable) throw new Error("No Chrome, Edge or Chromium found. Set CHROME_PATH to the browser to use.");
  const profile = await mkdtemp(path.join(tmpdir(), "mods-browser-"));
  const args = [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
    "--disable-gpu", "--hide-scrollbars", "--disable-extensions", "--disable-background-networking", "--mute-audio",
    ...(process.env.CI ? ["--no-sandbox"] : []),
    "about:blank",
  ];
  const child = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] });
  const endpoint = await new Promise((resolve, reject) => {
    let log = "";
    const timer = setTimeout(() => reject(new Error(`The browser did not start in time.\n${log}`)), 30000);
    child.stderr.on("data", (chunk) => {
      log += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(log);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`The browser closed before it was ready (code ${code}).\n${log}`));
    });
  });

  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("Could not connect to the browser.")), { once: true });
  });
  let nextId = 0;
  /** @type {Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>} */
  const waiting = new Map();
  /** @type {Set<(message: any) => void>} */
  const listeners = new Set();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id !== undefined) {
      const entry = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) entry?.reject(new Error(message.error.message));
      else entry?.resolve(message.result);
    } else {
      for (const listener of listeners) listener(message);
    }
  });
  /** @param {string} method @param {object} [params] @param {string} [sessionId] */
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      waiting.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

  async function newPage({ width = 1280, height = 800, deviceScaleFactor = 1, colorScheme = "light" } = {}) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    /** @param {string} method @param {object} [params] */
    const cdp = (method, params) => send(method, params, sessionId);
    /** @type {string[]} */
    const errors = [];
    /** @type {Set<(message: any) => void>} */
    const mine = new Set();
    const listener = (/** @type {any} */ message) => {
      if (message.sessionId !== sessionId) return;
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        errors.push(message.params.args.map((/** @type {any} */ a) => a.value ?? a.description ?? "").join(" "));
      }
      if (message.method === "Log.entryAdded" && message.params.entry.level === "error") errors.push(message.params.entry.text);
      for (const fn of mine) fn(message);
    };
    listeners.add(listener);
    await cdp("Page.enable");
    await cdp("Runtime.enable");
    await cdp("Log.enable");

    const page = {
      errors,
      /** @param {{ width: number, height: number, deviceScaleFactor?: number }} size */
      async setViewport(size) {
        await cdp("Emulation.setDeviceMetricsOverride", { width: size.width, height: size.height, deviceScaleFactor: size.deviceScaleFactor ?? 1, mobile: false });
      },
      /** @param {"light" | "dark"} scheme what the system asks for */
      async setColorScheme(scheme) {
        await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
      },
      /** @param {string} url */
      async goto(url) {
        const loaded = new Promise((resolve) => {
          const fn = (/** @type {any} */ message) => {
            if (message.method === "Page.loadEventFired") {
              mine.delete(fn);
              resolve(undefined);
            }
          };
          mine.add(fn);
        });
        await cdp("Page.navigate", { url });
        await loaded;
      },
      /**
       * Runs code in the page and brings back its value. Pass a function and its arguments, or an expression.
       * @param {string | Function} code
       * @param {...unknown} args
       */
      async evaluate(code, ...args) {
        const expression = typeof code === "function" ? `(${code})(...${JSON.stringify(args)})` : code;
        const out = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
        if (out.exceptionDetails) throw new Error(out.exceptionDetails.exception?.description ?? out.exceptionDetails.text);
        return out.result.value;
      },
      /** Waits until an expression is true in the page. @param {string} expression @param {number} [timeout] */
      async waitFor(expression, timeout = 15000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          if (await page.evaluate(`Boolean(${expression})`)) return;
          await new Promise((r) => setTimeout(r, 50));
        }
        throw new Error(`Waited ${timeout} ms for: ${expression}`);
      },
      /** @param {{ path: string, fullPage?: boolean, clip?: { x: number, y: number, width: number, height: number } }} options */
      async screenshot({ path: file, fullPage = false, clip }) {
        const params = { format: "png", captureBeyondViewport: fullPage || Boolean(clip) };
        if (fullPage) {
          const size = await page.evaluate("({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })");
          Object.assign(params, { clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } });
        } else if (clip) {
          Object.assign(params, { clip: { ...clip, scale: 1 } });
        }
        const { data } = await cdp("Page.captureScreenshot", params);
        await writeFile(file, Buffer.from(data, "base64"));
      },
      async close() {
        listeners.delete(listener);
        await send("Target.closeTarget", { targetId }).catch(() => {});
      },
    };
    await page.setViewport({ width, height, deviceScaleFactor });
    await page.setColorScheme(/** @type {"light" | "dark"} */ (colorScheme));
    return page;
  }

  async function close() {
    try {
      await Promise.race([send("Browser.close"), new Promise((r) => setTimeout(r, 3000))]);
    } catch {
      // Already gone.
    }
    socket.close();
    if (child.exitCode === null) {
      await Promise.race([new Promise((r) => child.once("exit", r)), new Promise((r) => setTimeout(r, 3000))]);
      if (child.exitCode === null) child.kill();
    }
    // The profile folder can stay locked for a moment after the browser exits.
    for (let i = 0; i < 10; i++) {
      try {
        await rm(profile, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  return { newPage, close };
}

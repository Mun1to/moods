// A small static server for looking at the project locally: the demo app and the brand sheet.
// `pnpm demo`, then open the address it prints. Only listens on this computer.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 4848);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8",
};
const HIDDEN = /(^|[\\/])(\.|node_modules|AGENTS\.md|BUZON\.md|CLAUDE\.md|GEMINI\.md|docs[\\/](METAS\.md|investigacion))/;

http
  .createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (rel === "/") {
        res.writeHead(302, { location: "/examples/demo/" });
        return res.end();
      }
      if (rel.endsWith("/")) rel += "index.html";
      const file = path.join(root, rel);
      if (!file.startsWith(root + path.sep) || HIDDEN.test(path.relative(root, file))) {
        res.writeHead(404);
        return res.end("not found");
      }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Demo app:    http://127.0.0.1:${port}/examples/demo/`);
    console.log(`Brand sheet: http://127.0.0.1:${port}/brand/`);
  });

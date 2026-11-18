#!/usr/bin/env node
// One door to the tools of the plugin, so they can run without copying anything first:
//
//   npx github:Mun1to/moods init [app folder]
//   npx github:Mun1to/moods check <contract.json> <mods folder>
//   npx github:Mun1to/moods forks <owner/repo>
import { fileURLToPath } from "node:url";

const TOOLS = /** @type {Record<string, [string, string]>} */ ({
  init: ["./init.mjs", "get an app ready for mods: the plugin, a drafted contract, the guide and the note for agents"],
  check: ["./check.mjs", "check mods against the contract of an app, without opening the app"],
  forks: ["./forks.mjs", "see what the forks of an app changed, and so what its contract should offer first"],
});

const [command, ...rest] = process.argv.slice(2);
const tool = TOOLS[command];
if (!tool) {
  const out = command ? console.error : console.log;
  out("Mods for any open source app. Use one of:\n");
  for (const [name, [, about]] of Object.entries(TOOLS)) out(`  ${name.padEnd(6)} ${about}`);
  process.exit(command ? 2 : 0);
}
process.argv = [process.argv[0], fileURLToPath(new URL(tool[0], import.meta.url)), ...rest];
await import(tool[0]);

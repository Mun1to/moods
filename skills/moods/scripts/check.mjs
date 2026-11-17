#!/usr/bin/env node
// Checks mods against the contract of an app, without opening the app.
//
//   node check.mjs <contract.json> <mods folder | one mod folder> [--json]
//
// Prints what the app would say about each mod and why. Exits with 1 when a mod is broken or
// refused, so it also works as a test.
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { review } from "../runtime/index.js";
import { readMod, readModsFolder } from "../runtime/node.js";

const args = process.argv.slice(2);
const json = args.includes("--json");
const [contractPath, target] = args.filter((a) => !a.startsWith("--"));

if (!contractPath || !target) {
  console.error("Usage: node check.mjs <contract.json> <mods folder | one mod folder> [--json]");
  process.exit(2);
}

let contract;
try {
  contract = JSON.parse(await readFile(contractPath, "utf8"));
} catch (error) {
  console.error(`Could not read the contract at ${contractPath}: ${error instanceof Error ? error.message : error}`);
  process.exit(2);
}

const isOneMod = await stat(path.join(target, "mod.json")).then((s) => s.isFile(), () => false);
const mods = isOneMod ? [await readMod(target)] : await readModsFolder(target);
if (!mods.length) {
  console.error(`No mods found in ${target}`);
  process.exit(2);
}

const verdicts = mods.map((mod) => {
  const { css, ...verdict } = review(mod, contract);
  return verdict;
});

if (json) {
  console.log(JSON.stringify(verdicts, null, 2));
} else {
  const WORDS = {
    applied: "applies",
    deprecated: "applies, but needs an update",
    broken: "does not apply, the app changed",
    rejected: "refused",
    off: "off",
  };
  for (const v of verdicts) {
    console.log(`${v.id}: ${WORDS[v.state]}`);
    for (const note of v.notes) console.log(`  ${note}`);
  }
}

process.exit(verdicts.some((v) => v.state === "broken" || v.state === "rejected") ? 1 : 0);

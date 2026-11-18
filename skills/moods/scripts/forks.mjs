#!/usr/bin/env node
// What the forks of an app wanted. Looks at the forks that kept changes of their own and sorts
// them by what they touched: only how the app looks, only its interface, only words, only setup,
// or its logic.
//
//   node forks.mjs <owner/repo> [--sample 150] [--json]
//
// A fork that only changed how the app looks could have been a mod, and the names it changed are
// the ones a contract should offer first. Reads the public GitHub API. Set GITHUB_TOKEN (any token,
// no scopes needed for public repositories) or it stops after 60 requests an hour.
const API = "https://api.github.com";
const args = process.argv.slice(2);
const json = args.includes("--json");
const sampleArg = args.indexOf("--sample");
const sample = sampleArg >= 0 ? Number(args[sampleArg + 1]) : 150;
const repo = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--sample");

if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !Number.isInteger(sample) || sample < 1) {
  console.error("Usage: node forks.mjs <owner/repo> [--sample 150] [--json]");
  process.exit(2);
}

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";

/**
 * @param {string} path
 * @returns {Promise<any>} the parsed answer, or null when GitHub has nothing there
 */
async function get(path) {
  const res = await fetch(API + path, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "mods-fork-census",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 404 || res.status === 409 || res.status === 422 || res.status >= 500) return null;
  if (res.status === 403 || res.status === 429) {
    throw new Error(token
      ? "GitHub is limiting the requests of this token: try again later or with a smaller --sample"
      : "GitHub allows 60 requests an hour without a token: set GITHUB_TOKEN and run it again");
  }
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${path}`);
  return res.json();
}

const STYLE = /\.(css|scss|sass|less|styl|pcss|postcss)$|(^|\/)tailwind\.config\.[cm]?[jt]s$|(^|\/)(themes?|colors?|palette|tokens)(\/|\.[\w.]+$)/i;
const ASSET = /\.(png|jpe?g|gif|svg|ico|icns|webp|avif|bmp|woff2?|ttf|otf|eot)$/i;
const INTERFACE = /\.(tsx|jsx|vue|svelte|astro|html?|erb|hbs|ejs|njk|twig|liquid|xaml|qml)$/i;
const WORDS = /\.(md|mdx|txt|rst|adoc)$|(^|\/)(licen[cs]e|notice|authors|contributors|changelog)[^/]*$|(^|\/)(locales?|i18n|l10n|lang|langs|languages|translations?)\//i;
const SETUP = /(^|\/)(dockerfile[^/]*|docker-compose[^/]*|compose\.ya?ml|makefile|procfile|vercel\.json|netlify\.toml|fly\.toml|render\.yaml|package\.json|[^/]*lock[^/]*|cargo\.toml|pyproject\.toml|requirements[^/]*\.txt)$|^\.github\/|(^|\/)\.[^/]+$|\.(ya?ml|toml|ini|conf|env|example|sh|bat|ps1)$/i;

/** @param {string} file */
function kindOf(file) {
  if (STYLE.test(file)) return "looks";
  if (ASSET.test(file)) return "looks";
  if (WORDS.test(file)) return "words";
  if (INTERFACE.test(file)) return "interface";
  if (SETUP.test(file)) return "setup";
  return "code";
}

const GROUPS = /** @type {const} */ ({
  looks: "Only how it looks (styles, images, fonts)",
  looksWords: "How it looks and its words (often a rebrand)",
  interface: "Only the interface (its screens and styles, no logic)",
  words: "Only words (docs, translations)",
  setup: "Only setup (deploy, build, config)",
  codeLooks: "Its logic, and the interface too",
  code: "Its logic, not the interface",
});

/** @param {Set<string>} kinds @returns {keyof typeof GROUPS} */
function groupOf(kinds) {
  if (kinds.has("code")) return kinds.has("looks") || kinds.has("interface") ? "codeLooks" : "code";
  if (kinds.has("interface")) return "interface";
  if (kinds.has("looks")) return kinds.has("words") ? "looksWords" : "looks";
  if (kinds.has("words") && !kinds.has("setup")) return "words";
  return "setup";
}

const ABOUT = [
  ["colors", /^(color|background(-color|-image)?|border(-[a-z]+)?-color|outline-color|fill|stroke|box-shadow|text-shadow|accent-color|caret-color|opacity)$/],
  ["letter", /^(font(-family|-weight|-style)?|line-height|letter-spacing|text-transform)$/],
  ["corners", /^border(-[a-z]+){0,2}-radius$/],
  ["sizes and space", /^(font-size|padding(-[a-z]+)?|margin(-[a-z]+)?|gap|width|height|max-width|min-width|max-height|min-height)$/],
  ["what shows", /^(display|visibility|order)$/],
];

/**
 * What the added lines of a stylesheet patch are about.
 * @param {string} patch
 * @returns {{ variables: Set<string>, about: Set<string> }}
 */
function readPatch(patch) {
  const variables = new Set();
  const about = new Set();
  for (const line of patch.split("\n")) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    const decl = /^\+\s*(--[\w-]+|[a-z-]+)\s*:/.exec(line);
    if (!decl) continue;
    if (decl[1].startsWith("--")) variables.add(decl[1]);
    else for (const [name, pattern] of ABOUT) if (/** @type {RegExp} */ (pattern).test(decl[1])) about.add(/** @type {string} */ (name));
  }
  return { variables, about };
}

/**
 * @template T, R
 * @param {T[]} items
 * @param {number} width
 * @param {(item: T) => Promise<R>} work
 * @returns {Promise<R[]>}
 */
async function pool(items, width, work) {
  /** @type {R[]} */
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(items[i]);
    }
  }));
  return out;
}

/** @param {Map<string, number>} counts @param {number} n */
const top = (counts, n) => [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
/** @param {Map<string, number>} counts @param {Iterable<string>} names */
const bump = (counts, names) => {
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
};
/** @param {number[]} values */
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

try {
  const parent = await get(`/repos/${repo}`);
  if (!parent) throw new Error(`There is no public repository at ${repo}`);
  const base = `${parent.owner.login}:${parent.default_branch}`;

  // The newest forks that pushed something after they were made. A fork made to send a pull
  // request works on a branch and leaves its main branch alone, so it is not counted below.
  /** @type {any[]} */
  const candidates = [];
  let seen = 0;
  for (let page = 1; page <= 30 && candidates.length < sample; page++) {
    const forks = await get(`/repos/${repo}/forks?sort=newest&per_page=100&page=${page}`);
    if (!forks?.length) break;
    seen += forks.length;
    for (const fork of forks) {
      if (Date.parse(fork.pushed_at) > Date.parse(fork.created_at) + 60_000 && candidates.length < sample) candidates.push(fork);
    }
  }

  const compared = await pool(candidates, 6, async (fork) => {
    const head = encodeURIComponent(fork.default_branch);
    const diff = await get(`/repos/${fork.full_name}/compare/${encodeURIComponent(base)}...${head}?per_page=1`);
    return diff && diff.ahead_by > 0 && diff.files?.length ? { fork, diff } : null;
  });
  const changed = compared.filter((c) => c !== null);

  /** @type {Record<keyof typeof GROUPS, number>} */
  const groups = { looks: 0, looksWords: 0, interface: 0, words: 0, setup: 0, codeLooks: 0, code: 0 };
  const variables = new Map();
  const about = new Map();
  const styleFiles = new Map();
  /** @type {number[]} */
  const behind = [];
  /** @type {{ fork: string, group: string, ahead: number, behind: number, files: number }[]} */
  const rows = [];
  for (const { fork, diff } of changed) {
    const kinds = new Set();
    const itsVariables = new Set();
    const itsAbout = new Set();
    const itsFiles = new Set();
    for (const file of diff.files) {
      kinds.add(kindOf(file.filename));
      if (!STYLE.test(file.filename)) continue;
      itsFiles.add(file.filename);
      const read = readPatch(file.patch ?? "");
      for (const v of read.variables) itsVariables.add(v);
      for (const a of read.about) itsAbout.add(a);
    }
    const group = groupOf(kinds);
    groups[group]++;
    bump(variables, itsVariables);
    bump(about, itsAbout);
    bump(styleFiles, itsFiles);
    behind.push(diff.behind_by);
    rows.push({ fork: fork.full_name, group, ahead: diff.ahead_by, behind: diff.behind_by, files: diff.files.length });
  }

  const total = changed.length;
  const noLogic = groups.looks + groups.looksWords + groups.interface + groups.words + groups.setup;
  const onlyInterface = groups.looks + groups.looksWords + groups.interface;
  const touchedInterface = onlyInterface + groups.codeLooks;
  const result = {
    repository: parent.full_name,
    forks: parent.forks_count,
    lookedAt: seen,
    pushedSomething: candidates.length,
    keptChanges: total,
    groups,
    neverTouchedLogic: noLogic,
    touchedInterface,
    onlyInterface,
    onlyLooks: groups.looks + groups.looksWords,
    medianCommitsBehind: median(behind),
    about: Object.fromEntries(top(about, 10)),
    variables: Object.fromEntries(top(variables, 15)),
    styleFiles: Object.fromEntries(top(styleFiles, 10)),
    rows,
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    /** @param {number} n */
    const share = (n) => (total ? `${Math.round((n / total) * 100)}%` : "0%").padStart(4);
    console.log(`${parent.full_name}: ${parent.forks_count} forks. Looked at the newest ${seen}; ${candidates.length} pushed something, ${total} kept changes of their own on their main branch.`);
    if (!total) process.exit(0);
    console.log("");
    for (const [key, label] of Object.entries(GROUPS)) {
      console.log(`  ${String(groups[/** @type {keyof typeof GROUPS} */ (key)]).padStart(4)} ${share(groups[/** @type {keyof typeof GROUPS} */ (key)])}  ${label}`);
    }
    console.log("");
    console.log(`  ${share(onlyInterface).trim()} changed only the interface: what mods are for.`);
    console.log(`  ${share(touchedInterface).trim()} changed the interface, with or without logic.`);
    console.log(`  Half of these forks are ${result.medianCommitsBehind} commits or more behind the app today.`);
    if (about.size) console.log(`\n  What the style changes were about: ${top(about, 10).map(([n, c]) => `${n} (${c} forks)`).join(", ")}`);
    if (variables.size) console.log(`  Variables they set most: ${top(variables, 15).map(([n, c]) => `${n} (${c})`).join(", ")}`);
    if (styleFiles.size) console.log(`  Style files they changed most: ${top(styleFiles, 8).map(([n, c]) => `${n} (${c})`).join(", ")}`);
    console.log("\n  The variables and files above are what a contract should offer first.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

#!/usr/bin/env node
// Post-build patch for two Agent-Native bundler bugs (decision D03, facts F9).
//
// The Cloudflare bundle replaces Node built-ins with stubs whose safe implementations exist
// only as named exports, while the default export is a Proxy whose getter throws for every
// property. Code that does `import fs from "node:fs"` therefore explodes on the first access:
// the agent-chat plugin init calls `fs.existsSync` and the MCP client config reader calls
// `os.homedir`, which takes down agent chat, the audit actions and the `/mcp` endpoint. This
// script rewrites the two proxy getters in the built bundle so that a small safe table wins
// before the throwing fallback; see docs/plan/upstream-issues/fs-os-default-export-stubs.md.
//
// Each pattern must match exactly once. A different match count means the framework changed
// the stub shape, which is the signal to revisit the patch during an upgrade (D03) — the
// script fails the build rather than guessing.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const bundlePath = path.join(repoRoot, "dist", "_worker.js", "index.js");
const markerPath = path.join(repoRoot, "dist", "_worker.js", "PATCHED.json");

const FS_SAFE =
  "{existsSync:()=>false,readdirSync:()=>[],realpathSync:(v)=>v,mkdirSync:()=>undefined,rmSync:()=>undefined,constants:{},promises:{}}";
const OS_SAFE =
  '{homedir:()=>"/",tmpdir:()=>"/tmp",platform:()=>"linux",hostname:()=>"worker",EOL:"\\n",cpus:()=>[],totalmem:()=>0,freemem:()=>0,release:()=>"",type:()=>"Linux",arch:()=>"x64",userInfo:()=>({username:"worker"})}';

// The regexes are copied verbatim from docs/plan/02-framework-facts.md F9. Capture groups:
// 1 = proxy target, 2 = requested property, 3 = the "unavailable" thrower, 4 = the property
// again inside the thrower's message.
const PATCHES = [
  {
    id: "fs-default-proxy",
    pattern: /get\((\w+),(\w+)\)\{return (\w+)\("fs\."\+String\((\w+)\)\)\}/,
    safe: FS_SAFE,
    module: "fs",
  },
  {
    id: "os-default-proxy",
    pattern: /get\((\w+),(\w+)\)\{return (\w+)\("os\."\+String\((\w+)\)\)\}/,
    safe: OS_SAFE,
    module: "os",
  },
];

/** @param {(typeof PATCHES)[number]} patch */
function replacement(patch) {
  return (
    /** @type {(...groups: string[]) => string} */
    (_match, target, property, thrower, messageProperty) =>
      `get(${target},${property}){const __safe=${patch.safe};` +
      `if(Object.prototype.hasOwnProperty.call(__safe,${property}))return __safe[${property}];` +
      `return ${thrower}("${patch.module}."+String(${messageProperty}))}`
  );
}

/** @param {string} message */
function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(bundlePath)) {
  fail(
    `patch: ${path.relative(repoRoot, bundlePath)} not found — run \`pnpm build:worker\` first`,
  );
}

if (existsSync(markerPath)) {
  /** @type {{ patches?: unknown }} */
  let marker = {};
  try {
    marker = JSON.parse(readFileSync(markerPath, "utf8"));
  } catch {
    marker = {};
  }
  const applied = Array.isArray(marker.patches) ? marker.patches : [];
  if (PATCHES.every((patch) => applied.includes(patch.id))) {
    console.log("already patched");
    process.exit(0);
  }
}

let source = readFileSync(bundlePath, "utf8");

for (const patch of PATCHES) {
  const matches = source.match(new RegExp(patch.pattern.source, "g")) ?? [];
  if (matches.length !== 1) {
    fail(`patch ${patch.id}: expected 1 match, found ${matches.length}`);
  }
  source = source.replace(patch.pattern, replacement(patch));
  console.log(`patch ${patch.id}: ok`);
}

writeFileSync(bundlePath, source);

// coreVersion is read rather than hard-coded so the marker always names the version the patch
// was actually applied against (B14 records it as 0.176.5, which is what this resolves to).
const coreVersion = JSON.parse(
  readFileSync(
    path.join(
      repoRoot,
      "node_modules",
      "@agent-native",
      "core",
      "package.json",
    ),
    "utf8",
  ),
).version;

writeFileSync(
  markerPath,
  `${JSON.stringify(
    {
      patches: PATCHES.map((patch) => patch.id),
      coreVersion,
      patchedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);

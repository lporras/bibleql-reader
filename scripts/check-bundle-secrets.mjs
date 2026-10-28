// Fails the build if an API key made it into the frontend bundle.
//
// No key is compiled in any more: BibleQL tokens are per-installation, kept
// in the OS credential store (docs/installation-keys.md), and Unsplash is
// reached through BibleQL, which holds that key server-side. This guards
// against one creeping back in. Runs after `vite build` (`yarn build`, and so
// `tauri build`'s beforeBuildCommand and the release workflow).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not `.pathname`: on Windows the latter is "/D:/…", which
// resolves to "D:\D:\…".
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

// Shapes a key would leave behind: BibleQL's token prefixes, and the
// Authorization scheme and host of a direct Unsplash API call.
const checks = [
  { label: "a BibleQL token", pattern: /bql_(live|test)_[A-Za-z0-9_-]{8,}/ },
  { label: "an Unsplash Client-ID header", pattern: /Client-ID / },
  { label: "a direct Unsplash API call", pattern: /api\.unsplash\.com/ }
];

// And the literal values, when the environment still holds the old keys.
for (const envVar of ["BIBLEQL_API_KEY", "UNSPLASH_ACCESS_KEY"]) {
  const value = process.env[envVar];
  if (!value || value.length < 8) continue;
  checks.push({ label: `the value of ${envVar}`, pattern: new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|mjs|css|html|json|map)$/.test(name)) yield path;
  }
}

const hits = [];
for (const path of files(DIST)) {
  const text = readFileSync(path, "utf8");
  // The label, never the match: a real key must not land in CI logs.
  for (const { label, pattern } of checks) {
    if (pattern.test(text)) hits.push(`${relative(DIST, path)}: ${label}`);
  }
}

if (hits.length) {
  console.error("check-bundle-secrets: the bundle contains what looks like an API key:");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log("check-bundle-secrets: no API keys in dist/");

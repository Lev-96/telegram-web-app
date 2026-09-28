// The panel's screens run here with THIS app's copies of their libraries, so
// every library both declare must be the exact version the panel's lockfile
// resolved — a different React or router here would run the panel's code on
// something it was never tested against. Fails the build on any drift.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const own = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync(path.join(root, "vendor", "panel", "package-lock.json"), "utf8")).packages;

const mine = { ...own.dependencies, ...own.devDependencies };
const drift = [];
for (const [name, version] of Object.entries(mine)) {
  const panel = lock[`node_modules/${name}`]?.version;
  if (panel && panel !== version) drift.push(`${name}: here ${version}, panel ${panel}`);
}

if (drift.length) {
  console.error("[check-deps] versions differ from the panel's lockfile:\n  " + drift.join("\n  "));
  process.exit(1);
}
console.log(`[check-deps] ${Object.keys(mine).length} dependencies match the panel's lockfile`);

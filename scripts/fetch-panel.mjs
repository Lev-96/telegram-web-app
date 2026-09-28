// Puts the desktop panel's source at vendor/panel, at the commit pinned in
// panel.ref — the ONE place this app's screens come from. Nothing in the panel
// repository is changed; this app only reads it.
//
//   PANEL_SRC=/path/to/cyber-place-panel-desktop   use a local checkout instead
//                                                  (development; a symlink)
//
// Idempotent: a vendor/panel already at the pinned commit is left alone.
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "vendor", "panel");
const stamp = path.join(target, ".panel-ref");
const repo = "https://github.com/Lev-96/cyber-place-panel-desktop.git";
const ref = readFileSync(path.join(root, "panel.ref"), "utf8").trim();

if (!/^[0-9a-f]{40}$/.test(ref)) {
  throw new Error(`panel.ref must hold a full 40-character commit SHA, got "${ref}"`);
}

const local = process.env.PANEL_SRC?.trim();
mkdirSync(path.dirname(target), { recursive: true });

if (local) {
  const source = path.resolve(local);
  if (!existsSync(path.join(source, "src", "App.tsx"))) {
    throw new Error(`PANEL_SRC=${source} does not look like the panel repository`);
  }
  if (existsSync(target) || isLink(target)) rmSync(target, { recursive: true, force: true });
  symlinkSync(source, target, "dir");
  console.log(`[fetch-panel] vendor/panel -> ${source} (local checkout, pin ${ref.slice(0, 7)} not enforced)`);
  process.exit(0);
}

if (!isLink(target) && existsSync(stamp) && readFileSync(stamp, "utf8").trim() === ref) {
  console.log(`[fetch-panel] vendor/panel already at ${ref.slice(0, 7)}`);
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
const git = (...args) => execFileSync("git", args, { cwd: target, stdio: "inherit" });
git("init", "--quiet");
git("remote", "add", "origin", repo);
git("fetch", "--quiet", "--depth", "1", "origin", ref);
git("checkout", "--quiet", "FETCH_HEAD");
rmSync(path.join(target, ".git"), { recursive: true, force: true });
writeFileSync(stamp, `${ref}\n`);
console.log(`[fetch-panel] vendor/panel fetched at ${ref.slice(0, 7)}`);

function isLink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

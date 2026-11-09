// Files only the owner web serves (2026-11-09): the PWA manifest, its icons and
// the service worker, kept in `static/` here. Vite's `publicDir` is the PANEL's
// public/ (fonts, logo, backgrounds, sounds), which this app must never write
// to: the desktop app would ship them. This plugin copies `static/` into the
// root of dist/ at build time, under the same names, and serves it in dev.
//
// A name that is also in the panel's public/ fails the build: one of the two
// would silently win.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
};

/** Every file under `dir`, as POSIX paths relative to it ("icons/icon-192.png"). */
export const staticFiles = (dir, base = "") =>
  readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) =>
      entry.isDirectory()
        ? staticFiles(path.join(dir, entry.name), `${base}${entry.name}/`)
        : [`${base}${entry.name}`],
    );

/** Top-level names `static/` shares with the panel's public/ (must be none). */
export const collisions = (staticDir, publicDir) => {
  const tops = new Set(staticFiles(staticDir).map((f) => f.split("/")[0]));
  return [...tops].filter((top) => existsSync(path.join(publicDir, top)));
};

/**
 * @param {{ staticDir: string; publicDir: string }} dirs
 * @returns {import("vite").Plugin}
 */
export const ownerWebStatic = ({ staticDir, publicDir }) => ({
  name: "owner-web-static",
  buildStart() {
    const clash = collisions(staticDir, publicDir);
    if (clash.length) this.error(`static/ and the panel's public/ both have: ${clash.join(", ")}`);
  },
  generateBundle() {
    for (const file of staticFiles(staticDir)) {
      this.emitFile({ type: "asset", fileName: file, source: readFileSync(path.join(staticDir, file)) });
    }
  },
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      let rel;
      try {
        rel = decodeURIComponent((req.url ?? "").split("?")[0]).replace(/^\/+/, "");
      } catch {
        return next();
      }
      const file = path.resolve(staticDir, rel);
      if (!rel || !file.startsWith(staticDir + path.sep) || !existsSync(file) || !statSync(file).isFile()) return next();
      res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.end(readFileSync(file));
    });
  },
});

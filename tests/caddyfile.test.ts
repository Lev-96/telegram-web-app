import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { collisions } from "../scripts/ownerWebStatic.mjs";

/**
 * The Caddyfile's allowlist and the files dist/ actually holds (2026-11-09).
 * /sounds/* was missing from the allowlist: every recording the owner chose in
 * Settings was a 404 and the panel played its default chime instead. A name in
 * dist/ the allowlist does not cover is that bug again.
 */
const root = path.resolve(__dirname, "..");
const caddyfile = readFileSync(path.join(root, "Caddyfile"), "utf8");
const panelPublic = path.join(root, "vendor/panel/public");
const staticDir = path.join(root, "static");

/** The paths of a named matcher: `@name path a b c`. */
const matcher = (name: string): string[] => {
  const line = caddyfile.split("\n").find((l) => l.trim().startsWith(`@${name} path `));
  if (!line) throw new Error(`@${name} not found`);
  return line.trim().split(/\s+/).slice(2);
};

/** Caddy's path matcher for a request path: exact, or a trailing-* prefix. */
const allowed = (requestPath: string) =>
  matcher("app").some((p) => (p.endsWith("*") ? requestPath.startsWith(p.slice(0, -1)) : requestPath === p));

/** What a browser may ask for: every top-level name in dist/ (public/ + static/), dirs as a file under them. */
const servedNames = () =>
  [panelPublic, staticDir].flatMap((dir) =>
    readdirSync(dir, { withFileTypes: true }).map((e) => (e.isDirectory() ? `/${e.name}/x` : `/${e.name}`)),
  );

describe("Caddyfile allowlist", () => {
  it("lets through the sounds, the service worker, the manifest and its icons", () => {
    for (const p of ["/sounds/note.mp3", "/sw.js", "/manifest.webmanifest", "/icons/icon-192.png"]) {
      expect(allowed(p), p).toBe(true);
    }
  });

  it("covers every top-level name dist/ will hold (the panel's public/ and static/)", () => {
    for (const p of servedNames()) expect(allowed(p), `${p} would be a 404`).toBe(true);
  });

  it("still refuses everything else", () => {
    for (const p of ["/.env", "/.git/config", "/src/main.tsx", "/api/x", "/index.php", "/sw.js.map", "/vendor/panel/CLAUDE.md"]) {
      expect(allowed(p), p).toBe(false);
    }
  });

  it("revalidates the service worker and the manifest on every load, like index.html", () => {
    expect(matcher("pwa")).toEqual(["/sw.js", "/manifest.webmanifest"]);
    expect(caddyfile).toMatch(/header @pwa Cache-Control "no-cache"/);
    expect(caddyfile).toMatch(/header @manifest Content-Type "application\/manifest\+json"/);
  });

  it("CSP admits a same-origin manifest and worker, and nothing new", () => {
    const csp = caddyfile.match(/Content-Security-Policy "([^"]+)"/)![1];
    expect(csp).toContain("manifest-src 'self'");
    expect(csp).toMatch(/worker-src 'self'( blob:)?;/);
    expect(csp).toContain("default-src 'none'");
  });
});

describe("owner-web static files", () => {
  const manifest = JSON.parse(readFileSync(path.join(staticDir, "manifest.webmanifest"), "utf8"));

  it("never share a name with the panel's public/ (the desktop app must not ship them)", () => {
    expect(collisions(staticDir, panelPublic)).toEqual([]);
  });

  it("the manifest makes an installable standalone app at the root", () => {
    expect(manifest).toMatchObject({
      name: "Cyber Place Owner",
      short_name: "Cyber Place",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: "#020514",
      background_color: "#020514",
    });
  });

  it("every icon it names exists, is a PNG of the stated size, with any + maskable at 192 and 512", () => {
    const seen: string[] = [];
    for (const icon of manifest.icons as Array<{ src: string; sizes: string; type: string; purpose: string }>) {
      const png = readFileSync(path.join(staticDir, icon.src));
      expect(png.subarray(1, 4).toString("ascii"), icon.src).toBe("PNG");
      const size = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
      expect(size, icon.src).toBe(icon.sizes);
      expect(icon.type).toBe("image/png");
      seen.push(`${icon.sizes}:${icon.purpose}`);
    }
    expect(seen.sort()).toEqual(["192x192:any", "192x192:maskable", "512x512:any", "512x512:maskable"]);
  });

  it("index.html links the manifest, the theme colour and the home-screen icon", () => {
    const html = readFileSync(path.join(root, "index.html"), "utf8");
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<meta name="theme-color" content="#020514" />');
    expect(html).toMatch(/<link rel="apple-touch-icon" [^>]*href="[^"]+"/);
  });
});

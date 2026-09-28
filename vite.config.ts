import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";
import { overrides } from "./overrides.config.mjs";

const here = __dirname;
const panel = path.resolve(here, "vendor/panel");
const pkg = JSON.parse(readFileSync(path.resolve(here, "package.json"), "utf8")) as { version: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default defineConfig({
  plugins: [react()],
  define: {
    // The panel's code reports a version; here it is this app's.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Fonts, logo and backgrounds are the panel's.
  publicDir: path.resolve(panel, "public"),
  resolve: {
    // Exact overrides first (an anchored regex matches only that module id),
    // then the panel's `@/` and this app's own `@web/`.
    alias: [
      ...Object.entries(overrides).map(([id, file]) => ({
        find: new RegExp(`^${escape(id)}$`),
        replacement: path.resolve(here, file),
      })),
      { find: /^@web\//, replacement: `${path.resolve(here, "src")}/` },
      { find: /^@\//, replacement: `${path.resolve(panel, "src")}/` },
    ],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
  },
  server: { port: 5180, strictPort: true },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});

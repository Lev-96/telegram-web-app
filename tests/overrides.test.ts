import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { overrides } from "../overrides.config.mjs";

const root = path.resolve(__dirname, "..");

describe("panel module overrides", () => {
  it("tsconfig maps exactly the modules vite replaces, to the same files", () => {
    const tsconfig = JSON.parse(readFileSync(path.join(root, "tsconfig.json"), "utf8"));
    const paths: Record<string, string[]> = tsconfig.compilerOptions.paths;
    const exact = Object.fromEntries(
      Object.entries(paths)
        .filter(([id]) => !id.includes("*"))
        .map(([id, [file]]) => [id, file]),
    );
    expect(exact).toEqual(overrides);
  });

  it("every override replaces a module that exists in the panel", () => {
    for (const id of Object.keys(overrides)) {
      const base = path.join(root, "vendor/panel/src", id.slice(2));
      const found = [".ts", ".tsx"].some((ext) => {
        try {
          readFileSync(base + ext);
          return true;
        } catch {
          return false;
        }
      });
      expect(found, `${id} not found in the panel`).toBe(true);
    }
  });
});

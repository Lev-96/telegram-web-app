// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { overrides } from "../overrides.config.mjs";

/**
 * The web's sign-in and reset screens are still (owner, 2026-11-13), like the
 * desktop's: no three.js scene, no HUD ring, no 3D turn of the card. The
 * background is the panel's `.login-shell` CSS (a pre-rendered picture over a
 * gradient), so nothing here mounts or runs for it.
 */

const auth = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: "ru", setLang: vi.fn(), t: (k: string) => t(k, "ru") }) };
});

import Login from "@/routes/Login";

const root = path.resolve(__dirname, "..");

afterEach(() => {
  cleanup();
  document.documentElement.dataset.shell = "";
});

/** A module id as a file, through this app's aliases; null for a package. */
const resolve = (from: string, id: string): string | null => {
  const exact = (overrides as Record<string, string>)[id];
  const base = exact ? path.join(root, exact)
    : id.startsWith("@web/") ? path.join(root, "src", id.slice(5))
    : id.startsWith("@/") ? path.join(root, "vendor/panel/src", id.slice(2))
    : id.startsWith(".") ? path.resolve(path.dirname(from), id)
    : null;
  if (base === null) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(candidate) && /\.(tsx?|css|mjs)$/.test(candidate)) return candidate;
  }
  throw new Error(`${path.relative(root, from)} imports ${id}, which does not resolve`);
};

const importsOf = (file: string): string[] => {
  const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const ids = new Set<string>();
  for (const m of code.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/gm)) {
    ids.add(m[1] ?? m[2] ?? m[3]);
  }
  return [...ids];
};

/** Packages reachable from a file, each with the import path that reaches it. */
const packagesFrom = (entry: string): Map<string, string> => {
  const found = new Map<string, string>();
  const seen = new Set<string>();
  const walk = (file: string, trail: string) => {
    if (seen.has(file) || file.endsWith(".css")) return;
    seen.add(file);
    for (const id of importsOf(file)) {
      const local = resolve(file, id);
      if (local) walk(local, `${trail} -> ${path.relative(root, local)}`);
      else if (!found.has(id)) found.set(id, trail);
    }
  };
  walk(entry, path.relative(root, entry));
  return found;
};

describe("the web sign-in screens load no 3D", () => {
  it.each(["src/overrides/Login.tsx", "src/overrides/ResetPassword.tsx"])("%s cannot reach three.js, not even lazily", (entry) => {
    const packages = packagesFrom(path.join(root, entry));
    const threeD = [...packages].filter(([id]) => id === "three" || id.startsWith("three/") || id.startsWith("@react-three/"));
    expect(threeD.map(([id, via]) => `${id} via ${via}`)).toEqual([]);
    expect(packages.has("react")).toBe(true);
  });

  it("draws no canvas, scene or HUD ring", () => {
    const { container } = render(<MemoryRouter initialEntries={["/login"]}><Login /></MemoryRouter>);
    expect(container.querySelector("canvas, .login-scene, .login-hud")).toBeNull();
    expect(container.querySelector(".login-shell.web-login h1.login-brand")).not.toBeNull();
  });
});

describe("the forgot face swaps in at once", () => {
  it("moves focus onto the face now showing, and back", async () => {
    const { container } = render(<MemoryRouter initialEntries={["/login"]}><Login /></MemoryRouter>);
    const front = container.querySelector("form.web-login__card") as HTMLFormElement;
    const back = container.querySelector(".login-flip-face-back") as HTMLElement;

    await act(async () => { fireEvent.click(screen.getByText("Забыли пароль?")); });
    expect(container.querySelector(".login-flip.is-back")).not.toBeNull();
    expect(front.hasAttribute("inert")).toBe(true);
    expect(back.hasAttribute("inert")).toBe(false);
    expect(back.contains(document.activeElement)).toBe(true);
    expect((document.activeElement as HTMLInputElement).type).toBe("email");

    await act(async () => { fireEvent.click(screen.getByText("Вернуться к входу")); });
    expect(container.querySelector(".login-flip.is-back")).toBeNull();
    expect(back.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(front.querySelector('input[type="email"]'));
  });
});

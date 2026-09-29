// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isTouchDevice, lockPageZoom } from "@web/web/pageZoom";

const root = path.resolve(__dirname, "..");
const gesture = (type: string) => {
  const event = new Event(type, { cancelable: true });
  document.dispatchEvent(event);
  return event.defaultPrevented;
};

describe("page zoom lock", () => {
  it("cancels iOS Safari's zoom gestures while installed, and only then", () => {
    expect(gesture("gesturestart")).toBe(false);

    const unlock = lockPageZoom();
    expect(gesture("gesturestart")).toBe(true);
    expect(gesture("gesturechange")).toBe(true);
    expect(gesture("gestureend")).toBe(true);

    unlock();
    expect(gesture("gesturestart")).toBe(false);
  });

  it("leaves every other event alone", () => {
    const unlock = lockPageZoom();
    try {
      for (const type of ["touchstart", "touchmove", "click", "wheel", "dblclick"]) {
        expect(gesture(type), type).toBe(false);
      }
    } finally {
      unlock();
    }
  });

  it("is meant for a finger, not a mouse or a trackpad", () => {
    const withPointer = (coarse: boolean) =>
      ({ matchMedia: (q: string) => ({ matches: coarse && q === "(pointer: coarse)" }) }) as unknown as Window;
    expect(isTouchDevice(withPointer(true))).toBe(true);
    expect(isTouchDevice(withPointer(false))).toBe(false);
    expect(isTouchDevice({} as Window)).toBe(false);
  });

  it("is backed by the viewport and by touch-action for the other browsers", () => {
    const html = readFileSync(path.join(root, "index.html"), "utf8");
    const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? "";
    expect(viewport).toContain("maximum-scale=1.0");
    expect(viewport).toContain("user-scalable=no");
    expect(viewport).toContain("viewport-fit=cover");

    const css = readFileSync(path.join(root, "src/styles/web.css"), "utf8");
    expect(css).toMatch(/:root\[data-shell\]\s*\{\s*touch-action:\s*pan-x pan-y;/);
  });
});

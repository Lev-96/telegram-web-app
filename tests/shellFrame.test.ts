import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Below 900px the shell is a fixed frame and only .main scrolls (2026-09-29).
 * Sized by 100dvh alone, a browser without dvh let the document scroll, the
 * top bar slid over .main and hid the sticky Back button. Measured in a
 * browser (see CLAUDE.md); this keeps the rules from being dropped.
 */
const css = readFileSync(path.resolve(__dirname, "../src/styles/web.css"), "utf8");
const narrow = css.slice(css.indexOf("@media (max-width: 899px)"));

describe("narrow shell frame", () => {
  it("is fixed over the whole screen, so the document never scrolls", () => {
    expect(narrow).toMatch(/\.web-shell \{\s*position: fixed;\s*inset: 0;\s*height: auto;\s*\}/);
  });

  it("puts the gap in the first child's margin and the Back button's offset in its own top", () => {
    expect(narrow).toMatch(/\.web-shell \.main \{[^}]*padding: 0 /);
    expect(narrow).toMatch(/\.web-shell \.main > \.cp-back-btn \{\s*top: 8px;\s*\}/);
    expect(narrow).toMatch(/\.web-shell \.main > :first-child \{\s*margin-top: 16px;\s*\}/);
  });
});

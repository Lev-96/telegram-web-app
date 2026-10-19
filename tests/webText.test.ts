import { describe, expect, it } from "vitest";
import { WEB_TEXT, webText } from "@web/web/i18n";

const entries = Object.entries(WEB_TEXT) as Array<[string, Record<"en" | "ru" | "am", string>]>;
const placeholders = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join(",");

describe("web text", () => {
  it("has all three languages, none empty", () => {
    for (const [key, dict] of entries) {
      for (const lang of ["en", "ru", "am"] as const) expect(dict[lang].trim(), `${key}.${lang}`).not.toBe("");
    }
  });

  it("carries the same placeholders in every language", () => {
    for (const [key, dict] of entries) {
      expect(placeholders(dict.ru), key).toBe(placeholders(dict.en));
      expect(placeholders(dict.am), key).toBe(placeholders(dict.en));
    }
  });

  it("never renders an em dash, and Armenian carries no Cyrillic", () => {
    for (const [key, dict] of entries) {
      for (const lang of ["en", "ru", "am"] as const) expect(dict[lang].includes("—"), `${key}.${lang}`).toBe(false);
      expect(/[Ѐ-ӿ]/.test(dict.am), `${key}.am`).toBe(false);
    }
  });

  it("does not call the web panel «Վահանակ»", () => {
    for (const [key, dict] of entries) expect(dict.am.includes("վահանակ") || dict.am.includes("Վահանակ"), key).toBe(false);
  });

  it("returns a text as is when it has no placeholder", () => {
    expect(webText("web.telegram.title", "ru", 10)).toBe("Telegram");
  });
});

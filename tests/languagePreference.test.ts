// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The account's language kept on the server (2026-09-30): asked once per
 * account, found again on any device or after Telegram wiped its storage.
 */

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; body: unknown }>,
  locale: null as string | null,
  fail: false,
}));
vi.mock("@/api/client", () => ({
  request: async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    api.calls.push({ path, method: opts.method ?? "GET", body: opts.body });
    if (api.fail) throw new Error("offline");
    return { locale: api.locale };
  },
}));

import {
  forgetServerCopies,
  langFromTag,
  readAccountLang,
  readStoredLang,
  rememberLang,
  setActiveAccount,
} from "@/i18n/languagePreference";

beforeEach(() => {
  document.documentElement.dataset.shell = "web";
  window.localStorage.clear();
  api.calls = [];
  api.locale = null;
  api.fail = false;
  forgetServerCopies();
  setActiveAccount(null);
  delete window.Telegram;
});
afterEach(() => vi.restoreAllMocks());

describe("the account's language", () => {
  it("uses the device's copy without asking the server", async () => {
    window.localStorage.setItem("u7:cp.lang", '"ru"');
    expect(await readAccountLang(7)).toBe("ru");
    expect(api.calls).toEqual([]);
  });

  it("finds it on the server when the device has none, and keeps it on the device", async () => {
    api.locale = "am";
    expect(await readAccountLang(7)).toBe("am");
    expect(api.calls).toEqual([{ path: "/user/locale", method: "GET", body: undefined }]);
    expect(window.localStorage.getItem("u7:cp.lang")).toBe('"am"');
  });

  it("is simply unknown when the server has none or cannot be reached", async () => {
    expect(await readAccountLang(7)).toBeNull();
    forgetServerCopies();
    api.fail = true;
    expect(await readAccountLang(8)).toBeNull();
  });

  it("a choice made while signed in is written to the server once", async () => {
    setActiveAccount(7);
    await rememberLang("ru");
    await rememberLang("ru");
    expect(api.calls).toEqual([{ path: "/user/locale", method: "PUT", body: { locale: "ru" } }]);
    expect(window.localStorage.getItem("u7:cp.lang")).toBe('"ru"');

    await rememberLang("en");
    expect(api.calls.at(-1)).toEqual({ path: "/user/locale", method: "PUT", body: { locale: "en" } });
  });

  it("a language the server already has is not written back", async () => {
    api.locale = "am";
    await readAccountLang(7);
    setActiveAccount(7);
    await rememberLang("am");
    expect(api.calls.map((c) => c.method)).toEqual(["GET"]);
  });

  it("nothing is written to the server before anyone is signed in", async () => {
    await rememberLang("ru");
    expect(api.calls).toEqual([]);
    expect(window.localStorage.getItem("cp.lang")).toBe('"ru"');
  });
});

describe("the language before any choice", () => {
  it("maps language tags to the shipped languages (Armenian is am here)", () => {
    expect(langFromTag("hy")).toBe("am");
    expect(langFromTag("ru-RU")).toBe("ru");
    expect(langFromTag("en_GB")).toBe("en");
    expect(langFromTag("de")).toBeNull();
    expect(langFromTag(undefined)).toBeNull();
  });

  it("prefers a stored choice, then Telegram's language, then the browser's", async () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["de-DE", "ru-RU"]);
    expect(await readStoredLang()).toBe("ru");

    (window as unknown as { Telegram: unknown }).Telegram = { WebApp: { initDataUnsafe: { user: { language_code: "hy" } } } };
    expect(await readStoredLang()).toBe("am");

    window.localStorage.setItem("cp.lang", '"en"');
    expect(await readStoredLang()).toBe("en");
  });
});

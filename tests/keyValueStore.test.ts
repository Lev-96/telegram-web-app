// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { AppConfig } from "@/infrastructure/AppConfig";
import { keyValueStore } from "@/infrastructure/KeyValueStore";

describe("browser key-value store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("keeps the session (token, user) in sessionStorage only", async () => {
    await keyValueStore.set(AppConfig.storageKeys.token, "1|secret");
    await keyValueStore.set(AppConfig.storageKeys.user, { id: 1 });

    expect(window.sessionStorage.getItem(AppConfig.storageKeys.token)).toBe('"1|secret"');
    expect(window.localStorage.getItem(AppConfig.storageKeys.token)).toBeNull();
    expect(window.localStorage.getItem(AppConfig.storageKeys.user)).toBeNull();
    expect(await keyValueStore.get(AppConfig.storageKeys.token)).toBe("1|secret");
  });

  it("keeps preferences in localStorage, as the panel's browser store does", async () => {
    await keyValueStore.set("cp.lang", "am");
    expect(window.localStorage.getItem("cp.lang")).toBe('"am"');
    expect(window.sessionStorage.getItem("cp.lang")).toBeNull();
  });

  it("removes what it stored", async () => {
    await keyValueStore.set(AppConfig.storageKeys.token, "t");
    await keyValueStore.remove(AppConfig.storageKeys.token);
    expect(await keyValueStore.get(AppConfig.storageKeys.token)).toBeNull();
  });
});

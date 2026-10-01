// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiForgotPassword, apiLogin, apiLogout } from "@/api/auth";

const calls: Array<{ url: string; method: string; body: unknown }> = [];

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : null });
    const payload = String(url).endsWith("/owner-web/session/login")
      ? { login: { id: 7, name: "Owner", email: "o@example.test", role: "company_owner" }, token: "7|web" }
      : { messages: "ok" };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("web auth api", () => {
  it("signs in through the owner-web endpoint, never the desktop's", async () => {
    const res = await apiLogin("o@example.test", "pw");
    expect(calls[0].url).toMatch(/\/owner-web\/session\/login$/);
    expect(calls[0].body).toEqual({ email: "o@example.test", password: "pw" });
    expect(res).toEqual({ token: "7|web", user: { id: 7, name: "Owner", email: "o@example.test", role: "company_owner" } });
  });

  it("carries a solved captcha once, then never again (2026-10-01)", async () => {
    const { loginChallenge } = await import("@web/web/loginChallenge");
    loginChallenge.set("solved-token");
    await apiLogin("o@example.test", "pw");
    await apiLogin("o@example.test", "pw");
    expect(calls[0].body).toEqual({ email: "o@example.test", password: "pw", captcha_token: "solved-token" });
    expect(calls[1].body).toEqual({ email: "o@example.test", password: "pw" });
  });

  it("signs out only this session: /owner-web/session/logout, not /session/logout", async () => {
    await apiLogout();
    expect(calls[0].url).toMatch(/\/owner-web\/session\/logout$/);
    expect(calls.some((c) => /\/session\/logout$/.test(c.url) && !c.url.includes("owner-web"))).toBe(false);
  });

  it("keeps every other auth call the panel's own", async () => {
    await apiForgotPassword("o@example.test");
    expect(calls[0].url).toMatch(/\/forgot-password$/);
  });
});

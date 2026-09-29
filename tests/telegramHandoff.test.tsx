// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one-tap "Telegram" link (2026-09-29): prepared while seen, renewed
 * before the server's two-minute expiry, and a tap that comes too early still
 * lands in Telegram through a tab it opened itself.
 */

const api = vi.hoisted(() => ({ calls: 0, next: [] as Array<unknown> }));
vi.mock("@/api/client", () => ({
  request: async () => {
    api.calls++;
    const next = api.next.shift();
    const reply = typeof next === "function" ? next() : next;
    if (reply instanceof Error) throw reply;
    return reply;
  },
}));

import { isFresh, RENEW_BEFORE_MS, useTelegramHandoff } from "@web/web/telegramHandoff";

const reply = (n: number, ttlMs = 120_000) => ({ url: `https://t.me/bot/app?startapp=link_${n}`, expires_at: new Date(Date.now() + ttlMs).toISOString() });

beforeEach(() => {
  api.calls = 0;
  api.next = [];
});
afterEach(() => vi.useRealTimers());

describe("freshness", () => {
  it("is fresh only while more than the renew margin is left", () => {
    const now = Date.parse("2026-09-30T10:00:00Z");
    const at = (ms: number) => ({ url: "u", expires_at: new Date(now + ms).toISOString() });
    expect(isFresh(null, now)).toBe(false);
    expect(isFresh(at(RENEW_BEFORE_MS + 1_000), now)).toBe(true);
    expect(isFresh(at(RENEW_BEFORE_MS - 1_000), now)).toBe(false);
  });
});

describe("useTelegramHandoff", () => {
  it("asks for nothing while the entry is not seen", () => {
    renderHook(() => useTelegramHandoff(false));
    expect(api.calls).toBe(0);
  });

  it("prepares a link once seen and renews it before it expires", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Built when asked for, as the server would: its expiry counts from then.
    api.next = [() => reply(1), () => reply(2)];
    const { result } = renderHook(() => useTelegramHandoff(true));

    await waitFor(() => expect(result.current.url).toContain("link_1"));
    expect(api.calls).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(120_000 - RENEW_BEFORE_MS + 50);
    });
    await waitFor(() => expect(result.current.url).toContain("link_2"));
    expect(api.calls).toBe(2);
  });

  it("an early tap opens a tab at once and sends it to the link when it arrives", async () => {
    api.next = [new Error("slow"), reply(3)];
    const tab = { opener: {} as unknown, location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const { result } = renderHook(() => useTelegramHandoff(true));

    await act(async () => {
      await result.current.open();
    });

    expect(open).toHaveBeenCalledWith("", "_blank");
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toContain("link_3");
    open.mockRestore();
  });

  it("closes the tab it opened when the link cannot be had", async () => {
    api.next = [new Error("down"), new Error("down")];
    const tab = { opener: null, location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const { result } = renderHook(() => useTelegramHandoff(true));

    await act(async () => {
      await expect(result.current.open()).rejects.toThrow("down");
    });

    expect(tab.close).toHaveBeenCalled();
    open.mockRestore();
  });
});

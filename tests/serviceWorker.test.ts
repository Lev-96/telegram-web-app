import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

/**
 * static/sw.js (2026-11-09), the file itself: run in a sandbox with a fake
 * `self`, its listeners collected and fed fake events. Shows a push, opens /
 * focuses the app on a tap, passes navigations to the network, caches nothing.
 */
const source = readFileSync(path.resolve(__dirname, "../static/sw.js"), "utf8");
const ORIGIN = "https://owner.example.test";

interface FakeClient {
  url: string;
  focus: ReturnType<typeof vi.fn>;
  navigate?: ReturnType<typeof vi.fn>;
}

const load = (clients: FakeClient[] = []) => {
  const listeners: Record<string, (event: unknown) => void> = {};
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    registration: { showNotification: vi.fn(async () => undefined) },
    clients: {
      matchAll: vi.fn(async () => clients),
      openWindow: vi.fn(async () => null),
      claim: vi.fn(async () => undefined),
    },
    skipWaiting: vi.fn(),
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners[type] = fn;
    },
  };
  const fetch = vi.fn(async () => "network response");
  vm.runInNewContext(source, { self, URL, fetch });
  return { self, fetch, listeners };
};

/** Runs a listener and waits for what it handed to waitUntil / respondWith. */
const dispatch = async <E extends object>(listener: (event: unknown) => void, event: E) => {
  const waits: Array<Promise<unknown>> = [];
  const full = { waitUntil: (p: Promise<unknown>) => waits.push(p), ...event };
  listener(full);
  await Promise.all(waits);
  return full;
};

const pushData = (payload: unknown) => ({
  json: () => (typeof payload === "string" ? JSON.parse(payload) : payload),
  text: () => (typeof payload === "string" ? payload : JSON.stringify(payload)),
});

describe("service worker: push", () => {
  it("shows the payload's title, body, icon and tag, and keeps the url for the tap", async () => {
    const { self, listeners } = load();
    await dispatch(listeners.push, {
      data: pushData({ title: "Payment due", body: "Pay by 10.11", url: "/#/notifications", tag: "billing-31", icon: "/icons/icon-192.png" }),
    });
    expect(self.registration.showNotification).toHaveBeenCalledWith("Payment due", {
      body: "Pay by 10.11",
      icon: "/icons/icon-192.png",
      tag: "billing-31",
      renotify: true,
      data: { url: `${ORIGIN}/#/notifications` },
    });
  });

  it("still shows something for an empty or broken payload, without a tag", async () => {
    const { self, listeners } = load();
    await dispatch(listeners.push, { data: null });
    await dispatch(listeners.push, { data: { json: () => { throw new SyntaxError("x"); }, text: () => "plain words" } });
    expect(self.registration.showNotification).toHaveBeenNthCalledWith(1, "Cyber Place", {
      body: "",
      icon: "/icons/icon-192.png",
      data: { url: `${ORIGIN}/` },
    });
    expect(self.registration.showNotification).toHaveBeenNthCalledWith(2, "Cyber Place", {
      body: "plain words",
      icon: "/icons/icon-192.png",
      data: { url: `${ORIGIN}/` },
    });
  });

  it("never sends a tap to another site", async () => {
    const { self, listeners } = load();
    await dispatch(listeners.push, { data: pushData({ title: "x", url: "https://evil.example/phish" }) });
    await dispatch(listeners.push, { data: pushData({ title: "x", url: "//evil.example/x" }) });
    const urls = self.registration.showNotification.mock.calls.map((c) => (c as unknown as [string, { data: { url: string } }])[1].data.url);
    expect(urls).toEqual([`${ORIGIN}/`, `${ORIGIN}/`]);
  });
});

describe("service worker: notificationclick", () => {
  const click = (url: string) => ({ notification: { close: vi.fn(), data: { url } } });

  it("brings the open app to the front and moves it to the notice's screen", async () => {
    const client: FakeClient = { url: `${ORIGIN}/#/`, focus: vi.fn(), navigate: vi.fn(async () => null) };
    client.focus.mockResolvedValue(client);
    const { self, listeners } = load([client]);
    const event = await dispatch(listeners.notificationclick, click(`${ORIGIN}/#/notifications`));
    expect(event.notification.close).toHaveBeenCalled();
    expect(client.focus).toHaveBeenCalled();
    expect(client.navigate).toHaveBeenCalledWith(`${ORIGIN}/#/notifications`);
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("opens the app on that screen when it is not open", async () => {
    const other: FakeClient = { url: "https://elsewhere.example/", focus: vi.fn() };
    const { self, listeners } = load([other]);
    await dispatch(listeners.notificationclick, click(`${ORIGIN}/#/notifications`));
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/#/notifications`);
    expect(other.focus).not.toHaveBeenCalled();
  });

  it("a window it cannot steer is still brought to the front", async () => {
    const client: FakeClient = { url: `${ORIGIN}/#/`, focus: vi.fn(), navigate: vi.fn(async () => { throw new TypeError("not controlled"); }) };
    client.focus.mockResolvedValue(client);
    const { listeners } = load([client]);
    await expect(dispatch(listeners.notificationclick, click("/#/sessions"))).resolves.toBeDefined();
    expect(client.focus).toHaveBeenCalled();
  });
});

describe("service worker: fetch, install, activate", () => {
  it("passes a page navigation to the network and leaves everything else alone", async () => {
    const { fetch, listeners } = load();
    const respondWith = vi.fn();
    const nav = { mode: "navigate", url: `${ORIGIN}/` };
    listeners.fetch({ request: nav, respondWith });
    expect(fetch).toHaveBeenCalledWith(nav);
    expect(respondWith).toHaveBeenCalledTimes(1);
    await expect(respondWith.mock.calls[0][0]).resolves.toBe("network response");

    const other = vi.fn();
    listeners.fetch({ request: { mode: "cors", url: `${ORIGIN}/assets/x.js` }, respondWith: other });
    expect(other).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("takes over at once and uses no cache", async () => {
    const { self, listeners } = load();
    listeners.install({});
    await dispatch(listeners.activate, {});
    expect(self.skipWaiting).toHaveBeenCalled();
    expect(self.clients.claim).toHaveBeenCalled();
    expect(source).not.toMatch(/caches\.|CacheStorage|cache\.put/);
  });
});

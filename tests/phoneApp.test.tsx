// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The installable app's card in the menu (2026-11-09): Chrome's install offer,
 * iOS's steps, nothing inside Telegram but a note, and — in the installed app —
 * the phone-notifications switch against the backend's web-push endpoints
 * (mocked here: GET /web-push/public-key, POST / DELETE /web-push/subscriptions).
 */

const log = vi.hoisted(() => [] as string[]);
const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; body: unknown }>,
  publicKey: null as unknown,
  failPost: false,
}));
const toasts = vi.hoisted(() => [] as string[]);

vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 7, role: "company_owner" } }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ lang: "ru", setLang: vi.fn(), t: (k: string) => k }) }));
vi.mock("@/ui/notify", () => ({ notify: { message: (_kind: string, text: string) => toasts.push(text) } }));
vi.mock("@/api/client", () => ({
  request: async (path: string, opts: { method?: string; body?: unknown } = {}) => {
    const method = opts.method ?? "GET";
    api.calls.push({ path, method, body: opts.body ?? null });
    log.push(`${method} ${path}`);
    if (path === "/web-push/public-key") {
      if (api.publicKey === 404 || api.publicKey === 500) throw Object.assign(new Error("HTTP"), { status: api.publicKey });
      return { public_key: api.publicKey };
    }
    if (method === "POST" && api.failPost) throw Object.assign(new Error("Server Error"), { status: 500 });
    return { ok: true };
  },
}));

import PhoneAppMenuEntry from "@web/web/PhoneAppMenuEntry";
import { startInstallCapture } from "@web/web/pwa/installPrompt";

// A 65-byte P-256 key, as the server would send it (base64url).
const KEY_BYTES = Uint8Array.from({ length: 65 }, (_, i) => (i * 7 + 4) % 256);
const KEY = Buffer.from(KEY_BYTES).toString("base64url");
const OTHER_KEY_BYTES = Uint8Array.from({ length: 65 }, () => 9);
const ENDPOINT = "https://push.example/send/abc";

class FakeSubscription {
  readonly endpoint = ENDPOINT;
  readonly options: { applicationServerKey: ArrayBuffer };
  constructor(key: Uint8Array) {
    this.options = { applicationServerKey: Uint8Array.from(key).buffer };
  }
  toJSON() {
    return { endpoint: this.endpoint, expirationTime: null, keys: { p256dh: "BPub", auth: "Auth" } };
  }
  unsubscribe = vi.fn(async () => {
    log.push("unsubscribe");
    push.sub = null;
    return true;
  });
}

const push = {
  sub: null as FakeSubscription | null,
  registered: false,
  permission: "default" as NotificationPermission,
  answer: "granted" as NotificationPermission,
};

const pushManager = {
  getSubscription: vi.fn(async () => push.sub),
  subscribe: vi.fn(async (opts: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => {
    log.push("subscribe");
    push.sub = new FakeSubscription(opts.applicationServerKey);
    return push.sub;
  }),
};
const registration = { pushManager };

const installBrowser = ({ standalone = false, ios = false, pushApi = true } = {}) => {
  window.matchMedia = ((q: string) => ({ matches: standalone && q === "(display-mode: standalone)" })) as unknown as typeof window.matchMedia;
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: ios
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  });
  if (!pushApi) return;
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn(async (url: string, opts: unknown) => {
        log.push(`register ${url} ${JSON.stringify(opts)}`);
        push.registered = true;
        return registration;
      }),
      get ready() {
        return Promise.resolve(registration);
      },
      getRegistration: vi.fn(async () => (push.registered ? registration : undefined)),
    },
  });
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal("Notification", {
    get permission() {
      return push.permission;
    },
    requestPermission: vi.fn(async () => {
      log.push("permission");
      push.permission = push.answer;
      return push.answer;
    }),
  });
};

let stopCapture: () => void = () => {};

beforeEach(() => {
  log.length = 0;
  toasts.length = 0;
  api.calls = [];
  api.publicKey = KEY;
  api.failPost = false;
  Object.assign(push, { sub: null, registered: false, permission: "default", answer: "granted" });
  pushManager.subscribe.mockClear();
  document.documentElement.dataset.shell = "web";
  stopCapture = startInstallCapture(window);
});

afterEach(() => {
  cleanup();
  stopCapture();
  vi.unstubAllGlobals();
  delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  delete (navigator as unknown as Record<string, unknown>).userAgent;
  document.documentElement.dataset.shell = "";
});

const offerInstall = () => {
  const prompt = vi.fn(async () => undefined);
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
};

describe("install the app", () => {
  it("Chrome: the held install offer becomes «Установить приложение», which shows Chrome's dialog", async () => {
    installBrowser();
    render(<PhoneAppMenuEntry />);
    expect(screen.queryByText("Установить приложение")).toBeNull();

    const { event, prompt } = offerInstall();
    expect(event.defaultPrevented).toBe(true); // Chrome's own infobar held back
    fireEvent.click(screen.getByText("Установить приложение"));
    expect(prompt).toHaveBeenCalledTimes(1);
    // An offer is shown once: the button goes with it.
    await waitFor(() => expect(screen.queryByText("Установить приложение")).toBeNull());
  });

  it("an install from the browser's own menu removes the button", () => {
    installBrowser();
    render(<PhoneAppMenuEntry />);
    offerInstall();
    expect(screen.getByText("Установить приложение")).toBeTruthy();
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.queryByText("Установить приложение")).toBeNull();
  });

  it("iOS: no dialog exists, so the card unfolds the Share → Home Screen steps", () => {
    installBrowser({ ios: true });
    render(<PhoneAppMenuEntry />);
    const card = screen.getByRole("button", { name: /Установить приложение/ });
    expect(card.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(card);
    expect(card.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/На экран „Домой“/).textContent).toContain("iOS 16.4");
  });

  it("Telegram Mini App: no install, no switch; notices come from the bot", async () => {
    installBrowser({ standalone: true });
    document.documentElement.dataset.shell = "telegram";
    render(<PhoneAppMenuEntry />);
    offerInstall();
    expect(screen.queryByText("Установить приложение")).toBeNull();
    expect(screen.getByText("В Telegram они приходят от бота")).toBeTruthy();
    await act(async () => {});
    expect(api.calls).toEqual([]);
  });

  it("a desktop browser without an offer shows nothing and asks the server nothing", async () => {
    installBrowser();
    const { container } = render(<PhoneAppMenuEntry />);
    await act(async () => {});
    expect(container.innerHTML).toBe("");
    expect(api.calls).toEqual([]);
  });
});

describe("phone notifications (installed app)", () => {
  it("permission → worker → subscription → the server, in that order, with the exact body", async () => {
    installBrowser({ standalone: true });
    render(<PhoneAppMenuEntry />);
    fireEvent.click(await screen.findByRole("button", { name: /Включить уведомления на телефоне/ }));
    await screen.findByText("Включены на этом телефоне");

    expect(log).toEqual([
      "GET /web-push/public-key",
      "permission",
      'register /sw.js {"scope":"/"}',
      "subscribe",
      "POST /web-push/subscriptions",
    ]);
    const opts = pushManager.subscribe.mock.calls[0][0];
    expect(opts.userVisibleOnly).toBe(true);
    expect(Array.from(opts.applicationServerKey)).toEqual(Array.from(KEY_BYTES));
    expect(api.calls.at(-1)).toEqual({
      path: "/web-push/subscriptions",
      method: "POST",
      body: { endpoint: ENDPOINT, keys: { p256dh: "BPub", auth: "Auth" }, content_encoding: "aes128gcm" },
    });
  });

  it("«Выключить»: DELETE with the endpoint, then the browser drops the subscription", async () => {
    installBrowser({ standalone: true });
    push.permission = "granted";
    push.registered = true;
    push.sub = new FakeSubscription(KEY_BYTES);
    render(<PhoneAppMenuEntry />);
    fireEvent.click(await screen.findByRole("button", { name: "Выключить" }));
    await screen.findByRole("button", { name: /Включить уведомления на телефоне/ });

    const del = api.calls.filter((c) => c.method === "DELETE");
    expect(del).toEqual([{ path: "/web-push/subscriptions", method: "DELETE", body: { endpoint: ENDPOINT } }]);
    expect(log.slice(-2)).toEqual(["DELETE /web-push/subscriptions", "unsubscribe"]);
    expect(push.sub).toBeNull();
  });

  it("already allowed: re-sends the subscription quietly on load and shows it on", async () => {
    installBrowser({ standalone: true });
    push.permission = "granted";
    push.registered = true;
    push.sub = new FakeSubscription(KEY_BYTES);
    render(<PhoneAppMenuEntry />);
    await screen.findByText("Включены на этом телефоне");
    expect(log).toEqual(["GET /web-push/public-key", "POST /web-push/subscriptions"]);
    expect(api.calls[1].body).toEqual({ endpoint: ENDPOINT, keys: { p256dh: "BPub", auth: "Auth" }, content_encoding: "aes128gcm" });
  });

  it("a subscription made with an old server key is dropped on load: the switch reads off", async () => {
    installBrowser({ standalone: true });
    push.permission = "granted";
    push.registered = true;
    push.sub = new FakeSubscription(OTHER_KEY_BYTES);
    render(<PhoneAppMenuEntry />);
    await screen.findByRole("button", { name: /Включить уведомления на телефоне/ });
    expect(log).toEqual(["GET /web-push/public-key", "DELETE /web-push/subscriptions", "unsubscribe"]);
  });

  it.each([
    ["null", null],
    ["404", 404],
  ])("feature off on the server (%s): nothing is shown", async (_label, answer) => {
    installBrowser({ standalone: true });
    api.publicKey = answer;
    const { container } = render(<PhoneAppMenuEntry />);
    await waitFor(() => expect(api.calls.length).toBe(1));
    await act(async () => {});
    expect(container.innerHTML).toBe("");
  });

  it("blocked by the browser: says so, and offers no button", async () => {
    installBrowser({ standalone: true });
    push.permission = "denied";
    render(<PhoneAppMenuEntry />);
    expect(await screen.findByText(/Заблокированы браузером/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("refused at the question: the card turns to «blocked», nothing is subscribed", async () => {
    installBrowser({ standalone: true });
    push.answer = "denied";
    render(<PhoneAppMenuEntry />);
    fireEvent.click(await screen.findByRole("button", { name: /Включить уведомления на телефоне/ }));
    expect(await screen.findByText(/Заблокированы браузером/)).toBeTruthy();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("a browser without the Push API: says it is not supported, asks the server nothing", async () => {
    installBrowser({ standalone: true, pushApi: false });
    render(<PhoneAppMenuEntry />);
    expect(screen.getByText("Этот браузер их не поддерживает")).toBeTruthy();
    await act(async () => {});
    expect(api.calls).toEqual([]);
  });

  it("the server refuses the subscription: the phone drops it again and says so", async () => {
    installBrowser({ standalone: true });
    api.failPost = true;
    render(<PhoneAppMenuEntry />);
    fireEvent.click(await screen.findByRole("button", { name: /Включить уведомления на телефоне/ }));
    await waitFor(() => expect(toasts).toEqual(["Не удалось включить уведомления. Попробуйте ещё раз."]));
    expect(push.sub).toBeNull();
    expect(log.at(-1)).toBe("unsubscribe");
    expect(screen.getByRole("button", { name: /Включить уведомления на телефоне/ })).toBeTruthy();
  });
});

describe("the public-key read", () => {
  it("null or 404 means the feature is off; any other failure is an error, not «off»", async () => {
    const { fetchPublicKey } = await import("@web/web/pwa/webPush");
    expect(await fetchPublicKey()).toBe(KEY);
    api.publicKey = null;
    expect(await fetchPublicKey()).toBeNull();
    api.publicKey = 404;
    expect(await fetchPublicKey()).toBeNull();
    api.publicKey = 500;
    await expect(fetchPublicKey()).rejects.toMatchObject({ status: 500 });
  });
});

describe("signing out", () => {
  it("removes this phone's subscription on the server before the session ends", async () => {
    installBrowser({ standalone: true });
    push.registered = true;
    push.sub = new FakeSubscription(KEY_BYTES);
    const { apiLogout } = await import("@/api/auth");
    await apiLogout();
    expect(log).toEqual(["DELETE /web-push/subscriptions", "unsubscribe", "POST /owner-web/session/logout"]);
  });

  it("without a subscription it signs out exactly as before", async () => {
    installBrowser({ standalone: true });
    const { apiLogout } = await import("@/api/auth");
    await apiLogout();
    expect(log).toEqual(["POST /owner-web/session/logout"]);
  });
});

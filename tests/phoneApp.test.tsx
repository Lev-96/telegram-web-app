// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The installable app's card in the menu (2026-11-09): Chrome's install offer,
 * iOS's steps, nothing inside Telegram but a note, and — in the installed app —
 * the phone-notifications switch against the backend's web-push endpoints
 * (mocked here: GET /web-push/public-key, POST / DELETE /web-push/subscriptions).
 * Then the app's ONE shared notifications state, the installed app's
 * first-launch prompt, the silent re-subscribe, and the browser's install banner.
 */

const log = vi.hoisted(() => [] as string[]);
const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method: string; body: unknown }>,
  publicKey: null as unknown,
  failPost: false,
}));
const toasts = vi.hoisted(() => [] as string[]);
const toastKinds = vi.hoisted(() => [] as string[]);
const session = vi.hoisted(() => ({ user: { id: 7, role: "company_owner" } as { id: number; role: string } | null, lang: "ru" }));

vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: session.user }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ lang: session.lang, setLang: vi.fn(), t: (k: string) => k }) }));
vi.mock("@/ui/notify", () => ({
  notify: {
    message: (kind: string, text: string) => {
      toastKinds.push(kind);
      toasts.push(text);
    },
  },
}));
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

import InstallBanner from "@web/web/InstallBanner";
import IosInstallSteps from "@web/web/IosInstallSteps";
import PhoneAppMenuEntry from "@web/web/PhoneAppMenuEntry";
import PhoneNotificationsPrompt from "@web/web/PhoneNotificationsPrompt";
import { WEB_TEXT } from "@web/web/i18n";
import { startInstallCapture } from "@web/web/pwa/installPrompt";
import { PhoneNotificationsProvider } from "@web/web/pwa/PhoneNotificationsContext";

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
  failSubscribe: false,
};

const pushManager = {
  getSubscription: vi.fn(async () => push.sub),
  subscribe: vi.fn(async (opts: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => {
    log.push("subscribe");
    if (push.failSubscribe) throw new Error("AbortError: push service not available");
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
  toastKinds.length = 0;
  api.calls = [];
  api.publicKey = KEY;
  api.failPost = false;
  session.user = { id: 7, role: "company_owner" };
  session.lang = "ru";
  sessionStorage.clear();
  Object.assign(push, { sub: null, registered: false, permission: "default", answer: "granted", failSubscribe: false });
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

/** The menu card as the Layout mounts it: under the app's one notifications provider. */
const renderMenu = () =>
  render(
    <PhoneNotificationsProvider>
      <PhoneAppMenuEntry />
    </PhoneNotificationsProvider>,
  );

/** Everything that reads the shared state: the menu card and the first-launch prompt. */
const renderApp = () =>
  render(
    <PhoneNotificationsProvider>
      <PhoneAppMenuEntry />
      <PhoneNotificationsPrompt />
    </PhoneNotificationsProvider>,
  );

const publicKeyReads = () => api.calls.filter((c) => c.path === "/web-push/public-key").length;
const posts = () => api.calls.filter((c) => c.method === "POST" && c.path === "/web-push/subscriptions");
const EXACT_BODY = { endpoint: ENDPOINT, keys: { p256dh: "BPub", auth: "Auth" }, content_encoding: "aes128gcm" };

/** Waits for the provider's load (key read + sync) to settle. */
const settle = async () => {
  await waitFor(() => expect(publicKeyReads()).toBeGreaterThan(0));
  await act(async () => {});
  await act(async () => {});
};

describe("install the app", () => {
  it("Chrome: the held install offer becomes «Установить приложение», which shows Chrome's dialog", async () => {
    installBrowser();
    renderMenu();
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
    renderMenu();
    offerInstall();
    expect(screen.getByText("Установить приложение")).toBeTruthy();
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.queryByText("Установить приложение")).toBeNull();
  });

  it("iOS: no dialog exists, so the card unfolds the four numbered steps", () => {
    installBrowser({ ios: true });
    renderMenu();
    const card = screen.getByRole("button", { name: /Установить приложение/ });
    expect(card.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(card);
    expect(card.getAttribute("aria-expanded")).toBe("true");
    const steps = document.getElementById(card.getAttribute("aria-controls")!)!;
    expect(steps.querySelectorAll("li")).toHaveLength(4);
    expect(steps.textContent).toContain("На экран „Домой“");
    expect(steps.textContent).toContain("iOS 16.4");
  });

  it("Telegram Mini App: no install, no switch; notices come from the bot", async () => {
    installBrowser({ standalone: true });
    document.documentElement.dataset.shell = "telegram";
    renderMenu();
    offerInstall();
    expect(screen.queryByText("Установить приложение")).toBeNull();
    expect(screen.getByText("В Telegram они приходят от бота")).toBeTruthy();
    await act(async () => {});
    expect(api.calls).toEqual([]);
  });

  it("a desktop browser without an offer shows nothing and asks the server nothing", async () => {
    installBrowser();
    const { container } = renderMenu();
    await act(async () => {});
    expect(container.innerHTML).toBe("");
    expect(api.calls).toEqual([]);
  });
});

describe("phone notifications (installed app)", () => {
  it("permission → worker → subscription → the server, in that order, with the exact body", async () => {
    installBrowser({ standalone: true });
    renderMenu();
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
    renderMenu();
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
    renderMenu();
    await screen.findByText("Включены на этом телефоне");
    expect(log).toEqual(["GET /web-push/public-key", "POST /web-push/subscriptions"]);
    expect(api.calls[1].body).toEqual({ endpoint: ENDPOINT, keys: { p256dh: "BPub", auth: "Auth" }, content_encoding: "aes128gcm" });
  });

  it("a subscription made with an old server key is dropped on load, then made again with the new key", async () => {
    installBrowser({ standalone: true });
    push.permission = "granted";
    push.registered = true;
    push.sub = new FakeSubscription(OTHER_KEY_BYTES);
    renderMenu();
    await screen.findByText("Включены на этом телефоне");
    expect(log).toEqual([
      "GET /web-push/public-key",
      "DELETE /web-push/subscriptions",
      "unsubscribe",
      'register /sw.js {"scope":"/"}',
      "subscribe",
      "POST /web-push/subscriptions",
    ]);
    expect(Array.from(pushManager.subscribe.mock.calls[0][0].applicationServerKey)).toEqual(Array.from(KEY_BYTES));
    expect(posts().map((c) => c.body)).toEqual([EXACT_BODY]);
  });

  it.each([
    ["null", null],
    ["404", 404],
  ])("feature off on the server (%s): nothing is shown", async (_label, answer) => {
    installBrowser({ standalone: true });
    api.publicKey = answer;
    const { container } = renderMenu();
    await waitFor(() => expect(api.calls.length).toBe(1));
    await act(async () => {});
    expect(container.innerHTML).toBe("");
  });

  it("blocked by the browser: says so, and offers no button", async () => {
    installBrowser({ standalone: true });
    push.permission = "denied";
    renderMenu();
    expect(await screen.findByText(/Заблокированы браузером/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("refused at the question: the card turns to «blocked», nothing is subscribed", async () => {
    installBrowser({ standalone: true });
    push.answer = "denied";
    renderMenu();
    fireEvent.click(await screen.findByRole("button", { name: /Включить уведомления на телефоне/ }));
    expect(await screen.findByText(/Заблокированы браузером/)).toBeTruthy();
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("a browser without the Push API: says it is not supported, asks the server nothing", async () => {
    installBrowser({ standalone: true, pushApi: false });
    renderMenu();
    expect(screen.getByText("Этот браузер их не поддерживает")).toBeTruthy();
    await act(async () => {});
    expect(api.calls).toEqual([]);
  });

  it("the server refuses the subscription: the phone drops it again and says so", async () => {
    installBrowser({ standalone: true });
    api.failPost = true;
    renderMenu();
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

describe("one shared notifications state per app", () => {
  it("the menu card and the prompt together read the key once and POST once", async () => {
    installBrowser({ standalone: true });
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Разрешить уведомления" }));
    await screen.findByText("Включены на этом телефоне");
    await act(async () => {});
    expect(publicKeyReads()).toBe(1);
    expect(posts()).toHaveLength(1);
  });

  it("already allowed: one silent re-send, not one per consumer", async () => {
    installBrowser({ standalone: true });
    push.permission = "granted";
    push.registered = true;
    push.sub = new FakeSubscription(KEY_BYTES);
    renderApp();
    await screen.findByText("Включены на этом телефоне");
    await act(async () => {});
    expect(publicKeyReads()).toBe(1);
    expect(posts()).toHaveLength(1);
  });

  it("the card outside the provider is a wiring bug, said loudly", () => {
    installBrowser({ standalone: true });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<PhoneAppMenuEntry />)).toThrow(/outside PhoneNotificationsProvider/);
    quiet.mockRestore();
  });
});

describe("the first-launch prompt (installed app)", () => {
  const dialog = () => screen.queryByRole("dialog", { name: "Включите уведомления" });

  it("opens on the installed app's first launch, over the screen, with the two answers", async () => {
    installBrowser({ standalone: true });
    renderApp();
    const sheet = await screen.findByRole("dialog", { name: "Включите уведомления" });
    expect(sheet.textContent).toContain("даже на экран блокировки");
    expect(screen.getByRole("button", { name: "Разрешить уведомления" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Позже" })).toBeTruthy();
    // The main action has the focus (a sheet has no text field for the Modal to focus).
    expect(document.activeElement?.textContent).toBe("Разрешить уведомления");
  });

  it.each([
    ["a browser tab", () => installBrowser()],
    ["an iPhone's browser tab", () => installBrowser({ ios: true })],
    [
      "the Telegram Mini App",
      () => {
        installBrowser({ standalone: true });
        document.documentElement.dataset.shell = "telegram";
      },
    ],
  ])("never in %s, and the server is asked nothing", async (_label, setup) => {
    setup();
    renderApp();
    await act(async () => {});
    await act(async () => {});
    expect(dialog()).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it("never when signed out", async () => {
    installBrowser({ standalone: true });
    session.user = null;
    renderApp();
    await act(async () => {});
    expect(dialog()).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it.each([
    ["the server has no web push (null)", () => (api.publicKey = null)],
    ["the server has no web push (404)", () => (api.publicKey = 404)],
    ["notifications are blocked", () => (push.permission = "denied")],
    [
      "they are already on",
      () => {
        push.permission = "granted";
        push.registered = true;
        push.sub = new FakeSubscription(KEY_BYTES);
      },
    ],
  ])("never when %s", async (_label, setup) => {
    installBrowser({ standalone: true });
    setup();
    renderApp();
    await settle();
    expect(dialog()).toBeNull();
  });

  it("never when allowed but the silent subscribe failed: the menu card offers the tap", async () => {
    installBrowser({ standalone: true });
    push.permission = "granted";
    push.failSubscribe = true;
    renderApp();
    await screen.findByRole("button", { name: /Включить уведомления на телефоне/ });
    expect(dialog()).toBeNull();
  });

  it("never in a browser without the Push API", async () => {
    installBrowser({ standalone: true, pushApi: false });
    renderApp();
    await act(async () => {});
    expect(dialog()).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it("«Разрешить» asks for the permission synchronously inside the tap, then subscribes and POSTs the exact body", async () => {
    installBrowser({ standalone: true });
    renderApp();
    const allow = await screen.findByRole("button", { name: "Разрешить уведомления" });
    const ask = vi.mocked(Notification.requestPermission);
    expect(ask).not.toHaveBeenCalled();

    fireEvent.click(allow);
    // No await between the click and this line: no promise has resolved yet.
    expect(ask).toHaveBeenCalledTimes(1);
    expect(log).toEqual(["GET /web-push/public-key", "permission"]);

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(log).toEqual([
      "GET /web-push/public-key",
      "permission",
      'register /sw.js {"scope":"/"}',
      "subscribe",
      "POST /web-push/subscriptions",
    ]);
    expect(posts()[0].body).toEqual(EXACT_BODY);
    await waitFor(() => expect(dialog()).toBeNull());
    expect(toasts).toEqual(["Уведомления включены"]);
    expect(toastKinds).toEqual(["success"]);
  });

  it("«Позже» hides it for this session; a fresh launch asks again while the permission is still unasked", async () => {
    installBrowser({ standalone: true });
    const first = renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Позже" }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    // Still off, still "default": the card in the menu keeps its button.
    expect(screen.getByRole("button", { name: /Включить уведомления на телефоне/ })).toBeTruthy();
    first.unmount();

    renderApp();
    expect(await screen.findByRole("dialog", { name: "Включите уведомления" })).toBeTruthy();
  });

  it("refused: the sheet explains how to allow them on an iPhone, and the next launch does not nag", async () => {
    installBrowser({ standalone: true, ios: true });
    push.answer = "denied";
    const first = renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Разрешить уведомления" }));

    const blocked = await screen.findByRole("dialog", { name: "Уведомления запрещены" });
    expect(blocked.textContent).toContain("Настройки → Уведомления → Cyber Place → Допуск уведомлений");
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(posts()).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // The menu card keeps the blocked note.
    expect(screen.getByText(/Заблокированы браузером/)).toBeTruthy();
    first.unmount();

    renderApp();
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(/Заблокированы браузером/)).toBeTruthy();
  });

  it("the server refuses the subscription: the error toast, and the menu card (not the sheet) offers another try", async () => {
    installBrowser({ standalone: true });
    api.failPost = true;
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Разрешить уведомления" }));
    await waitFor(() => expect(toasts).toEqual(["Не удалось включить уведомления. Попробуйте ещё раз."]));
    expect(push.sub).toBeNull();
    // Granted now, but not subscribed: not "default" any more, so the sheet goes and the card offers the tap.
    await waitFor(() => expect(dialog()).toBeNull());
    expect(screen.getByRole("button", { name: /Включить уведомления на телефоне/ })).toBeTruthy();
  });
});

describe("silent re-subscribe on load (syncPush)", () => {
  it("allowed but no subscription: subscribes with the server key and POSTs the exact body", async () => {
    installBrowser({ standalone: true });
    push.permission = "granted";
    const { syncPush } = await import("@web/web/pwa/webPush");
    expect(await syncPush(KEY)).toBe("on");
    expect(log).toEqual(['register /sw.js {"scope":"/"}', "subscribe", "POST /web-push/subscriptions"]);
    expect(Array.from(pushManager.subscribe.mock.calls[0][0].applicationServerKey)).toEqual(Array.from(KEY_BYTES));
    expect(posts().map((c) => c.body)).toEqual([EXACT_BODY]);
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });

  it("the silent subscribe throws: «off», nothing POSTed", async () => {
    installBrowser({ standalone: true });
    push.permission = "granted";
    push.failSubscribe = true;
    const { syncPush } = await import("@web/web/pwa/webPush");
    expect(await syncPush(KEY)).toBe("off");
    expect(posts()).toEqual([]);
  });

  it("the server refuses the silent POST: «off», and the phone drops the new subscription", async () => {
    installBrowser({ standalone: true });
    push.permission = "granted";
    api.failPost = true;
    const { syncPush } = await import("@web/web/pwa/webPush");
    expect(await syncPush(KEY)).toBe("off");
    expect(log.slice(-2)).toEqual(["POST /web-push/subscriptions", "unsubscribe"]);
    expect(push.sub).toBeNull();
  });

  it("not allowed: asks nothing, subscribes nothing", async () => {
    installBrowser({ standalone: true });
    const { syncPush } = await import("@web/web/pwa/webPush");
    expect(await syncPush(KEY)).toBe("off");
    expect(log).toEqual([]);
  });

  it("in the app: the card reads «on» after the silent re-subscribe", async () => {
    installBrowser({ standalone: true });
    push.permission = "granted";
    renderApp();
    await screen.findByText("Включены на этом телефоне");
    expect(posts()).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the iOS install steps", () => {
  it.each(["ru", "en", "am"] as const)("four numbered steps and the note in %s", (lang) => {
    session.lang = lang;
    const { container } = render(<IosInstallSteps />);
    const items = Array.from(container.querySelectorAll("ol > li"));
    expect(items).toHaveLength(4);
    const allow = WEB_TEXT["web.push.allow"][lang];
    const expected = (["web.app.iosStep1", "web.app.iosStep2", "web.app.iosStep3", "web.app.iosStep4"] as const).map((k) =>
      WEB_TEXT[k][lang].replace("{0}", allow),
    );
    expect(items.map((li) => li.querySelector(".web-ios-steps__text")!.textContent)).toEqual(expected);
    expect(items.map((li) => li.querySelector(".web-ios-steps__num")!.textContent)).toEqual(["1", "2", "3", "4"]);
    // Share and Add to Home Screen carry Safari's icons.
    expect(items.map((li) => li.querySelector("svg") !== null)).toEqual([true, true, false, false]);
    expect(container.querySelector(".web-ios-steps__note")!.textContent).toBe(WEB_TEXT["web.app.iosNote"][lang]);
  });
});

describe("the install banner (browser tab)", () => {
  const banner = () => screen.queryByRole("region", { name: "Установить приложение" });

  it("iPhone: shows once, opens the four steps, and is not shown again this session", () => {
    installBrowser({ ios: true });
    const first = render(<InstallBanner />);
    expect(banner()?.textContent).toContain("Установите Cyber Place на iPhone");
    fireEvent.click(screen.getByRole("button", { name: "Как установить" }));
    const guide = screen.getByRole("dialog", { name: "Установка на iPhone" });
    expect(guide.querySelectorAll("ol > li")).toHaveLength(4);
    expect(banner()).toBeNull();
    first.unmount();

    render(<InstallBanner />);
    expect(banner()).toBeNull();
  });

  it("× dismisses it for the session, for this account only", () => {
    installBrowser({ ios: true });
    const first = render(<InstallBanner />);
    fireEvent.click(within(banner()!).getByRole("button", { name: "Закрыть" }));
    expect(banner()).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    first.unmount();

    const again = render(<InstallBanner />);
    expect(banner()).toBeNull();
    again.unmount();

    session.user = { id: 8, role: "company_owner" };
    render(<InstallBanner />);
    expect(banner()).not.toBeNull();
  });

  it("Chrome: only while an install offer is held; «Установить» shows Chrome's dialog inside the tap", () => {
    installBrowser();
    render(<InstallBanner />);
    expect(banner()).toBeNull();
    const { prompt } = offerInstall();
    expect(banner()?.textContent).toContain("Установите приложение");
    fireEvent.click(screen.getByRole("button", { name: "Установить" }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(banner()).toBeNull();
  });

  it.each([
    ["the installed app", () => installBrowser({ standalone: true, ios: true })],
    [
      "Telegram",
      () => {
        installBrowser({ ios: true });
        document.documentElement.dataset.shell = "telegram";
      },
    ],
    [
      "signed out",
      () => {
        installBrowser({ ios: true });
        session.user = null;
      },
    ],
  ])("not in %s", (_label, setup) => {
    setup();
    render(<InstallBanner />);
    offerInstall();
    expect(banner()).toBeNull();
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requests = vi.hoisted(() => ({ calls: [] as Array<{ path: string; body: unknown }>, next: null as unknown }));
vi.mock("@/api/client", () => ({
  request: async (path: string, opts: { body?: unknown } = {}) => {
    requests.calls.push({ path, body: opts.body });
    if (requests.next instanceof Error) {
      // As the real client does: an address block is announced to the app.
      const { networkBlock, networkBlockCodeOf } = await import("@/auth/networkBlock");
      const e = requests.next as Error & { status?: number; body?: unknown };
      const blocked = networkBlockCodeOf(e.status, e.body);
      if (blocked) networkBlock.raise(blocked);
      throw requests.next;
    }
    return requests.next;
  },
  apiCache: { clear: () => {} },
}));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: "en", t: (k: string) => t(k, "en") }) };
});

import { AppConfig } from "@/infrastructure/AppConfig";
import TelegramGate, { forgetExchanges } from "@web/telegram/TelegramGate";
import { readTelegramLaunch } from "@web/telegram/telegram";

const webApp = (initData: string, startParam?: string) => ({
  initData,
  initDataUnsafe: startParam ? { start_param: startParam } : {},
  ready: vi.fn(),
  expand: vi.fn(),
  close: vi.fn(),
});

beforeEach(async () => {
  (await import("@/auth/networkBlock")).networkBlock.resetForTests();
  forgetExchanges();
  requests.calls = [];
  requests.next = null;
  window.sessionStorage.clear();
  window.localStorage.clear();
  document.documentElement.dataset.shell = "telegram";
  delete window.Telegram;
});
afterEach(cleanup);

describe("reading the Telegram launch", () => {
  it("is null in a plain browser", () => {
    expect(readTelegramLaunch()).toBeNull();
  });

  it("is null when Telegram's script runs outside Telegram (empty launch data)", () => {
    window.Telegram = { WebApp: webApp("") as never };
    expect(readTelegramLaunch()).toBeNull();
  });

  it("hands over the raw launch data, spots a link code, and clears Telegram's hash before the router sees it", () => {
    window.history.replaceState(null, "", "/#tgWebAppData=abc&tgWebAppVersion=8.0");
    window.Telegram = { WebApp: webApp("auth_date=1&hash=x", "link_CODE") as never };

    const launch = readTelegramLaunch();
    expect(launch?.initData).toBe("auth_date=1&hash=x");
    expect(launch?.linkParam).toBe("link_CODE");
    expect(window.location.hash).toBe("");
  });

  it("ignores a start parameter that is not a link code", () => {
    window.Telegram = { WebApp: webApp("auth_date=1&hash=x", "promo") as never };
    expect(readTelegramLaunch()?.linkParam).toBeNull();
  });
});

describe("the Telegram gate", () => {
  const launch = (linkParam: string | null = null) => ({ initData: "signed", linkParam, webApp: webApp("signed") as never });

  it("trades the launch for a session exactly once, even under StrictMode, then shows the panel", async () => {
    requests.next = { login: { id: 1, name: "O", email: "o@x", role: "company_owner" }, token: "1|tg" };
    render(
      <StrictMode>
        <TelegramGate launch={launch()}>
          <p>panel</p>
        </TelegramGate>
      </StrictMode>,
    );

    await screen.findByText("panel");
    expect(requests.calls).toEqual([{ path: "/telegram/mini-app/session", body: { init_data: "signed" } }]);
    expect(window.sessionStorage.getItem(AppConfig.storageKeys.token)).toBe('"1|tg"');
  });

  it("keeps the session it already has on a reload instead of asking again", async () => {
    window.sessionStorage.setItem(AppConfig.storageKeys.token, '"1|tg"');
    render(
      <TelegramGate launch={launch()}>
        <p>panel</p>
      </TelegramGate>,
    );
    await screen.findByText("panel");
    expect(requests.calls).toEqual([]);
  });

  it("mounted again after the language picker, it does not trade the same launch twice", async () => {
    requests.next = { login: { id: 1, name: "O", email: "o@x", role: "company_owner" }, token: "2|handoff" };
    const same = launch("link_CODE");
    const first = render(
      <TelegramGate launch={same}>
        <p>panel</p>
      </TelegramGate>,
    );
    await first.findByText("panel");
    first.unmount();

    // The server refuses a second use of the same launch.
    requests.next = Object.assign(new Error("Telegram did not confirm who you are."), { status: 401 });
    render(
      <TelegramGate launch={same}>
        <p>panel</p>
      </TelegramGate>,
    );
    await screen.findByText("panel");
    expect(requests.calls.map((c) => c.path)).toEqual(["/telegram/mini-app/link"]);
  });

  it("a handoff launch from the web signs in at once and shows the panel", async () => {
    requests.next = { login: { id: 1, name: "O", email: "o@x", role: "company_owner" }, token: "2|handoff" };
    render(
      <TelegramGate launch={launch("link_CODE")}>
        <p>panel</p>
      </TelegramGate>,
    );
    await screen.findByText("panel");
    expect(requests.calls).toEqual([{ path: "/telegram/mini-app/link", body: { init_data: "signed" } }]);
    expect(window.sessionStorage.getItem(AppConfig.storageKeys.token)).toBe('"2|handoff"');
  });

  it("a handoff replaces the session this Mini App already held", async () => {
    window.sessionStorage.setItem(AppConfig.storageKeys.token, '"1|old"');
    requests.next = { login: { id: 2, name: "B", email: "b@x", role: "company_owner" }, token: "3|new" };
    render(
      <TelegramGate launch={launch("link_CODE")}>
        <p>panel</p>
      </TelegramGate>,
    );
    await screen.findByText("panel");
    expect(requests.calls.map((c) => c.path)).toEqual(["/telegram/mini-app/link"]);
    expect(window.sessionStorage.getItem(AppConfig.storageKeys.token)).toBe('"3|new"');
  });

  it("shows the server's refusal and never the panel", async () => {
    requests.next = Object.assign(new Error("This Telegram account is not linked to Cyber Place yet."), { status: 403 });
    render(
      <TelegramGate launch={launch()}>
        <p>panel</p>
      </TelegramGate>,
    );
    await waitFor(() => expect(screen.getByText(/not linked to Cyber Place/)).toBeTruthy());
    expect(screen.queryByText("panel")).toBeNull();
  });

  it("a blocked address gets the block screen, not a generic refusal (2026-10-01)", async () => {
    requests.next = Object.assign(new Error("Your IP is blocked."), { status: 403, body: { code: "ip_blocked" } });
    render(
      <TelegramGate launch={launch()}>
        <p>panel</p>
      </TelegramGate>,
    );
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("from your IP address has been closed"));
    expect(screen.queryByText("panel")).toBeNull();
  });
});

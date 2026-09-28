// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requests = vi.hoisted(() => ({ calls: [] as Array<{ path: string; body: unknown }>, next: null as unknown }));
vi.mock("@/api/client", () => ({
  request: async (path: string, opts: { body?: unknown } = {}) => {
    requests.calls.push({ path, body: opts.body });
    if (requests.next instanceof Error) throw requests.next;
    return requests.next;
  },
}));
vi.mock("@/i18n/LanguageContext", () => ({ useLang: () => ({ lang: "en" }) }));

import { AppConfig } from "@/infrastructure/AppConfig";
import TelegramGate from "@web/telegram/TelegramGate";
import { readTelegramLaunch } from "@web/telegram/telegram";

const webApp = (initData: string, startParam?: string) => ({
  initData,
  initDataUnsafe: startParam ? { start_param: startParam } : {},
  ready: vi.fn(),
  expand: vi.fn(),
  close: vi.fn(),
});

beforeEach(() => {
  requests.calls = [];
  requests.next = null;
  window.sessionStorage.clear();
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

  it("a link launch redeems the code and asks for confirmation on the web — no session", async () => {
    requests.next = { status: "pending", message: "confirm" };
    render(
      <TelegramGate launch={launch("link_CODE")}>
        <p>panel</p>
      </TelegramGate>,
    );
    await screen.findByText(/confirm this Telegram account/i);
    expect(requests.calls).toEqual([{ path: "/telegram/mini-app/link", body: { init_data: "signed" } }]);
    expect(screen.queryByText("panel")).toBeNull();
    expect(window.sessionStorage.getItem(AppConfig.storageKeys.token)).toBeNull();
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
});

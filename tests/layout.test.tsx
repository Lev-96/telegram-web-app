// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The web shell's frame (2026-09-29): logo on the left, menu button on the
 * right, and
 * "Telegram" as a card in the menu — for an owner in a browser only.
 */

const auth = vi.hoisted(() => ({ role: "company_owner" }));
const handoff = vi.hoisted(() => ({
  calls: [] as string[],
  reply: { url: "https://t.me/cp_owner_bot/panel?startapp=link_X", expires_at: new Date(Date.now() + 120_000).toISOString() } as unknown,
}));

vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: auth.role } }) }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: "ru", setLang: vi.fn(), t: (k: string) => t(k, "ru") }) };
});
vi.mock("@/components/Sidebar", () => ({
  default: ({ footerExtra }: { footerExtra?: ReactNode }) => <aside className="sidebar">{footerExtra}</aside>,
}));
vi.mock("@/components/notifications/ExpenseReminderNotifier", () => ({ default: () => null }));
vi.mock("@/components/notifications/GlobalBookingNotifier", () => ({ default: () => null }));
vi.mock("@/components/notifications/SessionEndingNotifier", () => ({ default: () => null }));
vi.mock("@/components/notifications/BillingNoticeNotifier", () => ({ default: () => null }));
vi.mock("@/components/notifications/SupportNotifier", () => ({ default: () => null }));
vi.mock("@/components/ps5/UnexpectedWakeDialog", () => ({ default: () => null }));
vi.mock("@/components/ui/BackButton", () => ({ default: () => null }));
vi.mock("@/components/ui/PageTopBar", () => ({ default: () => <div data-testid="page-topbar" /> }));
vi.mock("@/components/appearance/UnsavedInterfaceNotice", () => ({ default: () => <div data-testid="unsaved-interface" /> }));
vi.mock("@/components/appearance/NewInterfacesOffer", () => ({ default: () => <div data-testid="new-interfaces" /> }));
vi.mock("@web/web/PhoneAppMenuEntry", () => ({ default: () => <div data-testid="phone-app" /> }));
vi.mock("@web/web/PhoneNotificationsPrompt", () => ({ default: () => <div data-testid="push-prompt" /> }));
vi.mock("@web/web/InstallBanner", () => ({ default: () => <div data-testid="install-banner" /> }));
vi.mock("@web/web/appShell/AppTopActions", () => ({ default: () => <div className="web-topbar__actions" data-testid="top-actions" /> }));
vi.mock("@web/web/appShell/AppTabBar", () => ({
  default: ({ footerExtra }: { footerExtra?: ReactNode }) => <nav className="web-tabbar">{footerExtra}</nav>,
}));
vi.mock("@web/web/pwa/PhoneNotificationsContext", () => ({
  PhoneNotificationsProvider: ({ children }: { children: ReactNode }) => <div data-testid="push-provider">{children}</div>,
}));
vi.mock("@/ps5/Ps5ControlProvider", () => ({ Ps5ControlProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/api/client", () => ({
  request: async (path: string) => {
    handoff.calls.push(path);
    return handoff.reply;
  },
}));

import Layout from "@/components/Layout";

const mount = () =>
  render(
    <MemoryRouter>
      <Layout />
    </MemoryRouter>,
  );

const asInstalled = (installed: boolean) => {
  window.matchMedia = ((q: string) => ({ matches: installed && q === "(display-mode: standalone)" })) as unknown as typeof window.matchMedia;
};

afterEach(() => {
  cleanup();
  asInstalled(false);
  delete window.Telegram;
  document.documentElement.dataset.shell = "";
  handoff.calls = [];
});

describe("web shell frame", () => {
  it("puts the logo first (left) and the menu button last (right), and nothing else", () => {
    document.documentElement.dataset.shell = "web";
    const { container } = mount();
    const bar = container.querySelector(".web-topbar")!;
    expect([...bar.children].map((el) => el.className)).toEqual(["web-topbar__logo", "web-topbar__menu"]);
  });

  it("gives an owner a Telegram card that is a real link to a prepared handoff, and the tap closes the drawer", async () => {
    document.documentElement.dataset.shell = "web";
    auth.role = "company_owner";
    const { container } = mount();

    fireEvent.click(container.querySelector(".web-topbar__menu")!);
    expect(container.querySelector(".web-shell")!.classList.contains("is-drawer-open")).toBe(true);

    const entry = container.querySelector(".sidebar .web-telegram-entry") as HTMLAnchorElement;
    expect(entry.textContent).toContain("Telegram");
    await waitFor(() => expect(entry.getAttribute("href")).toBe("https://t.me/cp_owner_bot/panel?startapp=link_X"));
    expect(handoff.calls).toEqual(["/client-access/telegram/open"]);
    expect(entry.getAttribute("target")).toBe("_blank");
    expect(entry.getAttribute("rel")).toContain("noopener");

    const followed = fireEvent.click(entry);
    expect(followed).toBe(true); // not prevented: the browser follows the link itself
    expect(container.querySelector(".web-shell")!.classList.contains("is-drawer-open")).toBe(false);
  });

  it("offers a manager no Telegram at all", () => {
    document.documentElement.dataset.shell = "web";
    auth.role = "manager";
    const { container } = mount();
    expect(container.querySelector(".web-telegram-entry")).toBeNull();
    expect(handoff.calls).toEqual([]);
  });

  it("offers no Telegram inside Telegram", () => {
    document.documentElement.dataset.shell = "telegram";
    auth.role = "company_owner";
    const { container } = mount();
    expect(container.querySelector(".web-telegram-entry")).toBeNull();
    expect(handoff.calls).toEqual([]);
  });
});

describe("the installable app's card (2026-11-09)", () => {
  it.each(["web", "telegram"])("sits in the menu, after the Telegram card (%s)", (shell) => {
    document.documentElement.dataset.shell = shell;
    auth.role = "company_owner";
    const { container } = mount();
    const footer = container.querySelector(".sidebar")!;
    const ids = Array.from(footer.children).map((el) => el.getAttribute("data-testid") ?? el.className);
    expect(ids).toEqual(shell === "web" ? ["nav-support-card web-telegram-entry", "phone-app"] : ["phone-app"]);
  });
});

describe("phone notifications run once, outside the menu (2026-11-09)", () => {
  it("one provider around the whole shell; the prompt and the install banner outside the drawer", () => {
    document.documentElement.dataset.shell = "web";
    const { container } = mount();
    const providers = container.querySelectorAll('[data-testid="push-provider"]');
    expect(providers).toHaveLength(1);
    expect(providers[0].firstElementChild?.classList.contains("web-shell")).toBe(true);
    for (const id of ["push-prompt", "install-banner"]) {
      const el = container.querySelectorAll(`[data-testid="${id}"]`);
      expect(el, id).toHaveLength(1);
      expect(el[0].closest(".web-drawer"), id).toBeNull();
      expect(el[0].closest(".web-shell"), id).not.toBeNull();
    }
  });
});

describe("what the desktop shell mounts above every screen (panel 2026-10-26/27)", () => {
  it("the top bar, then the unsaved-interface notice and the new-interfaces offer, before the screen", () => {
    document.documentElement.dataset.shell = "web";
    const { container } = mount();
    const main = container.querySelector("main.main")!;
    const ids = Array.from(main.children).map((el) => el.getAttribute("data-testid"));
    expect(ids.slice(0, 3)).toEqual(["page-topbar", "unsaved-interface", "new-interfaces"]);
  });
});


describe("the installed app's phone shell (2026-11-09)", () => {
  it("installed, outside Telegram: bell and avatar between the logo and the menu button, and the bottom bar after the screen", () => {
    document.documentElement.dataset.shell = "web";
    auth.role = "company_owner";
    asInstalled(true);
    const { container } = mount();
    const shell = container.querySelector(".web-shell")!;
    expect(shell.classList.contains("web-shell--app")).toBe(true);
    const bar = container.querySelector(".web-topbar")!;
    expect([...bar.children].map((el) => el.className)).toEqual(["web-topbar__logo", "web-topbar__actions", "web-topbar__menu"]);
    const tabbar = shell.querySelector(":scope > nav.web-tabbar")!;
    expect(tabbar.previousElementSibling?.tagName).toBe("MAIN");
    // The More sheet carries the menu's own footer cards, the same ones the drawer has.
    expect(tabbar.querySelector(".web-telegram-entry")).not.toBeNull();
    expect(tabbar.querySelector('[data-testid="phone-app"]')).not.toBeNull();
  });

  it("a browser tab keeps the plain frame", () => {
    document.documentElement.dataset.shell = "web";
    asInstalled(false);
    const { container } = mount();
    expect(container.querySelector(".web-shell--app")).toBeNull();
    expect(container.querySelector(".web-tabbar")).toBeNull();
    expect(container.querySelector(".web-topbar__actions")).toBeNull();
  });

  it.each([
    ["the shell mark", () => (document.documentElement.dataset.shell = "telegram")],
    ["Telegram's launch data", () => (window.Telegram = { WebApp: { initData: "query_id=1" } } as unknown as Window["Telegram"])],
  ])("Telegram keeps the plain frame even when it reports standalone (%s)", (_name, enterTelegram) => {
    document.documentElement.dataset.shell = "web";
    asInstalled(true);
    enterTelegram();
    const { container } = mount();
    expect(container.querySelector(".web-shell--app")).toBeNull();
    expect(container.querySelector(".web-tabbar")).toBeNull();
    expect(container.querySelector(".web-topbar__actions")).toBeNull();
  });
});

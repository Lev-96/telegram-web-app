// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The web shell's frame (2026-09-29): menu button and logo on the left, and
 * "Telegram" as a card in the menu — for an owner in a browser only.
 */

const auth = vi.hoisted(() => ({ role: "company_owner" }));
const telegramAccess = vi.hoisted(() => ({ lastOpen: null as boolean | null }));

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
vi.mock("@/components/notifications/SupportNotifier", () => ({ default: () => null }));
vi.mock("@/components/ps5/UnexpectedWakeDialog", () => ({ default: () => null }));
vi.mock("@/components/ui/BackButton", () => ({ default: () => null }));
vi.mock("@/ps5/Ps5ControlProvider", () => ({ Ps5ControlProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@web/web/TelegramAccess", () => ({
  default: ({ open }: { open: boolean }) => {
    telegramAccess.lastOpen = open;
    return open ? <div role="dialog">telegram-access</div> : null;
  },
}));

import Layout from "@/components/Layout";

const mount = () =>
  render(
    <MemoryRouter>
      <Layout />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  document.documentElement.dataset.shell = "";
  telegramAccess.lastOpen = null;
});

describe("web shell frame", () => {
  it("puts the menu button and the logo in the top bar, and nothing else", () => {
    document.documentElement.dataset.shell = "web";
    const { container } = mount();
    const bar = container.querySelector(".web-topbar")!;
    expect([...bar.children].map((el) => el.className)).toEqual(["web-topbar__menu", "web-topbar__logo"]);
  });

  it("gives an owner a Telegram card in the menu that opens the access dialog and closes the drawer", () => {
    document.documentElement.dataset.shell = "web";
    auth.role = "company_owner";
    const { container } = mount();

    fireEvent.click(container.querySelector(".web-topbar__menu")!);
    expect(container.querySelector(".web-shell")!.classList.contains("is-drawer-open")).toBe(true);

    const entry = container.querySelector(".sidebar .web-telegram-entry") as HTMLElement;
    expect(entry.textContent).toContain("Telegram");
    fireEvent.click(entry);

    expect(screen.getByRole("dialog").textContent).toBe("telegram-access");
    expect(container.querySelector(".web-shell")!.classList.contains("is-drawer-open")).toBe(false);
  });

  it("offers a manager no Telegram at all", () => {
    document.documentElement.dataset.shell = "web";
    auth.role = "manager";
    const { container } = mount();
    expect(container.querySelector(".web-telegram-entry")).toBeNull();
    expect(telegramAccess.lastOpen).toBeNull();
  });

  it("offers no Telegram inside Telegram", () => {
    document.documentElement.dataset.shell = "telegram";
    auth.role = "company_owner";
    const { container } = mount();
    expect(container.querySelector(".web-telegram-entry")).toBeNull();
    expect(telegramAccess.lastOpen).toBeNull();
  });
});

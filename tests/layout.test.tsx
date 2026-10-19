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
vi.mock("@/components/notifications/SupportNotifier", () => ({ default: () => null }));
vi.mock("@/components/ps5/UnexpectedWakeDialog", () => ({ default: () => null }));
vi.mock("@/components/ui/BackButton", () => ({ default: () => null }));
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

afterEach(() => {
  cleanup();
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

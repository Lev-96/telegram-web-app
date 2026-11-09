// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The installed app's phone shell (2026-11-09): the bell and avatar in the top
 * bar and the bottom navigation with its «More» sheet. The entries are the
 * real Sidebar's (compared here against the real Sidebar, per role and with a
 * personal arrangement); the counts are the menu's shared contexts.
 */

type Entry = { id: string; hidden: boolean };
const state = vi.hoisted(() => ({
  user: { id: 7, name: "Armen Petrosyan", email: "a@example.test", role: "company_owner", dashboard: { company_id: 3, branch_id: null } } as {
    id: number;
    name: string;
    email: string;
    role: string;
    dashboard: { company_id: number | null; branch_id: number | null };
  },
  lang: "ru" as "ru" | "en" | "am",
  unread: 3,
  supportUnread: 0,
  agentUpdate: false,
  arrangement: [] as Entry[],
  requests: [] as string[],
}));

vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: state.user, logout: vi.fn() }) }));
vi.mock("@/i18n/LanguageContext", async () => {
  const { t } = await import("@/i18n/translations");
  return { useLang: () => ({ lang: state.lang, setLang: vi.fn(), t: (k: string) => t(k, state.lang) }) };
});
vi.mock("@/notifications/NotificationsContext", () => ({ useNotifications: () => ({ unreadCount: state.unread }) }));
vi.mock("@/support/SupportUnreadContext", () => ({ useSupportUnread: () => ({ unread: state.supportUnread }) }));
vi.mock("@/realtime/UpdatesNotificationContext", () => ({
  useUpdatesNotification: () => ({ panel: null, agent: state.agentUpdate ? { has_update: true } : null }),
}));
vi.mock("@/preferences/UiPreferencesContext", () => ({
  useUiPreferencesOptional: () => ({ layout: { sidebar: state.arrangement } }),
}));
vi.mock("@/components/profile/ProfileModal", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="profile">
      <button type="button" onClick={onClose}>
        close-profile
      </button>
    </div>
  ),
}));
// Nothing here may poll or fetch: the counts come from the shared contexts.
vi.mock("@/api/client", () => ({
  request: async (p: string) => {
    state.requests.push(p);
    return {};
  },
  apiCache: { clear: () => undefined },
}));

import Sidebar from "@/components/Sidebar";
import AppTabBar from "@web/web/appShell/AppTabBar";
import AppTopActions from "@web/web/appShell/AppTopActions";
import { PRIMARY_TABS, initialsOf, splitTabs } from "@web/web/appShell/sideMenu";

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

const mount = (ui: ReactNode, at = "/") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      {ui}
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const hrefs = (els: Iterable<Element>) => [...els].map((a) => a.getAttribute("href"));

/** The bar's entries, then the More sheet's (Support excluded: it is the Sidebar's footer card). */
const shellEntries = async (container: HTMLElement) => {
  const bar = hrefs(container.querySelectorAll("a.web-tabbar__item"));
  const more = container.querySelector(".web-tabbar__more");
  if (!more) return { bar, sheet: [] as Array<string | null> };
  fireEvent.click(more);
  const sheet = await screen.findByTestId("more-sheet");
  return { bar, sheet: hrefs(sheet.querySelectorAll("a.web-more__row")).filter((h) => h !== "/support") };
};

beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  state.user = { id: 7, name: "Armen Petrosyan", email: "a@example.test", role: "company_owner", dashboard: { company_id: 3, branch_id: null } };
  state.lang = "ru";
  state.unread = 3;
  state.supportUnread = 0;
  state.agentUpdate = false;
  state.arrangement = [];
  state.requests = [];
});

describe("bottom navigation: the side menu's own entries", () => {
  const cases: Array<[string, () => void]> = [
    ["owner", () => undefined],
    ["manager", () => (state.user = { ...state.user, role: "manager", dashboard: { company_id: 3, branch_id: 9 } })],
    ["admin", () => (state.user = { ...state.user, role: "admin", dashboard: { company_id: null, branch_id: null } })],
    [
      "owner with a personal arrangement (reordered, one hidden, a branch shortcut)",
      () =>
        (state.arrangement = [
          { id: "branch.sessions.5", hidden: false },
          { id: "nav.bookings", hidden: false },
          { id: "nav.revenue", hidden: true },
          { id: "nav.myCompany", hidden: false },
        ]),
    ],
    ["owner in Armenian (sorted in Armenian order)", () => (state.lang = "am")],
  ];

  for (const [name, setup] of cases) {
    it(`matches the Sidebar entry for entry, in order: ${name}`, async () => {
      setup();
      const side = mount(<Sidebar />);
      const sidebar = hrefs(side.container.querySelectorAll(".sidebar-nav a"));
      side.unmount();

      const { container } = mount(<AppTabBar />);
      const { bar, sheet } = await shellEntries(container);
      expect(sidebar.length).toBeGreaterThan(PRIMARY_TABS + 1);
      expect([...bar, ...sheet]).toEqual(sidebar);
      expect(bar).toHaveLength(PRIMARY_TABS);
    });
  }

  it("a menu that fits keeps every entry on the bar and draws no More", () => {
    // Only the entries nobody can hide are left: Dashboard, Notifications, Settings, Interface.
    const hideable = ["nav.myCompany", "nav.branches", "nav.managers", "nav.revenue", "nav.shifts", "nav.map", "nav.scan", "nav.bookings", "nav.tournaments", "nav.agentUpdates", "nav.platformBilling", "nav.games", "nav.expenses"];
    state.arrangement = hideable.map((id) => ({ id, hidden: true }));
    const side = mount(<Sidebar />);
    const sidebar = hrefs(side.container.querySelectorAll(".sidebar-nav a"));
    side.unmount();
    const { container } = mount(<AppTabBar />);
    expect(sidebar).toHaveLength(PRIMARY_TABS + 1);
    expect(container.querySelector(".web-tabbar__more")).toBeNull();
    expect(hrefs(container.querySelectorAll("a.web-tabbar__item"))).toEqual(sidebar);
  });

  it("splits after the primary entries only when more than one would overflow", () => {
    expect(splitTabs([1, 2, 3, 4], 3)).toEqual({ tabs: [1, 2, 3, 4], more: [] });
    expect(splitTabs([1, 2, 3, 4, 5], 3)).toEqual({ tabs: [1, 2, 3], more: [4, 5] });
  });

  it("lights the menu's one current entry, and More for a page under the sheet", () => {
    let view = mount(<AppTabBar />, "/branches/5/sessions");
    const lit = view.container.querySelector(".web-tabbar__item.is-active");
    expect(lit?.getAttribute("href")).toBe("/branches");
    expect(lit?.getAttribute("aria-current")).toBe("page");
    view.unmount();

    view = mount(<AppTabBar />, "/settings");
    expect(view.container.querySelector(".web-tabbar__more")!.classList.contains("is-active")).toBe(true);
    expect(view.container.querySelector("nav.web-tabbar")!.getAttribute("style")).toContain(`--tab-index: ${PRIMARY_TABS}`);
  });

  it("carries the menu's counts: notifications in the sheet, agent updates and support on More", async () => {
    state.agentUpdate = true;
    state.supportUnread = 2;
    const { container } = mount(<AppTabBar />);
    // Notifications are the bell's: More counts the update (1) and support (2).
    expect(container.querySelector(".web-tabbar__more .web-count")!.textContent).toBe("3");
    fireEvent.click(container.querySelector(".web-tabbar__more")!);
    const sheet = await screen.findByTestId("more-sheet");
    expect(within(sheet).getByText(/Уведомления/).closest("a")!.querySelector(".web-count")!.textContent).toBe("3");
    expect(sheet.querySelector('a[href="/support"] .web-count')!.textContent).toBe("2");
    expect(state.requests).toEqual([]);
  });
});

describe("the More sheet", () => {
  it("opens from More, closes with Escape", async () => {
    const { container } = mount(<AppTabBar />);
    const more = container.querySelector(".web-tabbar__more")!;
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(await screen.findByTestId("more-sheet")).toBeTruthy();
    expect(more.getAttribute("aria-expanded")).toBe("true");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await waitFor(() => expect(screen.queryByTestId("more-sheet")).toBeNull());
  });

  it("closes on a tap on its backdrop", async () => {
    const { container } = mount(<AppTabBar />);
    fireEvent.click(container.querySelector(".web-tabbar__more")!);
    await screen.findByTestId("more-sheet");
    const backdrop = document.querySelector(".cp-modal")!;
    fireEvent.mouseDown(backdrop);
    fireEvent.mouseUp(backdrop);
    await waitFor(() => expect(screen.queryByTestId("more-sheet")).toBeNull());
  });

  it("an entry chosen in it navigates and closes it", async () => {
    const { container } = mount(<AppTabBar />);
    fireEvent.click(container.querySelector(".web-tabbar__more")!);
    const sheet = await screen.findByTestId("more-sheet");
    fireEvent.click(sheet.querySelector('a[href="/settings"]')!);
    expect(screen.getByTestId("where").textContent).toBe("/settings");
    await waitFor(() => expect(screen.queryByTestId("more-sheet")).toBeNull());
  });

  it("shows the menu's footer cards after the entries", async () => {
    const { container } = mount(<AppTabBar footerExtra={<div data-testid="cards">cards</div>} />);
    fireEvent.click(container.querySelector(".web-tabbar__more")!);
    const sheet = await screen.findByTestId("more-sheet");
    expect(sheet.parentElement!.querySelector(".web-more__cards [data-testid=cards]")).toBeTruthy();
  });
});

describe("top bar: bell and avatar", () => {
  it("the bell shows the shared unread count and opens Notifications", () => {
    state.unread = 7;
    const { container } = mount(<AppTopActions />);
    const bell = container.querySelector(".web-topbar__bell")!;
    expect(within(bell as HTMLElement).getByTestId("bell-count").textContent).toBe("7");
    expect(bell.getAttribute("aria-label")).toBe("Уведомления, 7 непрочитанных");
    fireEvent.click(bell);
    expect(screen.getByTestId("where").textContent).toBe("/notifications");
    expect(state.requests).toEqual([]);
  });

  it("no count when everything is read, and 99+ past two digits", () => {
    state.unread = 0;
    let view = mount(<AppTopActions />);
    expect(view.queryByTestId("bell-count")).toBeNull();
    view.unmount();
    state.unread = 140;
    view = mount(<AppTopActions />);
    expect(view.getByTestId("bell-count").textContent).toBe("99+");
  });

  it("the avatar shows the initials and opens the profile", () => {
    const { container } = mount(<AppTopActions />);
    const avatar = container.querySelector(".web-topbar__avatar")!;
    expect(avatar.textContent).toBe("AP");
    fireEvent.click(avatar);
    expect(screen.getByTestId("profile")).toBeTruthy();
    fireEvent.click(screen.getByText("close-profile"));
    expect(screen.queryByTestId("profile")).toBeNull();
  });

  it("falls back to a person icon without a name; initials cope with one word and Armenian", () => {
    state.user = { ...state.user, name: "  " };
    const { container } = mount(<AppTopActions />);
    expect(container.querySelector(".web-topbar__avatar-face svg")).toBeTruthy();
    expect(initialsOf("Արմեն")).toBe("ԱՐ");
    expect(initialsOf("Արմեն Պետրոսյան")).toBe("ԱՊ");
    expect(initialsOf(undefined)).toBe("");
  });
});

describe("the shell's stylesheet", () => {
  const css = readFileSync(path.resolve(__dirname, "../src/styles/web.css"), "utf8");
  const block = (selector: string, from = 0) => {
    const at = css.indexOf(`${selector} {`, from);
    return at < 0 ? "" : css.slice(at, css.indexOf("}", at));
  };

  it("on the phone frame the billing cover has no backdrop-filter and stays inside the screen; the window-wide block is untouched", () => {
    const narrow = css.indexOf("── the billing cover on a phone");
    const rule = block(".web-shell .billing-lock:not(.billing-lock--screen)", narrow);
    expect(rule).toMatch(/backdrop-filter: none;/);
    expect(rule).toMatch(/-webkit-backdrop-filter: none;/);
    expect(rule).toMatch(/inset: -16px -12px;/);
    expect(css).not.toMatch(/\.billing-lock--screen\s*\{/);
  });

  it("the bars sit below the drawer and its backdrop, and the content ends above the bottom bar", () => {
    expect(block(".web-shell--app .web-tabbar")).toMatch(/z-index: 20;/);
    expect(block(".web-shell--app .web-tabbar")).toMatch(/grid-row: 3;/);
    expect(block(".web-shell--app")).toMatch(/grid-template-rows: auto minmax\(0, 1fr\) auto;/);
    expect(css).toMatch(/env\(safe-area-inset-bottom\)\s*env\(safe-area-inset-left\)/);
  });

  it("the closed drawer's wordmark does not glow (its filter was drawn over the menu button in WebKit)", () => {
    const at = css.indexOf("The drawer when closed");
    expect(at).toBeGreaterThan(-1);
    expect(block(".web-shell:not(.is-drawer-open) .web-drawer .sidebar h1 span", at)).toMatch(/animation: none;/);
  });

  it("reduced motion stops the light strip, the tap dip and the sheet rows", () => {
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.web-tabbar__light,[^{]*\{\s*transition: none;/);
    expect(reduced).toMatch(/\.web-tabbar__item:active \.web-tabbar__icon,[^{]*\{\s*transform: none;/);
  });
});

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
  signOuts: 0,
}));
// ONE sign-out function, as AuthContext gives one to everybody: the Sidebar's
// button and the account sheet must call this very function.
const logout = vi.hoisted(() => async () => {
  state.signOuts++;
});

vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ user: state.user, logout }) }));
vi.mock("@/components/profile/AccountSwitchPanel", () => ({
  default: ({ onBack, onPick }: { onBack: () => void; onPick: (a: { id: number; name: string; email: string }) => void }) => (
    <div data-testid="switch-panel">
      <button type="button" onClick={onBack}>
        back-to-menu
      </button>
      <button type="button" onClick={() => onPick({ id: 21, name: "Manager One", email: "m1@example.test" })}>
        pick-manager
      </button>
    </div>
  ),
}));
vi.mock("@/components/profile/AccountSwitchModal", () => ({
  default: ({ target, onClose }: { target: { name: string }; onClose: () => void }) => (
    <div data-testid="switch-modal">
      {target.name}
      <button type="button" onClick={onClose}>
        cancel-switch
      </button>
    </div>
  ),
}));
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
import AccountSheet from "@web/web/appShell/AccountSheet";
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
  state.signOuts = 0;
  document.body.innerHTML = "";
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

  it("the avatar shows the initials and opens the «Аккаунт» sheet: who, then Profile", async () => {
    const { container } = mount(<AppTopActions />);
    const avatar = container.querySelector(".web-topbar__avatar")!;
    expect(avatar.textContent).toBe("AP");
    expect(avatar.getAttribute("aria-label")).toBe("Аккаунт: Armen Petrosyan");
    fireEvent.click(avatar);
    const sheet = await screen.findByTestId("account-sheet");
    const head = document.querySelector(".web-account__who")!;
    expect(head.textContent).toContain("Armen Petrosyan");
    expect(head.textContent).toContain("a@example.test");
    expect(head.textContent).toContain("Владелец");
    fireEvent.click(within(sheet).getByText("Профиль"));
    expect(screen.getByTestId("profile")).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId("account-sheet")).toBeNull());
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

describe("the «Аккаунт» sheet", () => {
  const openSheet = async () => {
    const view = mount(<AppTopActions />);
    fireEvent.click(view.container.querySelector(".web-topbar__avatar")!);
    return { view, sheet: await screen.findByTestId("account-sheet") };
  };

  it("switching accounts uses the panel's picker and password step, as the Sidebar does", async () => {
    const { sheet } = await openSheet();
    fireEvent.click(sheet.querySelector('[data-action="switch"]')!);
    expect(await screen.findByTestId("switch-panel")).toBeTruthy();
    fireEvent.click(screen.getByText("back-to-menu"));
    fireEvent.click((await screen.findByTestId("account-sheet")).querySelector('[data-action="switch"]')!);
    fireEvent.click(await screen.findByText("pick-manager"));
    expect(screen.getByTestId("switch-modal").textContent).toContain("Manager One");
    await waitFor(() => expect(screen.queryByTestId("switch-panel")).toBeNull());
  });

  it.each([
    ["company_owner", true],
    ["manager", true],
    ["admin", false],
  ])("offers the switch only where the Sidebar does (%s: %s)", async (role, offered) => {
    state.user = { ...state.user, role };
    const { sheet } = await openSheet();
    expect(sheet.querySelector('[data-action="switch"]') !== null).toBe(offered);
  });

  it("Settings is not repeated: the bar and «More» already carry it", async () => {
    const { sheet } = await openSheet();
    expect(sheet.querySelector('a[href="/settings"]')).toBeNull();
    cleanup();
    render(
      <MemoryRouter>
        <AccountSheet open onClose={() => undefined} face="AP" settingsElsewhere={false} />
      </MemoryRouter>,
    );
    expect((await screen.findByTestId("account-sheet")).querySelector('a[href="/settings"]')).not.toBeNull();
  });

  it("sign out is the very call the Sidebar's button makes", async () => {
    const side = mount(<Sidebar />);
    fireEvent.click(side.container.querySelector("button.logout")!);
    expect(state.signOuts).toBe(1);
    side.unmount();
    const { sheet } = await openSheet();
    fireEvent.click(sheet.querySelector('[data-action="sign-out"]')!);
    expect(state.signOuts).toBe(2);
  });
});

describe("nothing the drawer offers is out of reach in the installed app", () => {
  const cards = (
    <>
      <a data-testid="card-telegram" href="https://t.me/x">Telegram</a>
      <div data-testid="card-phone-app">phone app</div>
    </>
  );
  const textAction: Record<string, string> = {};

  /** Every action of the drawer: its entries, Support, the footer cards, the account menu, sign-out. */
  const drawerActions = async () => {
    const { t } = await import("@/i18n/translations");
    textAction[t("profile.title", state.lang)] = "profile";
    textAction[t("nav.settings", state.lang)] = "nav:/settings";
    textAction[t("switchAccount.cta", state.lang)] = "switch";
    const view = mount(<Sidebar footerExtra={cards} />);
    const out = new Set<string>();
    view.container.querySelectorAll(".sidebar a[href]").forEach((a) => {
      const card = a.closest("[data-testid]");
      out.add(card ? `card:${card.getAttribute("data-testid")}` : `nav:${a.getAttribute("href")}`);
    });
    view.container.querySelectorAll(".sidebar-footer [data-testid]").forEach((c) => out.add(`card:${c.getAttribute("data-testid")}`));
    fireEvent.click(view.container.querySelector(".user-card")!);
    const pop = await waitFor(() => {
      const el = document.querySelector(".user-menu-pop");
      if (!el) throw new Error("account menu not open");
      return el;
    });
    pop.querySelectorAll("button").forEach((b) => {
      const label = Object.keys(textAction).find((k) => b.textContent?.includes(k));
      out.add(label ? textAction[label] : `unknown:${b.textContent}`);
    });
    if (view.container.querySelector("button.logout")) out.add("signout");
    view.unmount();
    document.body.innerHTML = "";
    return out;
  };

  /** The installed app: the bar, «More» (with the cards), the bell, the «Аккаунт» sheet. */
  const appActions = async () => {
    const out = new Set<string>();
    const view = mount(
      <>
        <AppTopActions />
        <AppTabBar footerExtra={cards} />
      </>,
    );
    view.container.querySelectorAll("a.web-tabbar__item, a.web-topbar__bell").forEach((a) => out.add(`nav:${a.getAttribute("href")}`));
    fireEvent.click(view.container.querySelector(".web-tabbar__more")!);
    const more = (await screen.findByTestId("more-sheet")).parentElement!;
    more.querySelectorAll("a.web-more__row").forEach((a) => out.add(`nav:${a.getAttribute("href")}`));
    more.querySelectorAll(".web-more__cards [data-testid]").forEach((c) => out.add(`card:${c.getAttribute("data-testid")}`));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await waitFor(() => expect(screen.queryByTestId("more-sheet")).toBeNull());
    fireEvent.click(view.container.querySelector(".web-topbar__avatar")!);
    const account = await screen.findByTestId("account-sheet");
    account.querySelectorAll("a.web-more__row").forEach((a) => out.add(`nav:${a.getAttribute("href")}`));
    if (within(account).queryByText("Профиль") || within(account).queryByText("Profile") || within(account).queryByText("Պրոֆիլ")) out.add("profile");
    if (account.querySelector('[data-action="switch"]')) out.add("switch");
    if (account.querySelector('[data-action="sign-out"]')) out.add("signout");
    return out;
  };

  it.each([
    ["owner", () => undefined],
    ["manager", () => (state.user = { ...state.user, role: "manager", dashboard: { company_id: 3, branch_id: 9 } })],
    ["admin", () => (state.user = { ...state.user, role: "admin", dashboard: { company_id: null, branch_id: null } })],
    ["owner in Armenian with a personal arrangement", () => {
      state.lang = "am";
      state.arrangement = [{ id: "branch.sessions.5", hidden: false }, { id: "nav.revenue", hidden: true }];
    }],
  ])("%s", async (_name, setup) => {
    setup();
    const drawer = await drawerActions();
    const app = await appActions();
    // The drawer really has all of these kinds (the comparison is not vacuous).
    for (const kind of ["nav:/", "nav:/support", "card:card-telegram", "card:card-phone-app", "profile", "nav:/settings", "signout"]) {
      if (kind === "nav:/support" && state.user.role === "admin") continue;
      expect(drawer.has(kind), kind).toBe(true);
    }
    expect([...drawer].filter((a) => a.startsWith("unknown:"))).toEqual([]);
    expect([...drawer].filter((a) => !app.has(a))).toEqual([]);
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

  it("below 900px the installed app draws no drawer (the browser tab keeps it)", () => {
    expect(block(".web-shell.web-shell--app .web-drawer")).toMatch(/display: none;/);
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

/**
 * The side menu's entries, for the installed app's bottom navigation
 * (2026-11-09).
 *
 * The SAME pipeline the panel's Sidebar renders (and its Appearance screen
 * lists): the role's specs (`menuSpecsFor`, `can()` decides), the staff order
 * and labels, the label sort in the current language, then the person's own
 * arrangement. Nothing here lists an entry or a route: a screen added to the
 * panel's menu, a role rule, a hidden entry or a reordering reaches the bottom
 * bar the moment it reaches the drawer. `tests/appShell.test.tsx` renders the
 * real Sidebar beside this and compares them, per role.
 *
 * The counts are the menu's own sources, read from the contexts the Sidebar
 * reads (no second poller): notifications from `NotificationsContext`, updates
 * from `UpdatesNotificationContext`, support from `SupportUnreadContext`.
 */
import { useAuth } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { menuSpecsFor } from "@/components/Sidebar";
import { activeNavTo, applyPersonalMenu, sortedNavItems, withStaffMenu, type NavItem } from "@/components/sidebarNav";
import { useLang } from "@/i18n/LanguageContext";
import { useNotifications } from "@/notifications/NotificationsContext";
import { useUiPreferencesOptional } from "@/preferences/UiPreferencesContext";
import { useUpdatesNotification } from "@/realtime/UpdatesNotificationContext";
import { useSupportUnread } from "@/support/SupportUnreadContext";
import { useLocation } from "react-router-dom";

export interface MenuEntry extends Omit<NavItem, "badge"> {
  /** The red count the side menu shows beside this entry (0 = none). */
  count: number;
}

export interface SideMenu {
  entries: MenuEntry[];
  /** The one entry lit for the current page (the menu's own rule), or null. */
  activeTo: string | null;
  /** Support is the Sidebar's footer card, not an entry: shown when the role has it. */
  support: { shown: boolean; unread: number };
}

export const useSideMenu = (): SideMenu => {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const { pathname } = useLocation();
  const { unreadCount } = useNotifications();
  const { unread: supportUnread } = useSupportUnread();
  const { panel, agent } = useUpdatesNotification();
  const arrangement = useUiPreferencesOptional()?.layout.sidebar ?? [];

  const role = user?.role;
  const dash = user?.dashboard;
  const myBranchId = typeof dash?.branch_id === "number" ? dash.branch_id : null;
  const myCompanyId = typeof dash?.company_id === "number" ? dash.company_id : null;

  const items = applyPersonalMenu(
    sortedNavItems(withStaffMenu(menuSpecsFor(role, myBranchId, myCompanyId, {}, arrangement), role), t, lang),
    arrangement,
  );
  // The Sidebar's badges, as numbers (Sidebar.tsx: notifications; admin sees
  // panel + agent updates, owner and manager the agent's only).
  const counts: Record<string, number> = {
    "nav.notifications": unreadCount,
    "nav.updates": (panel?.has_update ? 1 : 0) + (agent?.has_update ? 1 : 0),
    "nav.agentUpdates": agent?.has_update ? 1 : 0,
  };

  return {
    entries: items.map(({ badge: _badge, ...item }) => ({ ...item, count: counts[item.id] ?? 0 })),
    activeTo: activeNavTo(items, pathname),
    support: { shown: can(role, "menu.support"), unread: supportUnread },
  };
};

/**
 * How many entries the bar holds before the rest go under «More»: three, so
 * the bar has four slots. Measured 2026-11-09 (WebKit / Chromium, the bar's
 * 10px label): Armenian «մասնաճյուղերը» is 81-84px and Russian «Бронирования»
 * 72-73px wide as one word; five slots at 360px leave 72px each and broke
 * them mid-word, four leave 90px.
 */
export const PRIMARY_TABS = 3;

/**
 * The bar's entries and the More sheet's, in the menu's order. Up to
 * `primary + 1` fit without a More (that last slot would only hold More
 * itself); past that, the first `primary` stay and the rest move to the sheet.
 */
export const splitTabs = <T>(entries: readonly T[], primary = PRIMARY_TABS): { tabs: T[]; more: T[] } =>
  entries.length <= primary + 1
    ? { tabs: [...entries], more: [] }
    : { tabs: entries.slice(0, primary), more: entries.slice(primary) };

/** Two letters for the avatar: first and last word ("Armen Petrosyan" → "AP"), else the first two. */
export const initialsOf = (name: string | undefined | null): string => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  return (Array.from(parts[0])[0] + Array.from(parts[parts.length - 1])[0]).toUpperCase();
};

/** "99+" past two digits, like the menu's badge. */
export const countLabel = (count: number): string => (count > 99 ? "99+" : String(count));

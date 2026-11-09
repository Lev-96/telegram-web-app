/**
 * The installed app's bottom navigation (2026-11-09).
 *
 * The side menu's entries (`useSideMenu`, the Sidebar's own pipeline: role,
 * staff order, language, the person's arrangement) in the menu's order: the
 * first three on the bar, the rest in a «More» sheet with Support and the
 * menu's footer cards (Telegram, the phone-notifications switch). One entry is
 * lit, by the menu's own rule (`activeNavTo`); a page under an entry in the
 * sheet lights «More».
 *
 * Motion: a light strip on the bar's top edge glides to the lit entry
 * (transform only), the icon dips under the finger, the sheet is the panel's
 * Modal sliding up (`.web-sheet`). Reduced motion: none of it moves.
 */
import NavIcon from "@/components/ui/NavIcon";
import SupportIcon from "@/components/ui/SupportIcon";
import { iconIdOf } from "@/components/sidebarNav";
import { useLang } from "@/i18n/LanguageContext";
import WebSheet from "@web/web/WebSheet";
import { useWebText } from "@web/web/i18n";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { countLabel, splitTabs, useSideMenu } from "./sideMenu";

const MoreIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
  </svg>
);

const Count = ({ value }: { value: number }) =>
  value > 0 ? (
    <span className="web-count" aria-hidden="true">
      {countLabel(value)}
    </span>
  ) : null;

interface Props {
  /** The side menu's footer cards (Telegram, phone app), shown at the end of the sheet. */
  footerExtra?: ReactNode;
}

const AppTabBar = ({ footerExtra }: Props) => {
  const menu = useSideMenu();
  const tw = useWebText();
  const { t } = useLang();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { tabs, more } = splitTabs(menu.entries);

  // A chosen entry has done the sheet's job.
  useEffect(() => setMoreOpen(false), [pathname]);

  const slots = tabs.length + (more.length > 0 ? 1 : 0);
  const tabIndex = tabs.findIndex((e) => e.to === menu.activeTo);
  const inMore = tabIndex < 0 && (more.some((e) => e.to === menu.activeTo) || pathname === "/support");
  const lit = tabIndex >= 0 ? tabIndex : inMore ? tabs.length : -1;
  // What waits under «More». Notifications are left out: the bell beside the
  // avatar already carries that count, on every screen.
  const moreCount =
    more.reduce((sum, e) => sum + (e.id === "nav.notifications" ? 0 : e.count), 0) + (menu.support.shown ? menu.support.unread : 0);
  const unread = (n: number) => (n > 0 ? `, ${tw("web.shell.unread", n)}` : "");

  return (
    <>
      <nav
        className="web-tabbar"
        aria-label={tw("web.shell.sections")}
        style={{ "--tab-count": slots, "--tab-index": Math.max(lit, 0) } as CSSProperties}
      >
        <span className={`web-tabbar__light${lit < 0 ? " is-off" : ""}`} aria-hidden="true" />
        {tabs.map((entry) => {
          const active = entry.to === menu.activeTo;
          return (
            <Link
              key={entry.to}
              to={entry.to}
              className={`web-tabbar__item${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-label={`${entry.label}${unread(entry.count)}`}
            >
              <span className="web-tabbar__icon">
                <NavIcon id={iconIdOf(entry.id)} size={22} />
                <Count value={entry.count} />
              </span>
              <span className="web-tabbar__label" aria-hidden="true">{entry.label}</span>
            </Link>
          );
        })}
        {more.length > 0 && (
          <button
            type="button"
            className={`web-tabbar__item web-tabbar__more${inMore ? " is-active" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-label={`${tw("web.shell.more")}${unread(moreCount)}`}
            onClick={() => setMoreOpen(true)}
          >
            <span className="web-tabbar__icon">
              <MoreIcon />
              <Count value={moreCount} />
            </span>
            <span className="web-tabbar__label" aria-hidden="true">{tw("web.shell.more")}</span>
          </button>
        )}
      </nav>

      <WebSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={tw("web.shell.more")}>
        <ul className="web-more" data-testid="more-sheet">
          {more.map((entry) => {
            const active = entry.to === menu.activeTo;
            return (
              <li key={entry.to}>
                <Link
                  to={entry.to}
                  className={`web-more__row${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMoreOpen(false)}
                >
                  <NavIcon id={iconIdOf(entry.id)} size={20} />
                  <span className="web-more__label">{entry.label}</span>
                  <Count value={entry.count} />
                </Link>
              </li>
            );
          })}
          {menu.support.shown && (
            <li>
              <NavLink to="/support" className={({ isActive }) => `web-more__row${isActive ? " is-active" : ""}`} onClick={() => setMoreOpen(false)}>
                <SupportIcon size={20} />
                <span className="web-more__label">{t("nav.support")}</span>
                <Count value={menu.support.unread} />
              </NavLink>
            </li>
          )}
        </ul>
        {footerExtra && <div className="web-more__cards">{footerExtra}</div>}
      </WebSheet>
    </>
  );
};

export default AppTabBar;

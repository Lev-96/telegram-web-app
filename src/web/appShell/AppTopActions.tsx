/**
 * The installed app's top-bar actions (2026-11-09), between the logo and the
 * menu button: the notifications bell with the menu's own unread count
 * (NotificationsContext, the source of the side menu's badge; no second
 * poller) and the person's avatar, which opens the «Аккаунт» sheet (profile,
 * switch account, sign out: the drawer's account card, AccountSheet.tsx).
 *
 * The account has no photo field (`AuthUser` is id / email / name / role), so
 * the avatar is the person's initials; a person icon when the name is empty.
 */
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { useNotifications } from "@/notifications/NotificationsContext";
import { useWebText } from "@web/web/i18n";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AccountSheet from "./AccountSheet";
import { countLabel, initialsOf, useSideMenu } from "./sideMenu";

const BellIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const AppTopActions = () => {
  const { user } = useAuth();
  const { unreadCount: unread } = useNotifications();
  const { t } = useLang();
  const tw = useWebText();
  const { pathname } = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const settingsElsewhere = useSideMenu().entries.some((e) => e.to === "/settings");
  const initials = initialsOf(user?.name);
  const face = initials || <PersonIcon />;
  const bellLabel = unread > 0 ? `${t("nav.notifications")}, ${tw("web.shell.unread", unread)}` : t("nav.notifications");
  const onNotifications = pathname === "/notifications";

  return (
    <div className="web-topbar__actions">
      <Link
        to="/notifications"
        className={`web-topbar__icon web-topbar__bell${onNotifications ? " is-active" : ""}`}
        aria-label={bellLabel}
        aria-current={onNotifications ? "page" : undefined}
      >
        <BellIcon />
        {unread > 0 && (
          <span className="web-count" data-testid="bell-count" aria-hidden="true">
            {countLabel(unread)}
          </span>
        )}
      </Link>
      <button
        type="button"
        className="web-topbar__icon web-topbar__avatar"
        aria-label={user?.name ? `${tw("web.shell.account")}: ${user.name}` : tw("web.shell.account")}
        aria-haspopup="dialog"
        aria-expanded={accountOpen}
        onClick={() => setAccountOpen(true)}
      >
        <span className="web-topbar__avatar-face" aria-hidden="true">
          {face}
        </span>
      </button>
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} face={face} settingsElsewhere={settingsElsewhere} />
    </div>
  );
};

export default AppTopActions;

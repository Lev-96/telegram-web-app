/**
 * The installed app's «Аккаунт» sheet (2026-11-09), opened by the avatar. The
 * installed app has no drawer, so this is where the drawer's account card
 * lives: what the panel Sidebar's account menu offers (`UserMenu`), with the
 * panel's own components, and its sign-out button.
 *
 *  - Profile: the panel's `ProfileModal`.
 *  - Switch account: only where the Sidebar offers it (an owner or a manager),
 *    with the panel's `AccountSwitchPanel` (pick) and `AccountSwitchModal`
 *    (password), exactly as `UserMenu` wires them. Who is offered is the
 *    server's answer.
 *  - Settings: only when the bar and «More» do not already carry it (it is a
 *    required menu entry, so normally they do).
 *  - Sign out: `useAuth().logout()`, the Sidebar button's own call. Through
 *    the `@/api/auth` override it drops this phone's push subscription
 *    (`forgetPushOnSignOut`) before the session ends: nothing extra here.
 */
import type { IAccountSwitchTarget } from "@/api/accountSwitch";
import { useAuth } from "@/auth/AuthContext";
import NavIcon from "@/components/ui/NavIcon";
import AccountSwitchModal from "@/components/profile/AccountSwitchModal";
import AccountSwitchPanel from "@/components/profile/AccountSwitchPanel";
import ProfileModal from "@/components/profile/ProfileModal";
import { useLang } from "@/i18n/LanguageContext";
import WebSheet from "@web/web/WebSheet";
import { useWebText } from "@web/web/i18n";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

type View = "menu" | "switch";

/** The Sidebar's rule (UserMenu `canSwitchAccount`): both company roles hand the device over. */
export const canSwitchAccount = (role: string | undefined): boolean => role === "company_owner" || role === "manager";

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const SwitchIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m16 3 4 4-4 4" />
    <path d="M20 7H4" />
    <path d="m8 21-4-4 4-4" />
    <path d="M4 17h16" />
  </svg>
);

interface Props {
  open: boolean;
  onClose: () => void;
  /** The avatar's face, drawn again at the head of the sheet. */
  face: ReactNode;
  /** Whether the bar or «More» already holds Settings. */
  settingsElsewhere: boolean;
}

const AccountSheet = ({ open, onClose, face, settingsElsewhere }: Props) => {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const tw = useWebText();
  const [view, setView] = useState<View>("menu");
  const [profileOpen, setProfileOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<IAccountSwitchTarget | null>(null);
  const role = user?.role;
  const close = () => {
    setView("menu");
    onClose();
  };

  return (
    <>
      <WebSheet open={open} onClose={close} title={tw("web.shell.account")} view={view} confirmOnDirty={false}>
        {view === "menu" ? (
          <>
            <div className="web-account__who">
              <span className="web-account__face" aria-hidden="true">{face}</span>
              <span className="web-account__text">
                <span className="web-account__name">{user?.name || "-"}</span>
                {user?.email && <span className="web-account__email">{user.email}</span>}
                {role && <span className="web-account__role">{t(`role.${role}`) || role}</span>}
              </span>
            </div>
            <ul className="web-more" data-testid="account-sheet">
              <li>
                <button
                  type="button"
                  className="web-more__row"
                  data-autofocus
                  onClick={() => {
                    close();
                    setProfileOpen(true);
                  }}
                >
                  <PersonIcon />
                  <span className="web-more__label">{t("profile.title")}</span>
                </button>
              </li>
              {canSwitchAccount(role) && (
                <li>
                  <button type="button" className="web-more__row" data-action="switch" onClick={() => setView("switch")}>
                    <SwitchIcon />
                    <span className="web-more__label">{t("switchAccount.cta")}</span>
                    <span className="web-more__chevron" aria-hidden="true">›</span>
                  </button>
                </li>
              )}
              {!settingsElsewhere && (
                <li>
                  <Link to="/settings" className="web-more__row" onClick={close}>
                    <NavIcon id="nav.settings" size={20} />
                    <span className="web-more__label">{t("nav.settings")}</span>
                  </Link>
                </li>
              )}
              <li>
                <button type="button" className="web-more__row web-more__row--danger" data-action="sign-out" onClick={() => void logout()}>
                  <NavIcon id="nav.signOut" size={20} />
                  <span className="web-more__label">{t("nav.signOut")}</span>
                </button>
              </li>
            </ul>
          </>
        ) : (
          <div className="user-menu-view web-account__switch">
            <AccountSwitchPanel
              onBack={() => setView("menu")}
              onPick={(account) => {
                setSwitchTarget(account);
                close();
              }}
            />
          </div>
        )}
      </WebSheet>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
      {switchTarget && (
        <AccountSwitchModal target={switchTarget} onClose={() => setSwitchTarget(null)} onSwitched={() => setSwitchTarget(null)} />
      )}
    </>
  );
};

export default AccountSheet;

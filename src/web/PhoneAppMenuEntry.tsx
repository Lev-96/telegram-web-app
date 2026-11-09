/**
 * The installable app in the side menu (2026-11-09), next to the Telegram card
 * and dressed like it (Support's card styles, the Sidebar's `footerExtra`).
 *
 *   Telegram Mini App  no install; says notices come from the bot
 *   browser, Chrome    «Install the app» shows Chrome's own install dialog
 *   browser, iOS       no such dialog exists: the steps (Share → Add to Home
 *                      Screen); iOS web push works only for the installed app
 *   browser, other     nothing
 *   installed app      the phone-notifications switch (hidden when the server
 *                      has no web push), or why it cannot be on
 */
import { useAuth } from "@/auth/AuthContext";
import NavIcon from "@/components/ui/NavIcon";
import { notify } from "@/ui/notify";
import { useWebText, type WebTextKey } from "@web/web/i18n";
import { useId, useState, type ReactNode } from "react";
import { isIos, isStandalone, isTelegramMiniApp } from "./pwa/environment";
import { promptInstall, useInstallOffer } from "./pwa/installPrompt";
import { usePhoneNotifications } from "./pwa/usePhoneNotifications";

/** A phone (Lucide "smartphone"), in the current text colour. */
const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M12 18h.01" />
  </svg>
);

const BellIcon = () => <NavIcon id="nav.notifications" size={18} />;

const CardText = ({ title, hint }: { title: string; hint: string }) => (
  <span className="nav-support-card__text">
    <span className="nav-support-card__title">{title}</span>
    <span className="nav-support-card__hint">{hint}</span>
  </span>
);

const InfoCard = ({ icon, title, hint, children }: { icon: ReactNode; title: string; hint: string; children?: ReactNode }) => (
  <div className="nav-support-card web-menu-card is-static">
    <span className="nav-support-card__icon">{icon}</span>
    <CardText title={title} hint={hint} />
    {children}
  </div>
);

const ActionCard = ({ icon, title, hint, onClick, busy, ...aria }: {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  busy?: boolean;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
}) => (
  <button type="button" className="nav-support-card web-menu-card" onClick={onClick} disabled={busy} aria-busy={busy || undefined} {...aria}>
    <span className="nav-support-card__icon">{icon}</span>
    <CardText title={title} hint={hint} />
  </button>
);

/** iOS: the steps, folded under the card until tapped. */
const IosSteps = () => {
  const tw = useWebText();
  const [open, setOpen] = useState(false);
  const stepsId = useId();
  return (
    <div className="web-menu-card-group">
      <ActionCard
        icon={<PhoneIcon />}
        title={tw("web.app.install")}
        hint={tw("web.app.iosHint")}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={stepsId}
      />
      {open && (
        <p id={stepsId} className="web-menu-card__help">
          {tw("web.app.iosSteps")}
        </p>
      )}
    </div>
  );
};

/** The installed app's switch. */
const NotificationsSwitch = () => {
  const tw = useWebText();
  const { user } = useAuth();
  const { state, enable, disable } = usePhoneNotifications(user?.id ?? null, (action) =>
    notify.message("error", tw(action === "enable" ? "web.app.enableFailed" : "web.app.disableFailed")),
  );
  const title = tw("web.app.notifications");
  const info = (hint: WebTextKey) => <InfoCard icon={<BellIcon />} title={title} hint={tw(hint)} />;

  switch (state.kind) {
    case "hidden":
      return null;
    case "unsupported":
      return info("web.app.unsupported");
    case "blocked":
      return info("web.app.blocked");
    case "off":
      return <ActionCard icon={<BellIcon />} title={tw("web.app.enable")} hint={tw("web.app.enableHint")} onClick={enable} busy={state.busy} />;
    case "on":
      return (
        <InfoCard icon={<BellIcon />} title={title} hint={tw("web.app.on")}>
          <button type="button" className="web-menu-card__action" onClick={disable} disabled={state.busy} aria-busy={state.busy || undefined}>
            {tw("web.app.off")}
          </button>
        </InfoCard>
      );
  }
};

const PhoneAppMenuEntry = () => {
  const tw = useWebText();
  const offer = useInstallOffer();
  // Where the page runs does not change while it is open.
  const [where] = useState(() => (isTelegramMiniApp() ? "telegram" : isStandalone() ? "installed" : isIos() ? "ios" : "browser"));

  if (where === "telegram") return <InfoCard icon={<BellIcon />} title={tw("web.app.notifications")} hint={tw("web.app.telegram")} />;
  if (where === "installed") return <NotificationsSwitch />;
  if (where === "ios") return <IosSteps />;
  if (!offer) return null;
  return <ActionCard icon={<PhoneIcon />} title={tw("web.app.install")} hint={tw("web.app.installHint")} onClick={() => void promptInstall()} />;
};

export default PhoneAppMenuEntry;

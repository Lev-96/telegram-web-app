/**
 * «Install the app» at the bottom of the screen, in a browser tab (2026-11-09).
 *
 * On a phone the menu — where the install card lives — is an off-canvas drawer
 * the person may never open, and phone notifications exist only in the
 * installed app. So a signed-in owner in a browser gets one compact banner:
 *
 *   iOS            «Как установить» opens the same four steps as the menu card
 *   Chrome         «Установить» shows Chrome's install dialog, while Chrome
 *                  holds an offer (beforeinstallprompt)
 *   installed app, Telegram, any other browser   nothing
 *
 * Closing it or using it is remembered for this browser session
 * (sessionStorage, per account: `u{id}:`), so it does not come back on every
 * page load; the menu card stays. Hidden from 900px (web.css), where the menu
 * is always on screen.
 */
import { useAuth } from "@/auth/AuthContext";
import Button from "@/components/ui/Button";
import { useWebText } from "@web/web/i18n";
import { useState } from "react";
import IosInstallSteps from "./IosInstallSteps";
import { isIos, isStandalone, isTelegramMiniApp } from "./pwa/environment";
import { promptInstall, useInstallOffer } from "./pwa/installPrompt";
import { PhoneIcon } from "./pwaIcons";
import WebSheet from "./WebSheet";

export const installBannerKey = (userId: number) => `u${userId}:cp.web.installBanner.closed`;

const wasClosed = (key: string): boolean => {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

const remember = (key: string) => {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // Private mode without storage: it simply shows again on the next load.
  }
};

/** Mount with `key={user id}`: an account change starts it afresh. */
const InstallBanner = () => {
  const tw = useWebText();
  const { user } = useAuth();
  const offer = useInstallOffer();
  // Where the page runs does not change while it is open.
  const [where] = useState(() => (isTelegramMiniApp() || isStandalone() ? null : isIos() ? "ios" : "browser"));
  const storageKey = user ? installBannerKey(user.id) : null;
  const [closed, setClosed] = useState(() => storageKey === null || wasClosed(storageKey));
  const [guide, setGuide] = useState(false);

  const done = () => {
    if (storageKey) remember(storageKey);
    setClosed(true);
  };
  const act = () => {
    done();
    if (where === "ios") setGuide(true);
    // Inside the tap: Chrome shows its dialog only from a gesture.
    else void promptInstall();
  };

  const shown = !closed && (where === "ios" || (where === "browser" && offer));

  return (
    <>
      {shown && (
        <div className="web-install-banner" role="region" aria-label={tw("web.app.install")}>
          <span className="web-install-banner__icon">
            <PhoneIcon />
          </span>
          <span className="web-install-banner__text">{tw(where === "ios" ? "web.banner.ios" : "web.banner.browser")}</span>
          <button type="button" className="web-install-banner__action" onClick={act}>
            {tw(where === "ios" ? "web.banner.how" : "web.banner.install")}
          </button>
          <button type="button" className="web-install-banner__close" aria-label={tw("web.close")} onClick={done}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
      {where === "ios" && (
        <WebSheet open={guide} onClose={() => setGuide(false)} title={tw("web.app.iosTitle")}>
          <IosInstallSteps />
          <div className="web-sheet__actions">
            <Button type="button" data-autofocus onClick={() => setGuide(false)}>
              {tw("web.close")}
            </Button>
          </div>
        </WebSheet>
      )}
    </>
  );
};

export default InstallBanner;

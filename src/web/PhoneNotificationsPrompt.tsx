/**
 * First launch of the installed app (2026-11-09): «Включите уведомления».
 *
 * iOS and Chrome ask for the notification permission only from a tap, so one
 * tap is unavoidable; this sheet makes it the most obvious thing on screen
 * instead of a card in the off-canvas menu. It opens when the shared state
 * (PhoneNotificationsProvider: installed app, outside Telegram, push support,
 * signed in, the server has a key) reads "off" and the browser has not been
 * asked yet (`Notification.permission === "default"`).
 *
 *   «Разрешить уведомления»  enable() straight from the tap; granted and
 *                            subscribed → the sheet closes, a short toast
 *   «Позже» / × / Escape     hidden for this app session (memory only), so it
 *                            asks again on the next launch while still "default"
 *   denied                   the sheet says how to allow them again; once
 *                            closed it never nags (the permission is no longer
 *                            "default"), the menu card keeps the blocked note
 */
import Button from "@/components/ui/Button";
import { notify } from "@/ui/notify";
import { useWebText } from "@web/web/i18n";
import { useState } from "react";
import { isIos } from "./pwa/environment";
import { usePhoneNotificationsState } from "./pwa/PhoneNotificationsContext";
import WebSheet from "./WebSheet";

const notAskedYet = () => typeof Notification !== "undefined" && Notification.permission === "default";

const PhoneNotificationsPrompt = () => {
  const tw = useWebText();
  const { state, enable } = usePhoneNotificationsState();
  // Memory only: «Later» lasts until the app is opened again.
  const [closed, setClosed] = useState(false);
  // The tap is being carried out; the sheet stays while it is.
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);

  const offered = state.kind === "off" && !state.busy && notAskedYet();
  const open = !closed && (denied || asking || offered);

  const allow = () => {
    setAsking(true);
    // No await before this call: enable() asks for the permission first, inside the tap.
    void enable().then((outcome) => {
      setAsking(false);
      if (outcome === "granted") notify.message("success", tw("web.push.enabled"));
      else if (outcome === "denied") setDenied(true);
    });
  };
  const close = () => setClosed(true);

  if (denied) {
    return (
      <WebSheet open={open} onClose={close} title={tw("web.push.deniedTitle")} view="denied">
        <p className="web-sheet__text">{tw(isIos() ? "web.push.deniedIos" : "web.app.blocked")}</p>
        <div className="web-sheet__actions">
          <Button type="button" data-autofocus onClick={close}>
            {tw("web.close")}
          </Button>
        </div>
      </WebSheet>
    );
  }

  return (
    <WebSheet open={open} onClose={close} title={tw("web.push.title")} view="ask">
      <p className="web-sheet__text">{tw("web.push.body")}</p>
      <div className="web-sheet__actions">
        <Button type="button" data-autofocus onClick={allow} disabled={asking} aria-busy={asking || undefined}>
          {tw("web.push.allow")}
        </Button>
        <Button type="button" variant="secondary" onClick={close} disabled={asking}>
          {tw("web.push.later")}
        </Button>
      </div>
    </WebSheet>
  );
};

export default PhoneNotificationsPrompt;

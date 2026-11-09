/**
 * The installed app's phone notifications, ONE per app (2026-11-09).
 *
 * Mounted once by the Layout override, around the whole shell and outside the
 * Sidebar, so it runs while the menu is closed (on a phone the menu is an
 * off-canvas drawer the person may never open). The menu card and the
 * first-launch prompt read the same state and the same enable/disable: one
 * public-key read and one silent sync per sign-in, never one per consumer.
 *
 * Only the installed app (home screen), never a browser tab or Telegram: there
 * the state stays "hidden" and nothing is asked of the server.
 */
import { useAuth } from "@/auth/AuthContext";
import { notify } from "@/ui/notify";
import { useWebText } from "@web/web/i18n";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { isInstalledApp } from "./environment";
import { usePhoneNotifications, type EnableOutcome, type PhoneNotifications } from "./usePhoneNotifications";

export interface PhoneNotificationsApi {
  state: PhoneNotifications;
  /** Call straight from the tap (the permission question needs the gesture). */
  enable: () => Promise<EnableOutcome>;
  disable: () => void;
}

const Ctx = createContext<PhoneNotificationsApi | null>(null);

export const PhoneNotificationsProvider = ({ children }: { children: ReactNode }) => {
  const tw = useWebText();
  const { user } = useAuth();
  // Where the page runs does not change while it is open.
  const [installed] = useState(isInstalledApp);
  const { state, enable, disable } = usePhoneNotifications(installed ? (user?.id ?? null) : null, (action) =>
    notify.message("error", tw(action === "enable" ? "web.app.enableFailed" : "web.app.disableFailed")),
  );
  const value = useMemo(() => ({ state, enable, disable }), [state, enable, disable]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

/** The shared phone-notifications state. Only inside PhoneNotificationsProvider. */
export const usePhoneNotificationsState = (): PhoneNotificationsApi => {
  const value = useContext(Ctx);
  if (!value) throw new Error("usePhoneNotificationsState() outside PhoneNotificationsProvider");
  return value;
};

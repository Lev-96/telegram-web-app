/**
 * The phone-notifications switch of the installed owner web (2026-11-09).
 *
 * hidden       the server has no web push (key null / 404), or still asking it
 * unsupported  this browser has no Push API
 * blocked      the person (or the system) refused notifications to this site
 * off / on     the switch, with `busy` while a tap is being carried out
 *
 * On load, a phone that already allowed notifications re-sends its
 * subscription quietly, or subscribes again when it has none (syncPush).
 * Again when the signed-in account changes, so the server files the phone
 * under whoever uses it now.
 *
 * ONE instance per app (2026-11-09): PhoneNotificationsProvider runs it in the
 * Layout, outside the menu, and the menu card and the first-launch prompt both
 * read it from there. Never call it from a component of its own.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { pushSupported } from "./environment";
import { disablePush, enablePush, fetchPublicKey, syncPush } from "./webPush";

export type PhoneNotifications =
  | { kind: "hidden" }
  | { kind: "unsupported" }
  | { kind: "blocked" }
  | { kind: "off" | "on"; busy: boolean };

const HIDDEN: PhoneNotifications = { kind: "hidden" };

/** How a tap on «turn on» ended: the permission's answer, or "failed" (the hook has already said so). */
export type EnableOutcome = NotificationPermission | "failed";

/** Run ONLY by PhoneNotificationsProvider (installed app, outside Telegram). */
export const usePhoneNotifications = (
  userId: number | null,
  onError: (action: "enable" | "disable") => void,
) => {
  const [state, setState] = useState<PhoneNotifications>(HIDDEN);
  const key = useRef<string | null>(null);
  // The latest callback (it says the error in the current language).
  const reportError = useRef(onError);
  useEffect(() => {
    reportError.current = onError;
  });

  useEffect(() => {
    key.current = null;
    if (userId === null) {
      setState(HIDDEN);
      return;
    }
    if (!pushSupported()) {
      setState({ kind: "unsupported" });
      return;
    }
    let live = true;
    void (async () => {
      try {
        const publicKey = await fetchPublicKey();
        if (!live) return;
        if (!publicKey) return setState(HIDDEN);
        key.current = publicKey;
        if (Notification.permission === "denied") return setState({ kind: "blocked" });
        const now = await syncPush(publicKey);
        if (live) setState({ kind: now, busy: false });
      } catch {
        // The server could not be asked: nothing to offer until the next load.
        if (live) setState(HIDDEN);
      }
    })();
    return () => {
      live = false;
    };
  }, [userId]);

  /**
   * Must be called straight from the tap: the permission question needs the
   * gesture, and it is the first thing enablePush awaits.
   */
  const enable = useCallback((): Promise<EnableOutcome> => {
    const publicKey = key.current;
    if (!publicKey) return Promise.resolve("failed");
    setState({ kind: "off", busy: true });
    return enablePush(publicKey).then(
      (permission) => {
        setState(permission === "granted" ? { kind: "on", busy: false } : permission === "denied" ? { kind: "blocked" } : { kind: "off", busy: false });
        return permission;
      },
      () => {
        setState({ kind: "off", busy: false });
        reportError.current("enable");
        return "failed" as const;
      },
    );
  }, []);

  const disable = useCallback(() => {
    setState({ kind: "on", busy: true });
    disablePush().then(
      () => setState({ kind: "off", busy: false }),
      () => {
        setState({ kind: "on", busy: false });
        reportError.current("disable");
      },
    );
  }, []);

  return { state, enable, disable };
};

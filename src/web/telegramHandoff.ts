/**
 * The owner web's one-tap "Telegram" (2026-09-29): a direct Mini App link with
 * a one-time handoff code, which opens the app in Telegram already signed in
 * as this owner (backend TelegramLinkService). No code is ever shown.
 *
 * Why it is prepared BEFORE the tap: a phone opens the Telegram app straight
 * from a link only when the tap itself follows a real link. A link fetched
 * after the tap (an await in between) reaches the browser without that
 * gesture, and the phone shows the t.me web page with one more button to
 * press instead. So the link is fetched as soon as the entry can be seen, and
 * renewed a little before the server lets it expire; the tap then follows it
 * natively.
 */
import { request } from "@/api/client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface TelegramHandoff {
  url: string;
  expires_at: string;
}

export const fetchTelegramHandoff = () =>
  request<TelegramHandoff>("/client-access/telegram/open", { method: "POST", noCache: true });

/** Renewed this long before the server's expiry, so a tap never follows a dead link. */
export const RENEW_BEFORE_MS = 30_000;

const msLeft = (handoff: TelegramHandoff, now: number) => Date.parse(handoff.expires_at) - now;

export const isFresh = (handoff: TelegramHandoff | null, now: number = Date.now()): handoff is TelegramHandoff =>
  handoff !== null && msLeft(handoff, now) > RENEW_BEFORE_MS;

/**
 * A fresh handoff link while `active` (the entry can be seen), renewed before
 * it expires. `open()` is the fallback for a tap that came before the link
 * was ready: it opens a tab at once, inside the tap, and sends it to the link
 * when it arrives.
 */
export const useTelegramHandoff = (active: boolean) => {
  const [handoff, setHandoff] = useState<TelegramHandoff | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const prepare = useCallback(async () => {
    const next = await fetchTelegramHandoff();
    if (alive.current) setHandoff(next);
    return next;
  }, []);

  useEffect(() => {
    if (!active) return;
    if (!isFresh(handoff)) {
      prepare().catch(() => {
        /* the tap falls back to open(), which reports a failure itself */
      });
      return;
    }
    const timer = window.setTimeout(() => setHandoff(null), msLeft(handoff, Date.now()) - RENEW_BEFORE_MS);
    return () => window.clearTimeout(timer);
  }, [active, handoff, prepare]);

  const open = useCallback(async () => {
    // Opened now, inside the tap, so no popup blocker stops it.
    const tab = window.open("", "_blank");
    try {
      const { url } = await prepare();
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (error) {
      tab?.close();
      throw error;
    }
  }, [prepare]);

  return { url: isFresh(handoff) ? handoff.url : null, open };
};

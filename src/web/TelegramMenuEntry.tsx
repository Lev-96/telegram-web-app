/**
 * "Telegram" in the side menu (2026-09-29): one tap opens the Mini App in
 * Telegram, already signed in as this owner — no dialog, no code, no START.
 *
 * It is a real link to the prepared one-time handoff (see telegramHandoff.ts),
 * fetched while the entry can actually be seen (the drawer is open, or the
 * sidebar is on screen) and the page is in front; a hidden entry asks the
 * server for nothing. Drawn with Support's own card styles and handed to the
 * panel's Sidebar through its `footerExtra` slot, so the menu stays the
 * panel's.
 */
import { notify } from "@/ui/notify";
import { useWebText } from "@web/web/i18n";
import { MouseEvent, RefObject, useEffect, useRef, useState } from "react";
import { useTelegramHandoff } from "./telegramHandoff";

interface Props {
  /** Called on the tap, e.g. to close the drawer. */
  onNavigate?: () => void;
}

/** Telegram's paper plane, drawn in the current text colour. */
const PlaneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M21.5 4.5 2.9 11.7c-.8.3-.8 1.4 0 1.7l4.6 1.6 1.8 5.5c.2.7 1.1.9 1.6.4l2.6-2.5 4.6 3.4c.6.4 1.4.1 1.6-.6l3.1-15.1c.2-.9-.6-1.6-1.3-1.3Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="m7.6 15 9.9-7.3-7.6 8.7" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/** On screen and in a tab the person is looking at. Without IntersectionObserver: assumed seen. */
export const useSeen = (ref: RefObject<Element | null>): boolean => {
  const [onScreen, setOnScreen] = useState(typeof IntersectionObserver === "undefined");
  const [pageShown, setPageShown] = useState(() => document.visibilityState !== "hidden");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(() => {
    const onChange = () => setPageShown(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return onScreen && pageShown;
};

const TelegramMenuEntry = ({ onNavigate }: Props) => {
  const tw = useWebText();
  const ref = useRef<HTMLAnchorElement>(null);
  const { url, open } = useTelegramHandoff(useSeen(ref));

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!url) {
      // Tapped before the link was ready: get it now, in a tab opened by the tap.
      event.preventDefault();
      open().catch(() => notify.message("error", tw("web.telegram.failed")));
    }
    onNavigate?.();
  };

  return (
    <a
      ref={ref}
      className="nav-support-card web-telegram-entry"
      href={url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      aria-busy={url ? undefined : true}
    >
      <span className="nav-support-card__icon">
        <PlaneIcon />
      </span>
      <span className="nav-support-card__text">
        <span className="nav-support-card__title">{tw("web.telegram.title")}</span>
        <span className="nav-support-card__hint">{tw("web.telegram.hint")}</span>
      </span>
    </a>
  );
};

export default TelegramMenuEntry;

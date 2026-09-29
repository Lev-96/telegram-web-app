/**
 * "Telegram" in the side menu (2026-09-29), in place of the top bar's corner
 * button: one card under Support, drawn with Support's own card styles, that
 * opens the owner's Telegram access dialog. Handed to the panel's Sidebar
 * through its `footerExtra` slot, so the menu stays the panel's.
 */
import { useWebText } from "@web/web/i18n";

interface Props {
  onOpen: () => void;
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

const TelegramMenuEntry = ({ onOpen }: Props) => {
  const tw = useWebText();

  return (
    <button type="button" className="nav-support-card web-telegram-entry" onClick={onOpen}>
      <span className="nav-support-card__icon">
        <PlaneIcon />
      </span>
      <span className="nav-support-card__text">
        <span className="nav-support-card__title">{tw("web.telegram.title")}</span>
        <span className="nav-support-card__hint">{tw("web.telegram.hint")}</span>
      </span>
    </button>
  );
};

export default TelegramMenuEntry;

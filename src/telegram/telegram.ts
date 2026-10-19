/**
 * The thin Telegram layer (2026-09-28). The app is the same owner panel in a
 * browser and in Telegram; this file is everything that differs in Telegram:
 * reading the launch, telling Telegram the app is ready, matching its chrome to
 * the panel's colours, and trading the signed launch data for a session.
 *
 * Nothing here decides who the user is. The launch data goes to the backend
 * untouched, and the backend checks Telegram's signature before it believes
 * a word of it.
 */

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { start_param?: string; user?: { language_code?: string } };
  version?: string;
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  disableVerticalSwipes?(): void;
  isVersionAtLeast?(version: string): boolean;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** The panel's background (`--color-bg` in its global.css). */
const PANEL_BG = "#020514";

const LINK_PREFIX = "link_";

export interface TelegramLaunch {
  initData: string;
  /** The one-time link code, when the Mini App was opened from a link. */
  linkParam: string | null;
  webApp: TelegramWebApp;
}

/**
 * The launch, if this page was opened inside Telegram; null in a browser.
 * Must run before the router mounts: Telegram hands its data over in the URL
 * hash, and the panel's HashRouter would otherwise read it as a route.
 */
export const readTelegramLaunch = (): TelegramLaunch | null => {
  const webApp = window.Telegram?.WebApp;
  const initData = webApp?.initData ?? "";
  if (!webApp || initData === "") return null;

  const start = webApp.initDataUnsafe?.start_param ?? "";
  const launch: TelegramLaunch = {
    initData,
    linkParam: start.startsWith(LINK_PREFIX) ? start : null,
    webApp,
  };

  if (window.location.hash.includes("tgWebApp")) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  return launch;
};

/** Tell Telegram the app has loaded, and make its frame the panel's colour. */
export const prepareTelegramChrome = (webApp: TelegramWebApp): void => {
  document.documentElement.dataset.shell = "telegram";
  webApp.ready();
  webApp.expand();
  try {
    webApp.setHeaderColor?.(PANEL_BG);
    webApp.setBackgroundColor?.(PANEL_BG);
    // A long list scrolled to its top must scroll, not close the app.
    if (webApp.isVersionAtLeast?.("7.7")) webApp.disableVerticalSwipes?.();
  } catch {
    /* an older Telegram without these: cosmetic only */
  }
};

/** The refusal code the backend sent (see ClientAccessException), if any. */
export const errorCode = (error: unknown): string | null => {
  const body = (error as { body?: unknown } | null)?.body;
  const code = typeof body === "object" && body !== null ? (body as { code?: unknown }).code : null;
  return typeof code === "string" ? code : null;
};

export const errorMessage = (error: unknown): string | null => {
  const message = error instanceof Error ? error.message : null;
  return message && !message.startsWith("HTTP ") ? message : null;
};

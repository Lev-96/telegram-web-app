/**
 * Where the owner web is running (2026-11-09), for the install / phone
 * notifications card. Read at the moment of asking: nothing is cached, so a
 * test can change the answer by changing the browser it fakes.
 */

/** Opened inside Telegram (the Mini App): installing makes no sense there. */
export const isTelegramMiniApp = (): boolean =>
  document.documentElement.dataset.shell === "telegram" || (window.Telegram?.WebApp?.initData ?? "") !== "";

/** Running as the installed app (home screen), not in a browser tab. */
export const isStandalone = (): boolean =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * iPhone / iPad. iPadOS reports itself as a Mac, so a "Mac" with a touch
 * screen counts too. There is no install prompt on iOS: the person adds the
 * page to the home screen from the Share menu.
 */
export const isIos = (): boolean => {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
};

/** The browser can receive web push at all (service worker + Push API + notifications). */
export const pushSupported = (): boolean =>
  "serviceWorker" in navigator && typeof window.PushManager !== "undefined" && typeof window.Notification !== "undefined";

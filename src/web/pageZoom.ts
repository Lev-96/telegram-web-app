/**
 * Keeps the page at 100% on phones and tablets (2026-09-29): no pinch-zoom,
 * no double-tap zoom, in a browser and in Telegram. The app is a working
 * panel sized for the screen; a page left half-zoomed hides its own controls.
 *
 * Three layers, because no single one works everywhere:
 *   1. index.html's viewport (`maximum-scale=1, user-scalable=no`) — what
 *      stops pinch in Chromium: Android browsers and Telegram's Android
 *      WebView (measured: a control page pinches to 5x, the app stays 1x);
 *   2. web.css `touch-action: pan-x pan-y` on the root — no double-tap zoom
 *      in iOS Safari, which ignores (1); scrolling unaffected (measured);
 *   3. this module — iOS Safari pinches through its own `gesture*` events,
 *      which are cancelled here.
 *
 * Only (3) is code. It is installed on touch devices only, so desktop Safari
 * keeps trackpad zoom, and it cancels nothing else: scrolling, taps, drags
 * and the map's own pinch (Leaflet reads touch events, not these) all run.
 */

const GESTURE_EVENTS = ["gesturestart", "gesturechange", "gestureend"] as const;

const cancel = (event: Event) => event.preventDefault();

/** Cancels the page-zoom gestures; returns the function that restores them. */
export const lockPageZoom = (target: Document = document): (() => void) => {
  for (const type of GESTURE_EVENTS) {
    target.addEventListener(type, cancel, { passive: false });
  }
  return () => {
    for (const type of GESTURE_EVENTS) {
      target.removeEventListener(type, cancel);
    }
  };
};

/** A finger is the main pointer (a phone or a tablet). */
export const isTouchDevice = (win: Window = window): boolean =>
  typeof win.matchMedia === "function" && win.matchMedia("(pointer: coarse)").matches;

/**
 * Chrome's install offer (2026-11-09). Chrome fires `beforeinstallprompt` once
 * the page qualifies as an app (manifest + service worker), often before React
 * has drawn anything, so it is captured from `main.tsx` at start and kept here;
 * the menu's «Install the app» button shows it later, inside the tap. Chrome's
 * own mini-infobar is held back (preventDefault): the menu is the one place
 * that offers it. iOS has no such event (see environment.isIos).
 */
import { useSyncExternalStore } from "react";

/** Chrome's event (not in TypeScript's DOM library). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Starts listening; returns a stop function that also forgets a held offer. */
export const startInstallCapture = (target: Window = window): (() => void) => {
  const onOffer = (event: Event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  };
  // Installed (from our button or the browser's menu): nothing left to offer.
  const onInstalled = () => {
    deferred = null;
    emit();
  };
  target.addEventListener("beforeinstallprompt", onOffer);
  target.addEventListener("appinstalled", onInstalled);
  return () => {
    target.removeEventListener("beforeinstallprompt", onOffer);
    target.removeEventListener("appinstalled", onInstalled);
    deferred = null;
    emit();
  };
};

/**
 * Shows the held offer. An offer can be shown once: it is dropped either way,
 * and Chrome fires a new one later if the person said no.
 */
export const promptInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
  const offer = deferred;
  if (!offer) return "unavailable";
  deferred = null;
  emit();
  await offer.prompt();
  return (await offer.userChoice).outcome;
};

/** True while Chrome has an install offer waiting. */
export const useInstallOffer = (): boolean => useSyncExternalStore(subscribe, () => deferred !== null);

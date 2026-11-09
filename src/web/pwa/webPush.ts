/**
 * Phone notifications for the installed owner web (2026-11-09): the browser's
 * Push API on one side, the backend's subscription endpoints on the other.
 *
 * Backend contract (`cyber-place`, built alongside):
 *   GET    /web-push/public-key     → { public_key: string | null }
 *                                     null or 404 = the feature is off here
 *   POST   /web-push/subscriptions  { endpoint, keys: { p256dh, auth }, content_encoding: "aes128gcm" }
 *   DELETE /web-push/subscriptions  { endpoint }
 *
 * The panel's own API client carries the session token, so the server files
 * the phone under whoever is signed in. What the notices say and when they are
 * sent is the server's business; this file only connects the phone.
 */
import { request } from "@/api/client";
import { isMissingEndpoint } from "@/api/fallback";

export const SW_URL = "/sw.js";
const SCOPE = "/";

/** `GET /web-push/public-key`. */
export interface WebPushPublicKey {
  public_key: string | null;
}

/** `POST /web-push/subscriptions`. */
export interface WebPushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  content_encoding: "aes128gcm";
}

/** `DELETE /web-push/subscriptions`. */
export interface WebPushUnsubscribeBody {
  endpoint: string;
}

/** The server's VAPID public key, or null when this server has no web push (null or 404). */
export const fetchPublicKey = async (): Promise<string | null> => {
  try {
    const res = await request<WebPushPublicKey | null>("/web-push/public-key", { noCache: true });
    return typeof res?.public_key === "string" && res.public_key !== "" ? res.public_key : null;
  } catch (e) {
    if (isMissingEndpoint(e)) return null;
    throw e;
  }
};

/** A base64url VAPID key as the bytes `applicationServerKey` takes. */
export const keyBytes = (base64url: string): Uint8Array<ArrayBuffer> => {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

/**
 * Was this subscription made with this key? A server that changed its key can
 * no longer reach an old subscription. A browser that does not say which key it
 * used is taken at its word.
 */
export const madeWithKey = (sub: PushSubscription, publicKey: string): boolean => {
  const used = sub.options?.applicationServerKey;
  if (!used) return true;
  const a = new Uint8Array(used);
  const b = keyBytes(publicKey);
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
};

/** What the server stores for a subscription. */
export const subscriptionBody = (sub: PushSubscription): WebPushSubscriptionBody => {
  const { endpoint, keys } = sub.toJSON();
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error("The browser returned an incomplete push subscription.");
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, content_encoding: "aes128gcm" };
};

const saveOnServer = (sub: PushSubscription) =>
  request<unknown>("/web-push/subscriptions", { method: "POST", body: subscriptionBody(sub) });

const removeFromServer = (endpoint: string) =>
  request<unknown>("/web-push/subscriptions", { method: "DELETE", body: { endpoint } satisfies WebPushUnsubscribeBody });

/** Registers the worker (same origin, root scope). Repeating it is harmless. */
export const registerWorker = () => navigator.serviceWorker.register(SW_URL, { scope: SCOPE });

/** This phone's current subscription, without registering anything. */
const currentSubscription = async (): Promise<PushSubscription | null> => {
  const reg = await navigator.serviceWorker.getRegistration(SCOPE);
  return (await reg?.pushManager.getSubscription()) ?? null;
};

/** Drops a subscription on the server (best effort: a dead one is pruned there) and in the browser. */
const drop = async (sub: PushSubscription): Promise<void> => {
  await removeFromServer(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe();
};

/**
 * «Turn on phone notifications», run inside the tap: the permission question
 * must be the first thing the tap does (Safari asks only from a user gesture).
 * Then the worker, the subscription, and the server. A subscription the server
 * did not take is dropped again, so the phone never believes it is on alone.
 */
export const enablePush = async (publicKey: string): Promise<NotificationPermission> => {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  await registerWorker();
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && !madeWithKey(sub, publicKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });

  try {
    await saveOnServer(sub);
  } catch (e) {
    await sub.unsubscribe().catch(() => undefined);
    throw e;
  }
  return "granted";
};

/** «Turn off»: the server forgets this phone, the browser drops the subscription. */
export const disablePush = async (): Promise<void> => {
  const sub = await currentSubscription();
  if (!sub) return;
  await removeFromServer(sub.endpoint);
  await sub.unsubscribe();
};

/**
 * On load, quietly: a phone that already allowed notifications sends its
 * subscription again (the server may have lost it, or another account was
 * signed in here before). One made with a key the server no longer has is
 * dropped: the person turns it on again with one tap.
 */
export const syncPush = async (publicKey: string): Promise<"on" | "off"> => {
  if (Notification.permission !== "granted") return "off";
  const sub = await currentSubscription();
  if (!sub) return "off";
  if (!madeWithKey(sub, publicKey)) {
    await drop(sub);
    return "off";
  }
  await saveOnServer(sub).catch(() => undefined);
  return "on";
};

/**
 * Signing out: this phone must not keep receiving the account's notices, and
 * the next person to sign in here turns them on for themselves. Best effort
 * and bounded, so a sign-out never waits on it for long.
 */
export const forgetPushOnSignOut = async (timeoutMs = 3000): Promise<void> => {
  if (!("serviceWorker" in navigator) || typeof window.PushManager === "undefined") return;
  const work = currentSubscription().then((sub) => (sub ? drop(sub) : undefined));
  await Promise.race([work.catch(() => undefined), new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
};

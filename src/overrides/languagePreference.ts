/**
 * The panel's `@/i18n/languagePreference` for the web and Telegram
 * (2026-09-30): the account's language is kept on the SERVER as well
 * (`GET/PUT /user/locale`), so it is asked once per account — not once per
 * browser, per phone, or per Telegram launch whose storage Telegram wiped.
 *
 * Everything else is the panel's own module, re-exported unchanged (explicit
 * exports below take precedence over the star export):
 *
 *   readAccountLang  the device's copy first (no request when it has one),
 *                    else the server's, which is then kept on the device;
 *   rememberLang     the panel's write, plus the server's copy while an
 *                    account is signed in;
 *   readStoredLang   before anything was chosen, the language Telegram or the
 *                    browser reports — the web has no pre-sign-in picker (the
 *                    sign-in screen has its language pills), so this is what
 *                    the sign-in screen opens in.
 *
 * A failed server read or write is never an error: the language then simply
 * lives on the device, as it did before.
 */
import { request } from "@/api/client";
import type { Lang } from "@/i18n/translations";
import { LANGUAGES } from "@/i18n/translations";
import * as base from "../../vendor/panel/src/i18n/languagePreference";

export * from "../../vendor/panel/src/i18n/languagePreference";

const isLang = (value: unknown): value is Lang => typeof value === "string" && LANGUAGES.some((l) => l.code === value);

/** The server's copy, per account, as last read or written in this run. */
const serverCopy = new Map<number, Lang | null>();

const fetchServerLang = async (): Promise<Lang | null> => {
  const { locale } = await request<{ locale: string | null }>("/user/locale", { noCache: true });
  return isLang(locale) ? locale : null;
};

const pushServerLang = (userId: number, lang: Lang): void => {
  if (serverCopy.get(userId) === lang) return;
  serverCopy.set(userId, lang);
  request("/user/locale", { method: "PUT", body: { locale: lang } }).catch(() => {
    serverCopy.delete(userId);
  });
};

export const readAccountLang = async (userId: number): Promise<Lang | null> => {
  const local = await base.readAccountLang(userId);
  if (local) return local;

  try {
    const server = await fetchServerLang();
    serverCopy.set(userId, server);
    if (server) await base.rememberAccountLang(userId, server);
    return server;
  } catch {
    return null;
  }
};

export const rememberLang = async (lang: Lang): Promise<void> => {
  await base.rememberLang(lang);
  const userId = base.getActiveAccount();
  if (userId !== null) pushServerLang(userId, lang);
};

/** A shipped language from a tag such as `ru`, `ru-RU`, `hy` (Armenian is `am` here). */
export const langFromTag = (tag: string | null | undefined): Lang | null => {
  const code = (tag ?? "").toLowerCase().split(/[-_]/)[0];
  const mapped = code === "hy" ? "am" : code;
  return isLang(mapped) ? mapped : null;
};

const guessedLang = (): Lang | null => {
  const telegram = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  const fromTelegram = langFromTag(telegram);
  if (fromTelegram) return fromTelegram;

  const tags = typeof navigator !== "undefined" ? (navigator.languages ?? [navigator.language]) : [];
  for (const tag of tags) {
    const lang = langFromTag(tag);
    if (lang) return lang;
  }
  return null;
};

export const readStoredLang = async (): Promise<Lang | null> => (await base.readStoredLang()) ?? guessedLang();

/** Tests only. */
export const forgetServerCopies = () => serverCopy.clear();

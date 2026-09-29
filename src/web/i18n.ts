/**
 * Text this app says that the desktop panel never does (sign-in to the web,
 * Telegram linking, the mobile shell). Same shape and same three languages as
 * the panel's dictionary; the language itself is the panel's — `useLang()` —
 * so switching it anywhere switches it here too.
 *
 * Every screen the owner works in is the panel's and uses the panel's own
 * translations; this file must stay small.
 */
import { useLang } from "@/i18n/LanguageContext";
import type { Lang } from "@/i18n/translations";

export const WEB_TEXT = {
  "web.signIn.title": { en: "Owner panel", ru: "Панель владельца", am: "Սեփականատիրոջ էջ" },
  "web.signIn.subtitle": {
    en: "Sign in with your Cyber Place account.",
    ru: "Войдите в аккаунт Cyber Place.",
    am: "Մուտք գործեք Cyber Place-ի հաշիվ։",
  },
  "web.signIn.email": { en: "Email", ru: "Email", am: "Էլ. հասցե" },
  "web.signIn.password": { en: "Password", ru: "Пароль", am: "Գաղտնաբառ" },
  "web.signIn.submit": { en: "Sign in", ru: "Войти", am: "Մուտք" },
  "web.signIn.busy": { en: "Signing in…", ru: "Вход…", am: "Մուտք…" },
  "web.reset.noLink": {
    en: "This reset link cannot be used. Ask for a new one.",
    ru: "Эта ссылка для сброса не работает. Запросите новую.",
    am: "Վերակայման այս հղումը չի գործում։ Պահանջեք նորը։",
  },
  "web.reset.newLink": { en: "Send a new link", ru: "Отправить новую ссылку", am: "Ուղարկել նոր հղում" },
  "web.reset.everywhere": {
    en: "After the change you will be signed out on every device, the desktop app included.",
    ru: "После смены пароля вы выйдете из аккаунта на всех устройствах, включая приложение для компьютера.",
    am: "Փոփոխությունից հետո դուք դուրս կգաք բոլոր սարքերից, ներառյալ համակարգչի հավելվածը։",
  },
  "web.menu": { en: "Menu", ru: "Меню", am: "Մենյու" },
  "web.close": { en: "Close", ru: "Закрыть", am: "Փակել" },

  "web.telegram.title": { en: "Telegram", ru: "Telegram", am: "Telegram" },
  "web.telegram.failed": {
    en: "Telegram could not be opened. Try again.",
    ru: "Не удалось открыть Telegram. Попробуйте ещё раз.",
    am: "Չհաջողվեց բացել Telegram-ը։ Կրկին փորձեք։",
  },
  "web.telegram.hint": {
    en: "Work from the bot",
    ru: "Работа через бота",
    am: "Աշխատանք բոտով",
  },

  "web.tg.signingIn": { en: "Signing in with Telegram…", ru: "Вход через Telegram…", am: "Մուտք Telegram-ով…" },
  "web.tg.linking": { en: "Linking your Telegram…", ru: "Привязываем Telegram…", am: "Կապում ենք Telegram-ը…" },
  "web.tg.reopen": {
    en: "Your Telegram session has ended. Close the app and open it again from the bot.",
    ru: "Сеанс в Telegram завершён. Закройте приложение и снова откройте его из бота.",
    am: "Telegram-ի աշխատաշրջանն ավարտվել է։ Փակեք հավելվածը և նորից բացեք այն բոտից։",
  },
} as const satisfies Record<string, Record<Lang, string>>;

export type WebTextKey = keyof typeof WEB_TEXT;

export const webText = (key: WebTextKey, lang: Lang, ...args: Array<string | number>): string =>
  args.reduce<string>((text, arg, i) => text.split(`{${i}}`).join(String(arg)), WEB_TEXT[key][lang] ?? WEB_TEXT[key].en);

/** `tw("web.signIn.title")` in the viewer's current language. */
export const useWebText = () => {
  const { lang } = useLang();
  return (key: WebTextKey, ...args: Array<string | number>) => webText(key, lang, ...args);
};

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
  // A new owner's or manager's first password: the same screen, opened from
  // the invitation email (`&purpose=invite`).
  "web.invite.title": { en: "Set your password", ru: "Задайте пароль", am: "Սահմանեք գաղտնաբառը" },
  "web.invite.welcome": {
    en: "Welcome to Cyber Place. Choose the password you will sign in with.",
    ru: "Добро пожаловать в Cyber Place. Придумайте пароль для входа.",
    am: "Բարի գալուստ Cyber Place։ Ընտրեք գաղտնաբառ, որով մուտք կգործեք։",
  },
  "web.invite.submit": { en: "Set password", ru: "Сохранить пароль", am: "Պահպանել գաղտնաբառը" },
  "web.invite.done": {
    en: "Your password is set. Sign in with your email and the new password.",
    ru: "Пароль задан. Войдите со своим email и новым паролем.",
    am: "Գաղտնաբառը սահմանված է։ Մուտք գործեք ձեր էլ. հասցեով և նոր գաղտնաբառով։",
  },
  "web.invite.noLink": {
    en: "This invitation link cannot be used. Ask for a new one.",
    ru: "Эта ссылка-приглашение не работает. Запросите новую.",
    am: "Հրավերի այս հղումը չի գործում։ Պահանջեք նորը։",
  },
  // The sign-in guard (2026-10-01): mosaic captcha, reset offer.
  "web.captcha.title": { en: "Confirm you are a person", ru: "Подтвердите, что вы человек", am: "Հաստատեք, որ մարդ եք" },
  "web.captcha.hint": {
    en: "Slide the piece into its place in the picture.",
    ru: "Передвиньте кусочек на его место в картинке.",
    am: "Տեղափոխեք կտորը նկարում իր տեղը։",
  },
  "web.captcha.missed": {
    en: "Not quite. Here is a new picture, try again.",
    ru: "Не совсем. Вот новая картинка, попробуйте ещё раз.",
    am: "Ոչ այնքան։ Ահա նոր նկար, փորձեք կրկին։",
  },
  "web.captcha.needed": {
    en: "Too many failed attempts. Solve the puzzle to continue.",
    ru: "Слишком много неудачных попыток. Соберите мозаику, чтобы продолжить.",
    am: "Չափազանց շատ անհաջող փորձեր։ Հավաքեք խճանկարը՝ շարունակելու համար։",
  },
  "web.captcha.solved": {
    en: "Done. Enter your password again.",
    ru: "Готово. Введите пароль ещё раз.",
    am: "Պատրաստ է։ Կրկին մուտքագրեք գաղտնաբառը։",
  },
  "web.captcha.slider": { en: "Piece position", ru: "Положение кусочка", am: "Կտորի դիրքը" },
  "web.captcha.check": { en: "Check", ru: "Проверить", am: "Ստուգել" },
  "web.captcha.reload": { en: "Another picture", ru: "Другая картинка", am: "Այլ նկար" },
  "web.login.resetAsk": {
    en: "Can't sign in? Reset your password?",
    ru: "Не получается войти? Сбросить пароль?",
    am: "Չե՞ք կարողանում մուտք գործել։ Վերականգնե՞լ գաղտնաբառը։",
  },
  "web.login.resetYes": { en: "Reset password", ru: "Сбросить пароль", am: "Վերականգնել գաղտնաբառը" },
  "web.login.resetNo": { en: "Try again", ru: "Попробовать ещё", am: "Կրկին փորձել" },
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

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
  "web.signIn.accessNote": {
    en: "Access is given by the Cyber Place administrator. The address alone opens nothing.",
    ru: "Доступ выдаёт администратор Cyber Place. Сам адрес ничего не открывает.",
    am: "Մուտքը տրամադրում է Cyber Place-ի ադմինիստրատորը։ Միայն հասցեն ոչինչ չի բացում։",
  },
  "web.signIn.forgot": {
    en: "Forgot the password? Reset it in the desktop app or ask your administrator.",
    ru: "Забыли пароль? Восстановите его в приложении для компьютера или обратитесь к администратору.",
    am: "Մոռացե՞լ եք գաղտնաբառը։ Վերականգնեք այն համակարգչի հավելվածում կամ դիմեք ադմինիստրատորին։",
  },
  "web.menu": { en: "Menu", ru: "Меню", am: "Մենյու" },
  "web.close": { en: "Close", ru: "Закрыть", am: "Փակել" },

  "web.telegram.title": { en: "Telegram", ru: "Telegram", am: "Telegram" },
  "web.telegram.open": { en: "Telegram access", ru: "Доступ через Telegram", am: "Մուտք Telegram-ով" },
  "web.telegram.notGranted": {
    en: "Telegram access has not been given to this account. Ask your Cyber Place administrator.",
    ru: "Этому аккаунту не выдан доступ через Telegram. Обратитесь к администратору Cyber Place.",
    am: "Այս հաշվին Telegram-ով մուտք չի տրամադրվել։ Դիմեք Cyber Place-ի ադմինիստրատորին։",
  },
  "web.telegram.disabled": {
    en: "Telegram is not set up on this server yet.",
    ru: "Telegram на этом сервере ещё не настроен.",
    am: "Telegram-ը այս սերվերում դեռ կարգավորված չէ։",
  },
  "web.telegram.none": {
    en: "No Telegram account is linked. Create a link, open it on the phone with your Telegram, then confirm here.",
    ru: "Telegram не привязан. Создайте ссылку, откройте её на телефоне со своим Telegram и подтвердите здесь.",
    am: "Telegram կապված չէ։ Ստեղծեք հղում, բացեք այն ձեր Telegram-ով հեռախոսում, ապա հաստատեք այստեղ։",
  },
  "web.telegram.create": { en: "Create link", ru: "Создать ссылку", am: "Ստեղծել հղում" },
  "web.telegram.linkHint": {
    en: "Open this link in Telegram or scan the code. It works once, for {0} minutes.",
    ru: "Откройте ссылку в Telegram или отсканируйте код. Она работает один раз, {0} мин.",
    am: "Բացեք հղումը Telegram-ում կամ սկանավորեք կոդը։ Այն գործում է մեկ անգամ՝ {0} րոպե։",
  },
  "web.telegram.copy": { en: "Copy link", ru: "Скопировать ссылку", am: "Պատճենել հղումը" },
  "web.telegram.copied": { en: "Link copied", ru: "Ссылка скопирована", am: "Հղումը պատճենվեց" },
  "web.telegram.pending": {
    en: "Telegram {0} wants to connect to your account. Confirm only if it is yours.",
    ru: "Telegram {0} хочет подключиться к вашему аккаунту. Подтвердите, только если это ваш.",
    am: "Telegram {0}-ը ցանկանում է միանալ ձեր հաշվին։ Հաստատեք միայն եթե այն ձերն է։",
  },
  "web.telegram.password": {
    en: "Your password, to confirm",
    ru: "Ваш пароль для подтверждения",
    am: "Ձեր գաղտնաբառը՝ հաստատելու համար",
  },
  "web.telegram.confirm": { en: "Confirm", ru: "Подтвердить", am: "Հաստատել" },
  "web.telegram.reject": { en: "Not mine", ru: "Это не мой", am: "Իմը չէ" },
  "web.telegram.active": {
    en: "Telegram {0} is linked. Open the bot to work from Telegram.",
    ru: "Telegram {0} привязан. Откройте бота, чтобы работать из Telegram.",
    am: "Telegram {0}-ը կապված է։ Բացեք բոտը՝ Telegram-ից աշխատելու համար։",
  },
  "web.telegram.unlink": { en: "Unlink Telegram", ru: "Отвязать Telegram", am: "Անջատել Telegram-ը" },
  "web.telegram.unlinkConfirm": {
    en: "Unlink this Telegram account? It will be signed out at once.",
    ru: "Отвязать этот Telegram? Он сразу потеряет доступ.",
    am: "Անջատե՞լ այս Telegram-ը։ Այն անմիջապես կկորցնի մուտքը։",
  },
  "web.telegram.noUsername": { en: "(no username)", ru: "(без имени пользователя)", am: "(առանց օգտանվան)" },

  "web.tg.signingIn": { en: "Signing in with Telegram…", ru: "Вход через Telegram…", am: "Մուտք Telegram-ով…" },
  "web.tg.linking": { en: "Linking your Telegram…", ru: "Привязываем Telegram…", am: "Կապում ենք Telegram-ը…" },
  "web.tg.linkPending": {
    en: "Almost done. Open the web panel and confirm this Telegram account, then open the bot again.",
    ru: "Почти готово. Откройте веб-панель, подтвердите этот Telegram и снова откройте бота.",
    am: "Գրեթե պատրաստ է։ Բացեք վեբ տարբերակը, հաստատեք այս Telegram-ը և նորից բացեք բոտը։",
  },
  "web.tg.reopen": {
    en: "Your Telegram session has ended. Close the app and open it again from the bot.",
    ru: "Сеанс в Telegram завершён. Закройте приложение и снова откройте его из бота.",
    am: "Telegram-ի աշխատաշրջանն ավարտվել է։ Փակեք հավելվածը և նորից բացեք այն բոտից։",
  },
  "web.tg.retry": { en: "Try again", ru: "Попробовать снова", am: "Կրկին փորձել" },
} as const satisfies Record<string, Record<Lang, string>>;

export type WebTextKey = keyof typeof WEB_TEXT;

export const webText = (key: WebTextKey, lang: Lang, ...args: Array<string | number>): string =>
  args.reduce<string>((text, arg, i) => text.split(`{${i}}`).join(String(arg)), WEB_TEXT[key][lang] ?? WEB_TEXT[key].en);

/** `tw("web.signIn.title")` in the viewer's current language. */
export const useWebText = () => {
  const { lang } = useLang();
  return (key: WebTextKey, ...args: Array<string | number>) => webText(key, lang, ...args);
};

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
  "web.login.resetAsk": {
    en: "Can't sign in? Reset your password?",
    ru: "Не получается войти? Сбросить пароль?",
    am: "Չե՞ք կարողանում մուտք գործել։ Վերականգնե՞լ գաղտնաբառը։",
  },
  "web.login.resetYes": { en: "Reset password", ru: "Сбросить пароль", am: "Վերականգնել գաղտնաբառը" },
  "web.login.resetNo": { en: "Try again", ru: "Попробовать ещё", am: "Կրկին փորձել" },
  "web.menu": { en: "Menu", ru: "Меню", am: "Մենյու" },
  "web.close": { en: "Close", ru: "Закрыть", am: "Փակել" },
  // The installed app's phone shell (2026-11-09): the bottom bar and its sheet.
  "web.shell.sections": { en: "Sections", ru: "Разделы", am: "Բաժիններ" },
  "web.shell.more": { en: "More", ru: "Ещё", am: "Ավելին" },
  "web.shell.unread": { en: "{0} unread", ru: "{0} непрочитанных", am: "{0} չկարդացված" },

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

  // The installable app and its phone notifications (2026-11-09, the menu card).
  "web.app.install": { en: "Install the app", ru: "Установить приложение", am: "Տեղադրել հավելվածը" },
  "web.app.installHint": { en: "On your phone's home screen", ru: "На главный экран телефона", am: "Հեռախոսի գլխավոր էկրանին" },
  "web.app.iosHint": { en: "iPhone: from the Share menu", ru: "iPhone: через меню «Поделиться»", am: "iPhone՝ «Share» ցանկից" },
  // iOS has no Armenian interface: the Armenian text names Safari's English
  // labels. Step 4 takes the prompt's button text ({0}).
  "web.app.iosTitle": { en: "Install on iPhone", ru: "Установка на iPhone", am: "Տեղադրում iPhone-ում" },
  "web.app.iosStep1": {
    en: "In Safari, tap Share (a square with an up arrow). On newer iOS, tap «⋯» first.",
    ru: "В Safari нажмите «Поделиться» (квадрат со стрелкой вверх). В новых iOS сначала нажмите «⋯».",
    am: "Safari-ում սեղմեք «Share» (քառակուսի՝ վերև սլաքով)։ iOS-ի նոր տարբերակներում նախ սեղմեք «⋯»։",
  },
  "web.app.iosStep2": {
    en: "Scroll down and choose «Add to Home Screen». Not there? Tap «View More».",
    ru: "Прокрутите вниз и выберите «На экран „Домой“». Если его нет, нажмите «Ещё».",
    am: "Թերթեք ներքև և ընտրեք «Add to Home Screen»։ Չկա՞, սեղմեք «View More»։",
  },
  "web.app.iosStep3": {
    en: "Tap «Add», then open Cyber Place from the Home Screen and sign in.",
    ru: "Нажмите «Добавить», затем откройте Cyber Place с экрана «Домой» и войдите.",
    am: "Սեղմեք «Add», ապա բացեք Cyber Place-ը հիմնական էկրանից և մուտք գործեք։",
  },
  "web.app.iosStep4": {
    en: "Tap «{0}». Notices then arrive even when the phone is locked.",
    ru: "Нажмите «{0}». Уведомления будут приходить, даже когда телефон заблокирован.",
    am: "Սեղմեք «{0}»։ Ծանուցումները կգան նույնիսկ, երբ հեռախոսը կողպված է։",
  },
  "web.app.iosNote": {
    en: "Safari, or another browser on iOS 16.4+. Not inside the Telegram app.",
    ru: "В Safari или другом браузере на iOS 16.4+. Не внутри приложения Telegram.",
    am: "Safari-ում կամ այլ բրաուզերում՝ iOS 16.4+։ Ոչ Telegram հավելվածի ներսում։",
  },
  "web.app.notifications": { en: "Phone notifications", ru: "Уведомления на телефоне", am: "Ծանուցումներ հեռախոսում" },
  "web.app.enable": { en: "Turn on phone notifications", ru: "Включить уведомления на телефоне", am: "Միացնել ծանուցումները հեռախոսում" },
  "web.app.enableHint": { en: "Even when the app is closed", ru: "Даже когда приложение закрыто", am: "Նույնիսկ երբ հավելվածը փակ է" },
  "web.app.on": { en: "On for this phone", ru: "Включены на этом телефоне", am: "Միացված են այս հեռախոսում" },
  "web.app.off": { en: "Turn off", ru: "Выключить", am: "Անջատել" },
  "web.app.blocked": {
    en: "Blocked by the browser. Allow them in the phone's settings.",
    ru: "Заблокированы браузером. Разрешите их в настройках телефона.",
    am: "Արգելափակված են բրաուզերում։ Թույլատրեք դրանք հեռախոսի կարգավորումներում։",
  },
  "web.app.unsupported": { en: "This browser does not support them", ru: "Этот браузер их не поддерживает", am: "Այս բրաուզերը դրանք չի աջակցում" },
  "web.app.telegram": { en: "In Telegram they come from the bot", ru: "В Telegram они приходят от бота", am: "Telegram-ում դրանք գալիս են բոտից" },
  "web.app.enableFailed": {
    en: "Notifications could not be turned on. Try again.",
    ru: "Не удалось включить уведомления. Попробуйте ещё раз.",
    am: "Չհաջողվեց միացնել ծանուցումները։ Կրկին փորձեք։",
  },
  "web.app.disableFailed": {
    en: "Notifications could not be turned off. Try again.",
    ru: "Не удалось выключить уведомления. Попробуйте ещё раз.",
    am: "Չհաջողվեց անջատել ծանուցումները։ Կրկին փորձեք։",
  },

  // The first-launch prompt of the installed app (2026-11-09).
  "web.push.title": { en: "Turn on notifications", ru: "Включите уведомления", am: "Միացրեք ծանուցումները" },
  "web.push.body": {
    en: "Payments and blocks arrive here, even on the lock screen.",
    ru: "Оплаты и блокировки придут сюда, даже на экран блокировки.",
    am: "Վճարումներն ու արգելափակումները կգան այստեղ, նույնիսկ կողպված էկրանին։",
  },
  "web.push.allow": { en: "Allow notifications", ru: "Разрешить уведомления", am: "Թույլատրել ծանուցումները" },
  "web.push.later": { en: "Later", ru: "Позже", am: "Ավելի ուշ" },
  "web.push.enabled": { en: "Notifications are on", ru: "Уведомления включены", am: "Ծանուցումները միացված են" },
  "web.push.deniedTitle": { en: "Notifications are blocked", ru: "Уведомления запрещены", am: "Ծանուցումներն արգելված են" },
  // iOS's own labels: «Допуск уведомлений» in Russian; English in Armenian (no Armenian iOS).
  "web.push.deniedIos": {
    en: "To allow them, open Settings → Notifications → Cyber Place → Allow Notifications.",
    ru: "Чтобы разрешить, откройте Настройки → Уведомления → Cyber Place → Допуск уведомлений.",
    am: "Թույլատրելու համար բացեք Settings → Notifications → Cyber Place → Allow Notifications։",
  },
  // The install banner in a browser tab (2026-11-09).
  "web.banner.ios": {
    en: "Install Cyber Place on your iPhone to get notifications",
    ru: "Установите Cyber Place на iPhone, чтобы получать уведомления",
    am: "Տեղադրեք Cyber Place-ը iPhone-ում՝ ծանուցումներ ստանալու համար",
  },
  "web.banner.browser": {
    en: "Install the app to get notifications on your phone",
    ru: "Установите приложение, чтобы получать уведомления на телефон",
    am: "Տեղադրեք հավելվածը՝ հեռախոսում ծանուցումներ ստանալու համար",
  },
  "web.banner.how": { en: "How to install", ru: "Как установить", am: "Ինչպես տեղադրել" },
  "web.banner.install": { en: "Install", ru: "Установить", am: "Տեղադրել" },

  "web.tg.signingIn": { en: "Signing in with Telegram…", ru: "Вход через Telegram…", am: "Մուտք Telegram-ով…" },
  "web.tg.linking": { en: "Linking your Telegram…", ru: "Привязываем Telegram…", am: "Կապում ենք Telegram-ը…" },
  // The server's refusals of a web sign-in, said by their `code` so the
  // sentence follows a language switch (2026-10-07). Same wording as the
  // backend's `response.client-access.*`.
  "web.refusal.client_access_role_not_allowed": {
    en: "This way of signing in is for club owners only.",
    ru: "Этот способ входа доступен только владельцам клубов.",
    am: "Մուտքի այս եղանակը միայն ակումբների սեփականատերերի համար է։",
  },
  "web.refusal.client_access_owners_only": {
    en: "Web and Telegram access is available to company owners only.",
    ru: "Доступ через браузер и Telegram есть только у владельцев компаний.",
    am: "Բրաուզերով և Telegram-ով մուտքը հասանելի է միայն ընկերությունների սեփականատերերին։",
  },
  "web.tg.reopen": {
    en: "Your Telegram session has ended. Close the app and open it again from the bot.",
    ru: "Сеанс в Telegram завершён. Закройте приложение и снова откройте его из бота.",
    am: "Telegram-ի աշխատաշրջանն ավարտվել է։ Փակեք հավելվածը և նորից բացեք այն բոտից։",
  },
} as const satisfies Record<string, Record<Lang, string>>;

export type WebTextKey = keyof typeof WEB_TEXT;

export const webText = (key: WebTextKey, lang: Lang, ...args: Array<string | number>): string =>
  args.reduce<string>((text, arg, i) => text.split(`{${i}}`).join(String(arg)), WEB_TEXT[key][lang] ?? WEB_TEXT[key].en);

export const isWebTextKey = (key: string): key is WebTextKey => Object.prototype.hasOwnProperty.call(WEB_TEXT, key);

/** Our key for a refusal `code` the server sends this app, or null for a code we have no words for. */
export const webRefusalKeyFor = (code: string | null): WebTextKey | null => {
  const key = `web.refusal.${code}`;
  return code && isWebTextKey(key) ? key : null;
};

/** `tw("web.signIn.title")` in the viewer's current language. */
export const useWebText = () => {
  const { lang } = useLang();
  return (key: WebTextKey, ...args: Array<string | number>) => webText(key, lang, ...args);
};

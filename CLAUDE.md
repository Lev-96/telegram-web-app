# Cyber Place owner web + Telegram Mini App

The owner panel in a browser and inside Telegram. It is **the desktop panel's
own screens**, built for the web: nothing here re-implements a feature, a
price, a rule or a permission. The backend (`/var/www/html/cyber-place`)
decides everything; this app shows its answers.

Read the panel's `CLAUDE.md` (`vendor/panel/CLAUDE.md` after `npm run
fetch-panel`) for how its screens work, and the backend's for the API.

## How it is built

- `panel.ref` pins the panel commit. `scripts/fetch-panel.mjs` puts that
  commit's source at `vendor/panel/` (gitignored). **The panel repository is
  never modified by this app.** Bump `panel.ref` to take newer screens.
  `PANEL_SRC=/path/to/panel npm run dev` uses a local checkout (symlink).
- Vite aliases: `@/` → `vendor/panel/src/` (the panel's own imports),
  `@web/` → `src/` (this app). `overrides.config.mjs` lists the few panel
  modules replaced for the web; `tsconfig.json` `paths` carries the same map
  (a test keeps them identical). Each replacement exports the same names:

  | Panel module | Replaced because |
  |---|---|
  | `@/api/auth` | sign in/out through `/owner-web/session/*`; the desktop's `/session/logout` deletes EVERY token of the user, the desktop's included |
  | `@/infrastructure/KeyValueStore` | web: everything in `localStorage`, so a sign-in survives closing the browser (bounded by the server's 30-day lifetime / 14-day idle); Telegram: the session in `sessionStorage` |
  | `@/components/Layout` | a shell that works from 360px: below 900px a 52px top bar with the logo on the LEFT and the menu button on the RIGHT, and a drawer that slides in from the right; mounts every notifier the desktop shell mounts, and above the screen the same `PageTopBar` (back button + docked heading), `UnsavedInterfaceNotice` and `NewInterfacesOffer` (since panel.ref 61f0e72 = v1.0.54; the bar's side-menu toggle renders nothing without the desktop's `AppShell`). When bumping `panel.ref`, diff the panel's `src/components/Layout.tsx` since the old pin and mirror what it mounts (`tests/layout.test.tsx`). "Telegram" is a card in the menu (panel Sidebar's `footerExtra` slot, `src/web/TelegramMenuEntry.tsx`), for an owner in a browser only; no top-bar or corner button. In the installed app (not Telegram) also the bell, avatar and bottom bar: see "Installed app: the phone shell" |
  | `@/routes/Login` | the desktop's sign-in pieces incl. the forgot-password face (`#/forgot-password`); a language pill hands the choice to the next account (`notePreLoginChoice`); in Telegram it says "reopen from the bot". Still since 2026-11-13: no scene, no ring, the faces swap at once (see "Static sign-in") |
  | `@/i18n/languagePreference` | the account's language is ALSO kept on the server (`GET/PUT /user/locale`), so it is asked once per account — never again on another device or after Telegram wipes its storage; before any choice the sign-in opens in Telegram's / the browser's language |
  | `@/routes/ResetPassword` | the mailed reset link's screen: no token field, the secret dropped from the URL, one way forward from a dead link. Opened from an INVITATION (`&purpose=invite`, a new owner's or manager's first password, 2026-09-30) it says "set your password" and welcomes them, without the sign-out-everywhere note. `main.tsx` renders it STANDALONE when opened on `#/reset-password` — signed in or not — because the panel's signed-in routes would send the link to the dashboard |
  | `@/telemetry/TelemetryTracker` | desktop telemetry must not count web traffic |

  Replace a module only when the web truly differs, and only by alias: a
  panel file imported by RELATIVE path cannot be replaced (check with grep).
- `scripts/check-deps.mjs` fails the build if a library version differs from
  the panel's lockfile: the panel's code must run on what it was tested with.
- Web-only text: `src/web/i18n.ts` (en/ru/am, the panel's `useLang()`
  language). Keep it small — the working screens use the panel's dictionary.
  No em dash; Armenian never says «Վահանակ» for this panel.

## Security model (server-side; see backend `config/client_access.php`)

- Knowing the URL gives a sign-in form and nothing else. Access follows the
  role (since 2026-09-29, nothing is granted per person): every company owner
  has the web and Telegram, every manager the web. The sign-in screen says
  nothing about an administrator giving access.
- Tokens from `/owner-web/session/login` and `/telegram/mini-app/session`
  carry a `client:*` ability, expire (30 days web / 8h Telegram), die when
  idle (14 days web / 60 min Telegram), on an admin block, when the
  Telegram link moves to another Telegram account and on a password reset. Switching accounts on the web is a new web sign-in: the
  server deletes the web token the browser held. They may not call the routes
  in `denied_routes` (logout-all, admin, password/email
  change, creating or writing managers/users, deleting a company, unlock PIN,
  agent token rotation, Wake-on-LAN, PS5 wake events). Those screens still
  render from the panel's code; the server refuses the write with a sentence.
- Telegram: the app sends Telegram's signed launch data untouched; the
  backend checks the HMAC with the bot token, freshness (5 min) and one-time
  use. Linking is the one-tap handoff below: no code on screen, no password
  confirmation (the owner's decision, 2026-09-29).
- PS5 wake/rest/pairing and the kiosk agent's LAN control stay desktop-only
  (the venue network is unreachable from a browser); the server refuses them
  to web tokens and the screens show the server's sentence.

## Environments (Railway, project "Cyber Place Owner-Web")

| | staging | production |
|---|---|---|
| Railway service | `cyber-place-owner-web` | `telegram-web-app` |
| branch | `staging` | `main` |
| domain | `staging.owner.cyberplace.pro` | `owner.cyberplace.pro` |
| `VITE_BACKEND_URL` (build), `BACKEND_ORIGIN` (Caddy) | staging backend | production backend |
| `REVERB_ORIGIN` (Caddy) | `wss://` staging Reverb | `wss://` production Reverb |
| Telegram bot | the staging bot | the production bot |
| Under Attack Mode | off | owner's choice (on = browser check; non-browser clients get 429) |

Production is `main` here (the owner's choice for this repo). It goes live only
when `staging` is merged into `main` on the owner's word, and only together
with the backend release that carries `/owner-web/*` and `/telegram/*`.

The backend of each environment holds its own `TELEGRAM_OWNER_BOT_TOKEN`,
`TELEGRAM_OWNER_BOT_USERNAME`, `TELEGRAM_OWNER_APP_SHORT_NAME`. Never point a
production bot at staging. Railway does not expand `${VAR}`: literal values.

`Caddyfile` serves `dist/` as an allowlist: only GET/HEAD (405 otherwise) and
only the page and its built files (`/`, `/index.html`, `/logo.png`,
`/assets/*`, `/fonts/*`, `/bg/*`, `/sounds/*`, and the installable app's
`/sw.js`, `/manifest.webmanifest`, `/icons/*` — the app routes by hash);
everything else is 404. CSP as an HTTP header (only there does `frame-ancestors`
work; it admits Telegram's web clients and nobody else; `manifest-src 'self'`
and `worker-src 'self'` cover the PWA), HSTS, nosniff, no-referrer, CORP.
`/sw.js` and `/manifest.webmanifest` are `no-cache` like index.html; the
manifest's Content-Type is set explicitly (not every MIME table knows it).
Add a new top-level public file (in the panel's `public/` or in `static/`)?
Add its path to the `@app` matcher: `tests/caddyfile.test.ts` fails when a
top-level name in either directory is not covered. **`/sounds/*` was missing
until 2026-11-09**: every melody chosen in Settings was a 404 and the panel fell
back to its default chime.

## Checks

`npm run typecheck`, `npm test` (vitest), `npm run build`. The backend side is
covered by `tests/Feature/OwnerWebAccessTest.php` and friends there. Commits
go to `staging`; production (`main`) is promoted by the owner.

## Phone sizing (2026-09-29)

`src/styles/web.css`, `@media (max-width: 599px)`: page titles 19px, h3 15px,
the home greeting 24px, cards 12px padding, stat tiles two per row, home link
cards one per row, a smaller login composition (`--ring-size` from 60vw /
34dvh, 15px title, 52px logo) and compact language pills with a 40px hit
area. Touch rules keep every pressed control ≥ 40px; a status `.pill` is a
label and keeps its own size (only `button.pill` / `a.pill` grow). Verified
headless at 360/390/768/1280 with 0px page overflow; screenshots in
`~/cyber-place-local/reports/owner-web-mobile-2026-09-29/`.

## Page zoom is locked on touch screens (2026-09-29)

No pinch or double-tap zoom on phones/tablets, in a browser or Telegram:
index.html viewport `maximum-scale=1, user-scalable=no` (Chromium: Android,
Telegram Android), web.css `:root[data-shell] { touch-action: pan-x pan-y }`
(iOS double-tap), `src/web/pageZoom.ts` cancelling `gesture*` events (iOS
pinch; installed only when `(pointer: coarse)`, so desktop trackpad zoom stays).
Measured with real two-finger touch in Chromium: a control page pinches to 5x,
the app stays 1x; the branch map still pinch-zooms (Leaflet, 12 -> 15);
touch scrolling works. iOS layers are unit-tested only, not on a device.

## Narrow shell is a fixed frame (2026-09-29)

Below 900px `.web-shell` is `position: fixed; inset: 0`: only `.main` scrolls.
With `height: 100dvh` alone, a browser without dvh (iOS Safari < 15.4, some
WebViews) used 100vh, taller than the visible area; the document scrolled,
the sticky top bar slid over `.main` and the sticky Back button was left half
under it. `.main` has no top padding (WebKit and Blink disagree on sticky vs
scroll-container padding): the gap is the first child's margin and the Back
button sticks at `top: 8px`. Reproduced and verified in Chromium by forcing
the shell 80px taller than the screen: before, 0 of 40px of the button
visible; after, 40 of 40, document scroll 0, bottom of `.main` reachable.

## One-tap Telegram (2026-09-29)

The owner's "Telegram" menu card (`src/web/TelegramMenuEntry.tsx`) is a real
link to `POST /client-access/telegram/open`'s one-time handoff
(`t.me/<bot>[/<app>]?startapp=link_<code>`, 2 minutes). Telegram opens the
Mini App straight away (no chat, no START), `TelegramGate` sends the signed
launch to `/telegram/mini-app/link`, and the backend links that Telegram
account to the owner and returns the session: the owner lands in the panel
signed in. There is no access dialog, QR, code or password confirmation any
more.

`src/web/telegramHandoff.ts` prepares the link while the card is seen
(IntersectionObserver + page visibility: drawer open, or the sidebar on a wide
screen) and renews it 30 s before it expires, because a phone opens the
Telegram app from a link only when the tap follows a real link — a link
fetched after the tap shows the t.me page instead. A tap before it is ready
opens a tab inside the tap and sends it there when the link arrives. Later
launches from the bot (its START / "Open Cyber Place" button, or the chat's
launcher) use `/telegram/mini-app/session` and sign in by themselves.

`TelegramGate` trades a launch for a session ONCE per launch
(`exchangeLaunch`, module-level), not once per mount: the server accepts a
launch once, and the first-run language picker re-mounts the gate when a
language is chosen — the second exchange used to be refused ("Telegram did not
confirm who you are") right after "Continue" (2026-09-30).

Bot setup per environment: backend `php artisan telegram:owner-bot setup`,
plus BotFather's Main Mini App URL = this app's address.

## Language: asked once per account (2026-09-30)

`main.tsx` mounts no pre-sign-in language picker (the panel's
`FirstRunLanguageGate`): the sign-in screen has its language pills, Telegram
signs in by itself, and with both pickers Telegram opened them on top of each
other (the account's opened behind the first while the sign-in finished). What
is left is the panel's `AccountLanguageGate`, fed by
`overrides/languagePreference.ts`: the account's language from the device, else
from the server (`/user/locale`), else — once — the picker, whose answer is
written to both. A language pill tapped on the sign-in screen is handed to the
account instead of asking. Verified in a browser (simulated Telegram launch with
a real signature): first Telegram launch one picker then the owner's page;
reopen, reopen with wiped storage, the web on two new devices: no picker.

This relies on the panel's `LanguageContext` importing `@/i18n/languagePreference`
by alias (changed 2026-09-30); a relative import cannot be overridden here.

## Sign-in guard and owners only (2026-10-01)

- **Only owners sign in here.** The backend refuses a manager with `client_access_role_not_allowed` (shown in the server's words), and the account switcher offers no managers.
- **Repeated wrong passwords** (backend `StaffLoginGuard`), handled in `src/overrides/Login.tsx` with the PANEL's shared components (2026-10-07; the web's own `MosaicCaptcha`/`loginChallenge` were removed):
  - `captcha_required`: `@/components/login/CaptchaDialog` (`client="owner_web"`) driven by the panel's `@/auth/useLoginCaptcha`. Solved → back to the form ("check passed", focus on the email or password); it NEVER signs in by itself (fixed 2026-10-07 — the auto-resend of wrong credentials looped captcha after captcha). The pass goes into `@/auth/loginChallenge`; `src/overrides/auth.ts` `apiLogin` sends it once with the next Sign in. Every attempt after the 5th failure needs a new pass.
  - `reset_suggested`: a "Reset your password?" modal that turns the card to the reset face.
  - `login_locked` (423) / `too_many_attempts` (429): `@/components/login/LoginHold` counts down from `retry_after`, then says sign-in can be tried again.
  - Needs a pinned `panel.ref` that contains these components.
- Tests: `tests/login.test.tsx` ("the sign-in guard"), `tests/auth.test.ts`.
- **Sign-in errors follow a language switch** (2026-10-07): `src/overrides/Login.tsx` keeps the error as the panel's `LocalizedText` (`@/i18n/localizedText`) and renders it at render time — panel keys via `t`, `web.*` keys via `tw`. Server refusal codes with web wording live in `src/web/i18n.ts` as `web.refusal.<code>` (`webRefusalKeyFor`; same text as the backend's `response.client-access.*`); a code without one keeps the server's sentence. Tests: `tests/login.language.test.tsx`.

## Static sign-in (2026-11-13)

The owner asked for a sign-in with no animation, a beautiful background and no
freeze while it loads; the panel did it (panel `CLAUDE.md`, "Static sign-in").
Here: `src/overrides/Login.tsx` and `ResetPassword.tsx` no longer mount the
panel's `LoginScene` (three.js) or `HudBackdrop` (both deleted in the panel),
`SceneGuard` and the reduced-motion check went with them, and a swap of the
card's faces moves focus to the first field of the face now showing, as on the
desktop. `three`, `@react-three/fiber` and `@types/three` are uninstalled
(`check-deps` still passes against both the old and the new panel lockfile).
The background, the stillness and the instant swap are the PANEL's CSS: they
reach this app only with a `panel.ref` bump to the panel commit that has them.
**Ship this change together with that bump.** Against the old pin it still
builds and its tests pass, but the old CSS still flies the form in and keeps
the ring's empty space above the wordmark.

Tests: `tests/loginStatic.test.tsx` (the import graph of both overrides,
through this app's aliases, reaches no three.js; no canvas/scene/ring; the
swap's inert + focus both ways). Verified against the panel working tree by
copying it into `vendor/panel` (tracked + untracked files, as the tarball
would carry them, stamped with the current `panel.ref` so `fetch-panel` leaves
it alone), then restoring `vendor/panel` from a tar backup, checked
file-by-file with sha256. `PANEL_SRC` (a symlink) was not used: the panel's
files would resolve their packages from the panel's own `node_modules`.

## Address block (2026-10-01)

When the backend answers `ip_blocked` / `country_blocked`, the panel's `NetworkBlockedScreen` replaces everything; `TelegramGate` shows the same screen instead of a generic "refused" (tested in `tests/telegram.test.tsx`). Web and Telegram owners have desktop parity (backend `client_access.denied_routes`), so no feature is hidden here either.

## Brand mark (2026-10-17)

The logo comes from the panel's `public/logo.png` at `panel.ref`; the new wide
mark appears here when `panel.ref` is bumped to a panel commit that has it.
`.login-shell.web-login .login-logo` is 76px on phones (62px until
2026-11-13, when the mark moved above the wordmark and grew — the panel's
order, mirrored in both overrides, tested in `tests/loginStatic.test.tsx` and
`tests/resetPassword.test.tsx`; the form's floor went 320 → 360px, and the
sign-in button keeps 46–48px over the touch rule's 40px). Tab and home-screen icons are square files in `src/web/icons/`
(linked from `index.html`, bundled by Vite into `/assets/`); they used to be
the wide `logo.png`.

## Installable app and phone notifications (2026-11-09)

- **Owner-web-only root files live in `static/`** (`manifest.webmanifest`,
  `sw.js`, `icons/`), copied to the root of `dist/` by the Vite plugin
  `scripts/ownerWebStatic.mjs` (and served by it in `npm run dev`). Never put
  them in the panel's `public/` (Vite's `publicDir` here): the desktop app would
  ship them. A name in both directories fails the build.
- **Manifest**: "Cyber Place Owner" / "Cyber Place", `start_url` and `scope`
  `/`, `display: standalone`, theme and background `#020514` (the panel's
  `--color-bg`). Icons 192/512 `any` (the apple-touch-icon composition: mark
  136/180 of the side on navy) and `maskable` (mark 62% wide, inside the 80%
  safe circle). Generated with ImageMagick from the brand kit's
  `mark-master.png`, the 835px master the panel's `public/logo.png` (328px) is
  scaled from, so the 512px icons are not upscaled. `index.html` links the
  manifest plus `mobile-web-app-capable`, `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-title`.
- **Service worker `/sw.js`** (classic script, root scope, same origin):
  `push` shows `{title, body, url, tag, icon}` (defaults when missing or
  broken; same tag replaces and re-alerts); `notificationclick` focuses an open
  window and navigates it to `url`, or opens one; a `url` on another origin
  becomes `/`. `fetch`: navigations pass to the network (`respondWith(fetch())`),
  nothing else is intercepted. **It caches nothing**: app updates keep arriving
  through `index.html` `no-cache`. `skipWaiting` + `clients.claim`. `main.tsx`
  registers it on `load` in a browser (never in Telegram). To retire it, ship
  a `sw.js` that unregisters itself; never delete the file.
- **Menu card** `src/web/PhoneAppMenuEntry.tsx` (in the Sidebar's
  `footerExtra`, after the Telegram card, Support's card styles + `.web-menu-card`
  in web.css):
  - Telegram Mini App: a note that notices come from the bot; no install.
  - Chrome: `beforeinstallprompt` is captured at start (`src/web/pwa/installPrompt.ts`,
    `preventDefault`, so the menu is the one offer) → «Установить приложение»
    → Chrome's dialog; `appinstalled` removes it.
  - iOS (no prompt exists): the card unfolds four numbered steps
    (`src/web/IosInstallSteps.tsx`: Share, «На экран „Домой“» / «Ещё»,
    «Добавить» + sign in, «Разрешить уведомления»; Safari's icons inline; a
    note that it needs Safari or iOS 16.4+ and not the Telegram app). iOS web
    push works only in the installed app (iOS 16.4+). Armenian names
    Safari's English labels (iOS has no Armenian UI).
  - Installed (`display-mode: standalone` / `navigator.standalone`): the
    phone-notifications switch (`src/web/pwa/usePhoneNotifications.ts`,
    transport `src/web/pwa/webPush.ts` through the panel's `request`).
- **One notifications state per app** (2026-11-09):
  `src/web/pwa/PhoneNotificationsContext.tsx` runs `usePhoneNotifications`
  ONCE, mounted by the Layout override around the whole shell (outside the
  Sidebar, so it runs with the drawer closed), and only in the installed app
  outside Telegram (elsewhere it stays "hidden" and asks the server nothing).
  The menu card and the prompt read it with `usePhoneNotificationsState()`;
  never call the hook from a component. Field evidence that forced this: an
  installed iPhone read `/web-push/public-key` and never POSTed, because the
  only "turn on" was hidden in the off-canvas menu.
- **First-launch prompt** `src/web/PhoneNotificationsPrompt.tsx` (Layout, keyed
  by the user id): a bottom sheet (`src/web/WebSheet.tsx` = the panel's
  `Modal` + `.web-sheet`, centred from 600px) when the shared state is "off"
  and `Notification.permission === "default"`. «Разрешить уведомления» calls
  `enable()` straight from the tap (iOS/Chrome ask only from a gesture; one
  tap is unavoidable) → toast «Уведомления включены». «Позже» / × / Escape:
  hidden in memory until the next launch. Denied: the sheet shows how to
  allow again (iOS: Настройки → Уведомления → Cyber Place → Допуск
  уведомлений) and never nags afterwards (the permission is no longer
  "default"; the card keeps the blocked note).
- **Install banner** `src/web/InstallBanner.tsx` (Layout, keyed by the user id):
  in a browser tab, signed in, below 900px (CSS): iOS → «Как установить»
  opens the same four steps in a sheet; Chrome → «Установить» while an offer
  is held. Closing or using it is remembered for the browser session
  (`sessionStorage`, `u{id}:cp.web.installBanner.closed`).
- **Backend contract**: `GET /web-push/public-key` → `{public_key: string|null}`
  (null or 404 = feature off → the switch is hidden; another error also hides
  it until the next load); `POST /web-push/subscriptions` `{endpoint, keys:
  {p256dh, auth}, content_encoding: "aes128gcm"}`; `DELETE
  /web-push/subscriptions` `{endpoint}`. Enable = permission question FIRST in
  the tap (Safari needs the gesture) → register → `serviceWorker.ready` →
  `subscribe({userVisibleOnly, applicationServerKey})` → POST; a POST the
  server refuses unsubscribes again. On load with permission granted the
  existing subscription is re-POSTed silently (also on an account change); one
  made with a different server key is dropped (DELETE + unsubscribe) and made
  again; granted with NO subscription subscribes again silently (register →
  ready → subscribe → POST, no question: the permission is already given); a
  silent subscribe or POST that fails reads "off" (the new subscription is
  dropped) and the card / prompt offer the tap. Turn off
  = DELETE then unsubscribe. **Sign-out** (`src/overrides/auth.ts`) removes the
  subscription (DELETE + unsubscribe, bounded to 3 s) before the session ends,
  so a phone does not keep receiving an account it left; the next sign-in on
  a phone that allows notifications is subscribed again silently, under its
  own account.
- Tests: `tests/phoneApp.test.tsx` (install, iOS, Telegram, subscribe order and
  exact body, feature off null/404, blocked, unsupported, refusal, turn off,
  re-sync, key change, sign-out, key read 404 vs 500; since 2026-11-09 also
  one shared instance, the prompt's exact conditions, permission asked
  synchronously in the tap, «Позже», denied view, silent re-subscribe, the
  steps in ru/en/am, the banner), `tests/serviceWorker.test.ts`
  (runs `static/sw.js` in a vm sandbox), `tests/caddyfile.test.ts` (allowlist vs
  `public/` + `static/`, cache and CSP, manifest and icon sizes, index.html),
  `tests/layout.test.tsx`. Mutation-verified (12): allowlist without
  `/sounds/*` or `/icons/*`, worker before the permission question,
  `content_encoding` dropped, 404 not "off", turn-off without DELETE, Telegram
  not detected, offer not held, foreign url followed, open window not
  navigated, every request intercepted, sign-out keeps the subscription.
  2026-11-09 (8 more): worker before the question, prompt defers `enable()`
  past the tap, no silent re-subscribe, re-subscribe without POST, card or
  prompt running its own hook instance (2), prompt ignoring
  `permission !== "default"`, provider not limited to the installed app.
- Verified in headless Chromium against `vite preview` (external requests
  blocked): the worker registers at `/` and controls the page, the manifest
  parses with no errors, installability errors only `in-incognito` (Playwright's
  context), and a push delivered through CDP showed exactly the payload's
  title, body, tag, icon and url. NOT verified: a real Android install, iOS
  home-screen push, and the Caddyfile under a real Caddy (none locally).

## The platform bill on a phone (2026-11-09)

The compact «Общая задолженность Cyber Place Platform» card and the
full-screen «Подробнее» drawer are the PANEL's CSS (`global.css`, inside
`max-width: 640px` / `480px`; see the panel's CLAUDE.md, "On a phone"). They
reach this app only with a `panel.ref` bump to a panel commit that has them;
nothing is overridden here. On phones `.web-shell .card` (12px padding, above)
still wins over the card's own padding.

## Installed app: the phone shell (2026-11-09)

Only `isInstalledApp()` (`src/web/pwa/environment.ts`: `isStandalone() &&
!isTelegramMiniApp()`, also what `PhoneNotificationsProvider` uses) and only
below 900px. A browser tab, the Telegram Mini App and the wide layout keep the
plain frame. The Layout override adds `.web-shell--app` and:

- **No burger, no drawer** below 900px (owner, 2026-11-09): the bar,
  «More» and the account sheet hold everything the drawer offers;
  `tests/appShell.test.tsx` ("nothing the drawer offers is out of reach")
  renders the real Sidebar with its account menu next to the app's UI, per
  role, and fails on any drawer action the app lacks. The drawer element
  stays mounted (from 900px it IS the sidebar); web.css hides it below.
- **Top bar**: logo, then `src/web/appShell/AppTopActions.tsx` (bell, avatar). The bell's count is
  `useNotifications().unreadCount`, the side menu's own badge source (no
  second poller), and links to `#/notifications`. The avatar is initials
  (`initialsOf`) or a person icon: `AuthUser` has **no photo field**; a
  photo needs a backend field first. It opens the «Аккаунт» sheet (`AccountSheet.tsx`, a `WebSheet`): name,
  email and role; Profile (`ProfileModal`); switch account where the
  Sidebar offers it (owner, manager), with the panel's `AccountSwitchPanel` /
  `AccountSwitchModal` wired as `UserMenu` wires them; Settings only if the
  bar and «More» lack it (it is a required entry, so normally hidden); Sign
  out = `useAuth().logout()`, the Sidebar button's own call, which reaches
  `forgetPushOnSignOut` through the `@/api/auth` override.
- **Bottom bar** `src/web/appShell/AppTabBar.tsx`: the side menu's entries
  from `useSideMenu()` (`src/web/appShell/sideMenu.ts`), the Sidebar's own
  pipeline (`menuSpecsFor` → `withStaffMenu` → `sortedNavItems` →
  `applyPersonalMenu`, as the panel's Appearance screen does). Never list
  entries here. `tests/appShell.test.tsx` renders the real Sidebar beside
  it per role and with a personal arrangement; a panel change to the
  Sidebar's pipeline must be mirrored in `useSideMenu` (that test fails
  otherwise). The first `PRIMARY_TABS` (3) entries sit on the bar, the rest
  in a «More» sheet (`WebSheet`) with Support and the menu's footer cards
  (Telegram, phone app). Three, not four: measured, Armenian
  «մասնաճյուղերը» is 81-84px at the bar's 10px label and five slots at 360px
  give 72px. More's badge sums what is inside except notifications (the bell
  has them). The bar is the shell grid's third row (z 20): `.main` ends above
  it, no padding trick. Drawer 30/40, dialogs 50, toasts above it
  (`.web-shell--app .web-notices`).
- Motion: a light strip glides to the lit entry (transform, 240ms), the
  icon dips on tap, the sheet is the panel Modal's slide-up, the page entry
  is the panel's own `cp-page-in`. `prefers-reduced-motion`: none of it.

## The billing cover on a phone (2026-11-09)

The panel's `.billing-lock` (Active Places, Tournaments) is a
`backdrop-filter` layer inside the screen, 16px larger than its box and as
tall as the board. Below 900px only `.main`'s overflow clip kept it off the
top bar, and iOS WebKit does not hold an async-scrolled backdrop-filter layer
to that clip, so the logo and menu button were blurred once the board
scrolled. web.css (below 900px, `.web-shell` only, not
`.billing-lock--screen`): the cover ends at the screen's edges, has no
`backdrop-filter` (a denser tint), the bars get their own compositing layer,
and `--main-pad-top` is 0 so the PageTopBar band no longer reaches 16px
above `.main`. The session-ending cards (`.ending-soon-stack`) now join
`.web-notices` instead of covering the top bar. Not reproducible headless
(Chromium, WebKitGTK clip correctly); verified there that the cover never
reaches either bar, and by tests on the rules. Harness and screenshots:
`~/cyber-place-local/reports/owner-web-mobile-shell-2026-11-09/`.

## The closed drawer's wordmark (2026-11-09)

The menu's «CYBER PLACE» breathes with an endless drop-shadow `filter` (panel
`brandGlow`, up to a 28px blur). With the drawer closed just off the right
edge, WebKit drew that filter's area as a solid black or white block over
the top bar's right end, the menu button (6-8 of 36 headless WebKit frames,
in a browser tab as well; present before the phone shell, not caused by it;
0 with the glow stopped). Below 900px web.css stops the wordmark's
animation while the drawer is closed. The shot harness
(`~/cyber-place-local/reports/owner-web-mobile-shell-2026-11-09/harness/`,
`pixels.py`) now fails any frame whose bell, avatar or menu-button area is
not drawn in the bar's colours.

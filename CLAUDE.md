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
  | `@/components/Layout` | a shell that works from 360px: below 900px a 52px top bar with the logo on the LEFT and the menu button on the RIGHT, and a drawer that slides in from the right; mounts every notifier the desktop shell mounts. "Telegram" is a card in the menu (panel Sidebar's `footerExtra` slot, `src/web/TelegramMenuEntry.tsx`), for an owner in a browser only; no top-bar or corner button |
  | `@/routes/Login` | the desktop's sign-in pieces incl. the forgot-password flip (`#/forgot-password`); a language pill hands the choice to the next account (`notePreLoginChoice`); in Telegram it says "reopen from the bot" |
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
`/assets/*`, `/fonts/*`, `/bg/*` — the app routes by hash); everything else is
404. CSP as an HTTP header (only there does `frame-ancestors` work; it admits
Telegram's web clients and nobody else), HSTS, nosniff, no-referrer, CORP.
Add a new top-level public file? Add its path to the `@app` matcher.

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


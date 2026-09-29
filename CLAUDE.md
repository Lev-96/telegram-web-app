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
  | `@/components/Layout` | a shell that works from 360px (drawer + top bar); mounts every notifier the desktop shell mounts |
  | `@/routes/Login` | the desktop's sign-in pieces incl. the forgot-password flip (`#/forgot-password`); a language pill hands the choice to the next account (`notePreLoginChoice`); in Telegram it says "reopen from the bot" |
  | `@/routes/ResetPassword` | the mailed reset link's screen: no token field, the secret dropped from the URL, one way forward from a dead link. `main.tsx` renders it STANDALONE when opened on `#/reset-password` — signed in or not — because the panel's signed-in routes would send the link to the dashboard |
  | `@/telemetry/TelemetryTracker` | desktop telemetry must not count web traffic |

  Replace a module only when the web truly differs, and only by alias: a
  panel file imported by RELATIVE path cannot be replaced (check with grep).
- `scripts/check-deps.mjs` fails the build if a library version differs from
  the panel's lockfile: the panel's code must run on what it was tested with.
- Web-only text: `src/web/i18n.ts` (en/ru/am, the panel's `useLang()`
  language). Keep it small — the working screens use the panel's dictionary.
  No em dash; Armenian never says «Վահանակ» for this panel.

## Security model (server-side; see backend `config/client_access.php`)

- Knowing the URL gives a sign-in form and nothing else. An admin grants an
  owner or a manager `owner_web`, and an owner `telegram` access (`php artisan client-access grant
  <email> <client>` or `PUT /admin/owners/{id}/client-access/{client}`).
- Tokens from `/owner-web/session/login` and `/telegram/mini-app/session`
  carry a `client:*` ability, expire (30 days web / 8h Telegram), die when
  idle (14 days web / 60 min Telegram), on revoke, on an admin block and on a
  password reset. Switching accounts on the web is a new web sign-in: the
  server deletes the web token the browser held. They may not call the routes
  in `denied_routes` (logout-all, admin, password/email
  change, creating or writing managers/users, deleting a company, unlock PIN,
  agent token rotation, Wake-on-LAN, PS5 wake events). Those screens still
  render from the panel's code; the server refuses the write with a sentence.
- Telegram: the app sends Telegram's signed launch data untouched; the
  backend checks the HMAC with the bot token, freshness (5 min) and one-time
  use. Linking: the owner creates a one-time link on the web → opens it in
  Telegram → the web shows the Telegram @name → the owner confirms with the
  password. Until confirmed a link grants nothing.
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

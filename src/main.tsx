import App from "@/App";
import { AuthProvider } from "@/auth/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/i18n/LanguageContext";
import "@/styles/global.css";
import "@web/styles/web.css";
import TelegramGate from "@web/telegram/TelegramGate";
import { prepareTelegramChrome, readTelegramLaunch } from "@web/telegram/telegram";
import ResetPassword, { isResetLink } from "@web/overrides/ResetPassword";
import { isTouchDevice, lockPageZoom } from "@web/web/pageZoom";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

// Read BEFORE anything renders: Telegram passes its launch in the URL hash,
// which the panel's HashRouter would otherwise take for a route.
const launch = readTelegramLaunch();
if (launch) {
  prepareTelegramChrome(launch.webApp);
} else {
  document.documentElement.dataset.shell = "web";
}

// Phones and tablets: the page stays at 100% (see pageZoom.ts).
if (isTouchDevice()) lockPageZoom();

// The panel's own tree — the same providers and the same App the desktop
// renders — with the Telegram gate in front of it when opened from Telegram.
// Opened on a password-reset link, the reset screen stands alone instead:
// signed in or not, the link must reach it (see ResetPassword).
const panel =
  !launch && isResetLink() ? (
    <ResetPassword />
  ) : (
    <AuthProvider>
      <App />
    </AuthProvider>
  );

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        {/* No pre-sign-in language picker here (2026-09-30): the sign-in
            screen has its language pills, Telegram signs in by itself, and
            the account's language — asked once per account, kept on the
            server (overrides/languagePreference.ts) — follows the sign-in.
            With both pickers, Telegram opened them on top of each other. */}
        {launch ? <TelegramGate launch={launch}>{panel}</TelegramGate> : panel}
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
);
